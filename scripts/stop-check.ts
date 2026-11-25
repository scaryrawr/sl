#!/usr/bin/env bun
/**
 * Codex and Copilot Stop hook that keeps the agent working until the sl repo is free of build, lint, and clippy
 * problems.
 *
 * Reads an agent `Stop` hook event on stdin, runs the repo's clippy, lint, type, and format checks, then prints a
 * hook response on stdout. `{"decision":"block","reason":"..."}` hands the failures back to the agent so the
 * turn continues; `{}` lets the turn finish.
 *
 * Every diagnostic counts as a failure, errors and warnings alike, except cargo advisories that carry no source
 * location. The checks run every time the hook fires: the repo's suite costs under a second on a warm tree, so
 * nothing is cached and there is no working-tree state to go stale. Set `SL_STOP_CHECK=off` to skip one check.
 *
 * Manual run:
 *   printf '%s' '{"hook_event_name":"Stop","session_id":"dev","turn_id":"dev","cwd":"'$PWD'","stop_hook_active":false}' |
 *     bun scripts/stop-check.ts
 *
 * @module stop-check
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Codex or Copilot Stop hook payload, before validation. */
interface StopEventWire {
  hook_event_name?: string;
  session_id?: string;
  turn_id?: string;
  cwd?: string;
  stop_hook_active?: boolean;
}

/** Validated Stop hook payload for one turn. */
interface StopEvent {
  hookEventName: string;
  sessionId: string;
  turnId: string;
  cwd: string;
  stopHookActive: boolean;
}

/** One validation step and how long it may run. */
interface CheckStep {
  label: string;
  command: string;
  args: string[];
  timeoutMs: number;
  /** Command that rewrites the offending files, used when the failing step is a formatter in check mode. */
  fix?: string;
}

/** Result of one validation step. */
interface RunResult {
  code: number;
  /** stdout and stderr concatenated, because diagnostics may arrive on either stream. */
  output: string;
  /** stdout alone, used where output is resolved rather than read as diagnostics. */
  stdout: string;
  /** Non-empty when the step could not be evaluated, such as a missing tool or a timeout. */
  problem: string;
}

/** A failing step, described so the agent can reproduce and fix it. */
interface Failure {
  label: string;
  command: string;
  excerpt: string;
  /** Command that rewrites the offending files, when the fix is a formatter rather than a manual edit. */
  fix?: string;
}

/** Verdict for one run of the checks. */
interface Outcome {
  failures: Failure[];
  notes: string[];
}

/** Hand-back counter for the current turn. */
interface TurnStateWire {
  turn_id?: string;
  blocks?: number;
}

interface TurnState {
  turnId: string;
  blocks: number;
}

/** Times one turn may be handed back to fix failures. */
const MAX_BLOCKS_PER_TURN = 2;

/**
 * Total budget for all steps plus repository discovery. Both hook files declare a 900s timeout while the step
 * budgets sum to 720s, so this deadline leaves 60s before the agent terminates the hook process.
 */
const SHARED_DEADLINE_MS = 780000;

/** Upper bound for each failing command excerpt in the continuation prompt. */
const SNIPPET_LIMIT = 2400;

/** Upper bound for the whole continuation prompt, so many failures cannot flood the hand-back. */
const PROMPT_LIMIT = 6000;

/** Validation steps, slowest first. */
const CHECKS: CheckStep[] = [
  {
    label: 'cargo clippy (build errors and clippy warnings)',
    command: 'cargo',
    args: ['clippy', '--workspace', '--all-targets', '--', '-D', 'warnings'],
    timeoutMs: 300000
  },
  // `--format=agent` pins one diagnostic line per finding; oxlint's default format switches between compact
  // lines and multi-line code frames depending on its environment, which would break parsing inside a hook.
  { label: 'oxlint', command: 'bunx', args: ['oxlint', '.', '--format=agent'], timeoutMs: 120000 },
  {
    label: 'oxlint type-aware',
    command: 'bunx',
    args: [
      'oxlint',
      '.',
      '--type-aware',
      '-A',
      'all',
      '-W',
      'typescript/no-floating-promises',
      '-D',
      'typescript/await-thenable',
      '--format=agent'
    ],
    timeoutMs: 180000
  },
  { label: 'demo typecheck', command: 'bun', args: ['run', 'typecheck'], timeoutMs: 60000 },
  {
    label: 'site formatting',
    command: 'bun',
    args: ['fmt', '--check'],
    timeoutMs: 30000,
    fix: 'bun fmt'
  },
  {
    label: 'rust formatting',
    command: 'cargo',
    args: ['fmt', '--all', '--check'],
    timeoutMs: 30000,
    fix: 'cargo fmt --all'
  }
];

const startedAt = Date.now();
const scriptPath = fileURLToPath(import.meta.url);
const fallbackRoot = path.resolve(path.dirname(scriptPath), '..');

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** The ESC byte that introduces an ANSI escape sequence. */
const escape = String.fromCharCode(27);

/** cargo fmt colors its diff with ANSI codes even when this hook captures its output through a pipe. */
const ansiEscape = new RegExp(`${escape}\\[[0-9;]*[A-Za-z]|${escape}\\([A-Za-z]`, 'g');

/** Drop those color codes so a cargo fmt diff stays readable inside a hand-back prompt. */
const stripAnsi = (text: string) => text.replace(ansiEscape, '');

/** Keep text inside a limit so one long excerpt cannot dominate the hand-back. */
const truncate = (text: string, limit: number) =>
  text.length > limit ? `${text.slice(0, limit)}\n… truncated …` : text;

const getErrorMessage = (cause: unknown) => {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
};

/** Decode a Codex or Copilot Stop payload. */
const parseEvent = (payload: string): StopEvent => {
  const wire: StopEventWire = JSON.parse(payload);

  if (!wire.session_id || !wire.cwd) {
    throw new Error('missing session_id or cwd');
  }

  return {
    hookEventName: wire.hook_event_name ?? '',
    sessionId: wire.session_id,
    turnId: wire.turn_id ?? 'copilot',
    cwd: wire.cwd,
    stopHookActive: wire.stop_hook_active === true
  };
};

/** Directory holding the per-session hand-back counters. */
const stateRoot = () => {
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');

  return path.join(codexHome, 'cache', 'sl-stop-check');
};

const runStep = (step: CheckStep, cwd: string): RunResult => {
  const budgetMs = Math.min(step.timeoutMs, SHARED_DEADLINE_MS - (Date.now() - startedAt));

  if (budgetMs <= 0) {
    return { code: 0, output: '', stdout: '', problem: 'shared check deadline exhausted before this step' };
  }

  const result = spawnSync(step.command, step.args, {
    cwd,
    timeout: budgetMs,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });

  if (result.error) {
    // SAFETY: spawnSync surfaces OS failures as ErrnoException, whose code carries ENOENT or ETIMEDOUT.
    const code = (result.error as NodeJS.ErrnoException).code ?? '';

    if (code === 'ENOENT') {
      return { code: 0, output: '', stdout: '', problem: `${step.command} is not installed here` };
    }

    if (code === 'ETIMEDOUT') {
      return {
        code: 1,
        output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
        stdout: result.stdout ?? '',
        problem: `${step.command} exceeded ${Math.round(budgetMs / 1000)}s`
      };
    }

    return {
      code: 1,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
      stdout: result.stdout ?? '',
      problem: `${step.command} could not run: ${result.error.message}`
    };
  }

  return {
    code: result.status ?? 1,
    output: stripAnsi(`${result.stdout ?? ''}${result.stderr ?? ''}`),
    stdout: result.stdout ?? '',
    problem: ''
  };
};

const commandText = (step: CheckStep) => [step.command, ...step.args].join(' ');

/** Final stdout line of a probe whose answer is one path, ignoring any advisory output. */
const lastStdoutLine = (result: RunResult) => {
  const lines = result.stdout.split('\n').filter((line) => line.trim());

  return lines.at(-1)?.trim() ?? '';
};

const repoRoot = (eventCwd: string) => {
  const probe = runStep(
    { label: 'git root', command: 'git', args: ['rev-parse', '--show-toplevel'], timeoutMs: 5000 },
    eventCwd
  );

  const root = lastStdoutLine(probe);

  if (probe.code === 0 && root) {
    return path.resolve(root);
  }

  return fallbackRoot;
};

const readJson = async <T>(file: string): Promise<T | null> => {
  try {
    const value: T = JSON.parse(await readFile(file, 'utf8'));

    return value;
  } catch (cause) {
    if (getErrorMessage(cause).includes('ENOENT')) {
      return null;
    }

    throw cause;
  }
};

const writeJson = async (file: string, value: TurnStateWire) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), 'utf8');
};

/** One diagnostic line from a validation step, keyed by source location. */
interface DiagnosticEntry {
  /** `file:line: message`, or empty for cargo advisories that carry no source location. */
  key: string;
  line: string;
  /** The `--> path:line:column` line rustc prints under its diagnostics, when present. */
  location: string;
  warning: boolean;
}

/**
 * Collect diagnostics from step output. oxlint writes `file:line:col: <severity> <rule>: <message>` on one line,
 * while rustc and clippy print a severity line followed by a `-->` location line.
 */
const diagnosticEntries = (output: string): DiagnosticEntry[] => {
  const lines = output.split('\n');
  const entries: DiagnosticEntry[] = [];

  lines.forEach((line, index) => {
    // Agent format prints `file:line:col: <severity> <rule>: <message>`; parser errors drop the rule and print
    // `file:line:col: <severity>: <message>`, so the severity's trailing colon is optional.
    const lint = /^(.+?):(\d+):(\d+): (error|warning):?\s+(.+)$/.exec(line);

    if (lint) {
      entries.push({ key: `${lint[1]}:${lint[2]}: ${lint[5]}`, line, location: '', warning: lint[4] === 'warning' });

      return;
    }

    const tsc = /^(.+?)\((\d+),(\d+)\): (error|warning) (.+)$/.exec(line);

    if (tsc) {
      entries.push({ key: `${tsc[1]}:${tsc[2]}: ${tsc[5]}`, line, location: '', warning: tsc[4] === 'warning' });

      return;
    }

    if (!/^(?:warning|error)/.test(line)) {
      return;
    }

    const location = lines.slice(index + 1, index + 5).find((candidate) => candidate.includes('-->')) ?? '';
    const position = /-->\s*(.+?):(\d+):\d+/.exec(location);

    if (!position) {
      // Cargo manifest and resolver advisories carry no source location, so they never reach the agent.
      entries.push({ key: '', line, location: '', warning: line.startsWith('warning') });

      return;
    }

    entries.push({
      key: `${position[1]}:${position[2]}: ${line.replace(/^(?:warning|error):\s*/, '').trim()}`,
      line,
      location: location.trim(),
      warning: line.startsWith('warning')
    });
  });

  return entries;
};

/** Warning lines a step owes the agent; location-less cargo advisories are excluded. */
const warningLines = (output: string) =>
  diagnosticEntries(output)
    .filter((entry) => entry.warning && entry.key)
    .map((entry) => entry.line);

/** Trim step output to actionable diagnostics: every error, plus every warning with a source location. */
const summarize = (output: string) => {
  const kept = diagnosticEntries(output)
    .filter((entry) => !entry.warning || entry.key !== '')
    .flatMap((entry) => (entry.location ? [entry.line.trim(), entry.location] : [entry.line.trim()]));

  return truncate(kept.join('\n'), SNIPPET_LIMIT);
};

/** Last lines of step output, used when a failing step printed nothing parsable as a diagnostic. */
const rawTail = (output: string) => {
  const lines = output.split('\n').filter((line) => line.trim());

  return lines.length
    ? truncate(lines.slice(-15).join('\n'), SNIPPET_LIMIT)
    : '(no output captured; nonzero exit with no diagnostics on stdout or stderr)';
};

/**
 * Run every validation step and report which ones failed.
 *
 * Errors and warnings both count as failures; cargo advisories without a source location concern the manifest
 * rather than code, so they stay out of the report.
 */
const evaluate = (root: string): Outcome => {
  const failures: Failure[] = [];
  const notes: string[] = [];

  CHECKS.forEach((step) => {
    const result = runStep(step, root);

    if (result.problem) {
      notes.push(`${commandText(step)} → ${result.problem} (step skipped)`);

      return;
    }

    const failuresForStep: Failure[] = [];

    if (result.code !== 0) {
      failuresForStep.push({
        label: step.label,
        command: commandText(step),
        excerpt: summarize(result.output) || rawTail(result.output),
        fix: step.fix
      });
    }

    const warnings = warningLines(result.output);

    // oxlint exits zero on warnings, so a step that passed can still owe the agent fixes.
    if (result.code === 0 && warnings.length) {
      failuresForStep.push({
        label: `${step.label} warnings`,
        command: commandText(step),
        excerpt: truncate(warnings.join('\n'), SNIPPET_LIMIT)
      });
    }

    failures.push(...failuresForStep);
  });

  return { failures, notes };
};

const continuationPrompt = (failures: Failure[], notes: string[]) => {
  const numbered = failures.map((failure, index) => {
    const fix = failure.fix ? `\n   fix: ${failure.fix}` : '';

    return `${index + 1}. ${failure.label}\n   command: ${failure.command}${fix}\n${failure.excerpt}`;
  });

  const notesText = notes.length ? `\nNotes:\n${notes.map((note) => `   ${note}`).join('\n')}` : '';

  return [
    'The sl stop check found build, lint, clippy, or formatting problems. Fix every one of them before ending this turn:',
    '',
    numbered.join('\n\n'),
    notesText,
    '',
    'Edit the offending files, or run the fix command where one is given, then re-run the commands above until each ' +
      'one passes. Do not silence a check by disabling a rule, adding an ignore comment, or deleting failing code unless ' +
      'the user asked for that.'
  ].join('\n');
};

const decodeTurnState = (wire: TurnStateWire | null): TurnState | null => {
  if (!wire || !wire.turn_id) {
    return null;
  }

  return { turnId: wire.turn_id, blocks: wire.blocks ?? 0 };
};

const handleEvent = async (event: StopEvent) => {
  if (event.hookEventName !== 'Stop' || process.env.SL_STOP_CHECK === 'off') {
    return {};
  }

  const root = repoRoot(path.resolve(event.cwd));
  const isCopilot = event.turnId === 'copilot';
  const turnFile = isCopilot ? null : path.join(stateRoot(), `${digest(`${event.sessionId}\0${root}`)}.json`);
  const state = turnFile === null ? null : decodeTurnState(await readJson<TurnStateWire>(turnFile));

  // Hand-backs only accumulate inside one turn, so a new turn always starts with a fresh budget.
  const blocks = state !== null && state.turnId === event.turnId ? state.blocks : 0;
  const outcome = evaluate(root);

  if (!outcome.failures.length) {
    if (outcome.notes.length) {
      return { systemMessage: `sl stop check skipped steps: ${outcome.notes.join('; ')}` };
    }

    return {};
  }

  // Codex can count two hand-backs per turn. Copilot marks forced continuations with `stop_hook_active`, which
  // provides the equivalent guard without a Codex turn ID.
  if ((isCopilot && event.stopHookActive) || blocks >= MAX_BLOCKS_PER_TURN || (event.stopHookActive && blocks === 0)) {
    if (isCopilot) {
      return {};
    }

    const headline = outcome.failures.map((failure) => `${failure.command}: ${failure.excerpt.split('\n')[0]}`);

    return {
      systemMessage: truncate(
        `sl stop check still fails, so this turn may finish:\n${headline.join('\n')}`,
        SNIPPET_LIMIT
      )
    };
  }

  if (turnFile !== null) {
    await writeJson(turnFile, { turn_id: event.turnId, blocks: blocks + 1 });
  }

  const reason = truncate(continuationPrompt(outcome.failures, outcome.notes), PROMPT_LIMIT);

  if (isCopilot) {
    return {
      decision: 'block',
      reason,
      hookSpecificOutput: {
        decision: 'block',
        reason
      }
    };
  }

  return {
    decision: 'block',
    reason
  };
};

if (pathToFileURL(process.argv[1] ?? '').href === import.meta.url) {
  let payload = '';

  for await (const chunk of process.stdin) {
    payload += chunk;
  }

  handleEvent(parseEvent(payload))
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((cause: unknown) => {
      console.error(`sl stop-check hook failed: ${getErrorMessage(cause)}`);
      console.log('{}');
    });
}
