#!/usr/bin/env bun
/**
 * Stop hook that keeps the agent working until the sl repo is free of build, lint, and clippy problems.
 *
 * Reads a Codex `Stop` hook event on stdin, runs the repo's clippy, lint, and type checks, then prints a Codex
 * hook response on stdout. `{"decision":"block","reason":"..."}` hands the failures back to the agent so the
 * turn continues; `{}` lets the turn finish.
 *
 * Warnings that already existed when this hook was installed are stored as a tolerated baseline, so only new
 * warnings count as failures. Delete `~/.codex/cache/sl-stop-check/baseline.json` to re-baseline after
 * accepting new warnings. Set `SL_STOP_CHECK=off` to skip the check for one turn.
 *
 * Manual run:
 *   printf '%s' '{"hook_event_name":"Stop","session_id":"dev","turn_id":"dev","cwd":"'$PWD'","stop_hook_active":false}' |
 *     bun scripts/stop-check.ts
 *
 * @module stop-check
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Codex Stop hook payload, before validation. */
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
}

/** Result of one validation step. */
interface RunResult {
  code: number;
  /** stdout and stderr concatenated, because diagnostics may arrive on either stream. */
  output: string;
  /** stdout alone, used where output is hashed or resolved rather than read as diagnostics. */
  stdout: string;
  /** Non-empty when the step could not be evaluated, such as a missing tool or a timeout. */
  problem: string;
}

/** A failing step, described so the agent can reproduce and fix it. */
interface Failure {
  label: string;
  command: string;
  excerpt: string;
}

/** Verdict for one working-tree state. */
interface Outcome {
  failures: Failure[];
  warnings: string[];
  notes: string[];
  /** True when a step could not run, so the verdict and warning list are partial. */
  incomplete: boolean;
}

/** Cached verdict and hand-back count for the current turn. */
interface TurnStateWire {
  turn_id?: string;
  fingerprint?: string;
  failures?: FailureWire[];
  blocks?: number;
  incomplete?: boolean;
}

interface FailureWire {
  label?: string;
  command?: string;
  excerpt?: string;
}

interface TurnState {
  turnId: string;
  fingerprint: string;
  failures: Failure[];
  blocks: number;
  incomplete: boolean;
}

/** Warnings tolerated because they predated this hook. */
interface Baseline {
  warnings: string[];
}

/** Times one turn may be handed back to fix failures. */
const MAX_BLOCKS_PER_TURN = 2;

/**
 * Total budget for all steps plus repository discovery. `.codex/hooks.json` declares a 900s hook timeout while the
 * step budgets sum to 660s, so this deadline leaves 120s before Codex terminates the hook process.
 */
const SHARED_DEADLINE_MS = 780000;

/** Upper bound for each failing command excerpt in the continuation prompt. */
const SNIPPET_LIMIT = 2400;

/** Upper bound for the whole continuation prompt, so many failures cannot flood the hand-back. */
const PROMPT_LIMIT = 6000;

/** Cap for tolerated pre-existing warnings. */
const BASELINE_LIMIT = 400;

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
  { label: 'demo typecheck', command: 'bun', args: ['run', 'typecheck'], timeoutMs: 60000 }
];

const startedAt = Date.now();
const scriptPath = fileURLToPath(import.meta.url);
const fallbackRoot = path.resolve(path.dirname(scriptPath), '..');

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Keep text inside a limit so one long excerpt cannot dominate the hand-back. */
const truncate = (text: string, limit: number) =>
  text.length > limit ? `${text.slice(0, limit)}\n… truncated …` : text;

const getErrorMessage = (cause: unknown) => {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
};

/** Decode the stdin payload, or throw when it is not a Stop event. */
const parseEvent = (payload: string): StopEvent => {
  const wire: StopEventWire = JSON.parse(payload);

  if (!wire.session_id || !wire.cwd) {
    throw new Error('missing Codex session_id or cwd');
  }

  return {
    hookEventName: wire.hook_event_name ?? '',
    sessionId: wire.session_id,
    turnId: wire.turn_id ?? 'session',
    cwd: wire.cwd,
    stopHookActive: wire.stop_hook_active === true
  };
};

/** Directory holding the warning baseline and per-session turn guards. */
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
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    stdout: result.stdout ?? '',
    problem: ''
  };
};

const commandText = (step: CheckStep) => [step.command, ...step.args].join(' ');

/** Final stdout line of a probe whose answer is one path or hash, ignoring any advisory output. */
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

const nulSplit = (text: string) => text.split('\0').filter(Boolean);

const hashFile = (hasher: ReturnType<typeof createHash>, directory: string, relative: string) => {
  hasher.update(relative);

  try {
    hasher.update(readFileSync(path.join(directory, relative)));
  } catch {
    hasher.update('unreadable');
  }
};

/** Content hash of the working tree plus the generated wasm bindings the demo site imports. */
const workingTreeFingerprint = (root: string) => {
  const hasher = createHash('sha256');
  const head = runStep({ label: 'git head', command: 'git', args: ['rev-parse', 'HEAD'], timeoutMs: 5000 }, root);
  const tracked = runStep({ label: 'git tracked', command: 'git', args: ['ls-files', '-z'], timeoutMs: 10000 }, root);

  const others = runStep(
    {
      label: 'git untracked',
      command: 'git',
      args: ['ls-files', '--others', '--exclude-standard', '-z'],
      timeoutMs: 10000
    },
    root
  );

  hasher.update(lastStdoutLine(head));
  const files = [...new Set([...nulSplit(tracked.stdout), ...nulSplit(others.stdout)])].toSorted();

  if (files.length > 5000) {
    const status = runStep(
      { label: 'git status', command: 'git', args: ['status', '--porcelain'], timeoutMs: 10000 },
      root
    );

    status.stdout.split('\n').forEach((line) => {
      hasher.update(line);
    });
  } else {
    files.forEach((relative) => {
      hashFile(hasher, root, relative);
    });
  }

  hasher.update(hashGeneratedBindings(root));

  return hasher.digest('hex');
};

const hashGeneratedBindings = (root: string) => {
  const hasher = createHash('sha256');
  const pkgDir = path.join(root, 'libraries/websl/pkg');

  try {
    const names = readdirSync(pkgDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:js|d\.ts|wasm)$/.test(entry.name))
      .map((entry) => entry.name)
      .toSorted();

    names.forEach((name) => {
      hashFile(hasher, pkgDir, name);
    });
  } catch {
    hasher.update('pkg:absent');
  }

  return hasher.digest('hex');
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

const writeJson = async (file: string, value: TurnStateWire | Baseline) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value), 'utf8');
};

/** One diagnostic line from a validation step, keyed for baseline comparison. */
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
      // Cargo manifest and resolver advisories carry no location, so they never key into the baseline.
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

/** Warning keys to compare against the baseline; location-less advisories are excluded. */
const warningKeys = (output: string) =>
  diagnosticEntries(output)
    .filter((entry) => entry.warning && entry.key)
    .map((entry) => entry.key);

/** Warning output lines the agent must fix, because they are outside the tolerated baseline. */
const freshWarningLines = (output: string, tolerated: string[]) =>
  diagnosticEntries(output)
    .filter((entry) => entry.warning && entry.key && !tolerated.includes(entry.key))
    .map((entry) => entry.line);

/** Trim step output to actionable diagnostics: every error, plus warnings beyond the tolerated baseline. */
const summarize = (output: string, tolerated: string[]) => {
  const kept = diagnosticEntries(output)
    .filter((entry) => !entry.warning || (entry.key !== '' && !tolerated.includes(entry.key)))
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
 * On the bootstrap run (`seedBaseline`) warnings are recorded instead of reported, so installing this hook never
 * forces the agent to clean up warnings that already existed.
 */
const evaluate = (root: string, tolerated: string[], seedBaseline: boolean): Outcome => {
  const failures: Failure[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  let incomplete = false;

  CHECKS.forEach((step) => {
    const result = runStep(step, root);

    if (result.problem) {
      notes.push(`${commandText(step)} → ${result.problem} (step skipped)`);
      incomplete = true;

      return;
    }

    const failuresForStep: Failure[] = [];

    if (result.code !== 0) {
      failuresForStep.push({
        label: step.label,
        command: commandText(step),
        excerpt: summarize(result.output, tolerated) || rawTail(result.output)
      });
    }

    const fresh = seedBaseline ? [] : freshWarningLines(result.output, tolerated);

    // Warnings from failing steps are recorded too, so a bootstrap run never leaves pre-existing warnings
    // untolerated just because some other step happened to fail at the same time.
    warnings.push(...warningKeys(result.output));

    if (result.code === 0 && fresh.length) {
      failuresForStep.push({
        label: `${step.label} warnings`,
        command: commandText(step),
        excerpt: truncate(fresh.join('\n'), SNIPPET_LIMIT)
      });
    }

    failures.push(...failuresForStep);
  });

  return { failures, warnings, notes, incomplete };
};

const continuationPrompt = (failures: Failure[], notes: string[]) => {
  const numbered = failures.map((failure, index) => {
    return `${index + 1}. ${failure.label}\n   command: ${failure.command}\n${failure.excerpt}`;
  });

  const notesText = notes.length ? `\nNotes:\n${notes.map((note) => `   ${note}`).join('\n')}` : '';

  return [
    'The sl stop check found build, lint, or clippy problems. Fix every one of them before ending this turn:',
    '',
    numbered.join('\n\n'),
    notesText,
    '',
    'Edit the offending files, then re-run the commands above until each one passes. Do not silence a check by disabling a rule, adding an ignore comment, or deleting failing code unless the user asked for that.'
  ].join('\n');
};

const decodeTurnState = (wire: TurnStateWire | null): TurnState | null => {
  if (!wire || !wire.turn_id || !wire.fingerprint || !Array.isArray(wire.failures)) {
    return null;
  }

  const failures = wire.failures
    .filter((failure) => failure.label && failure.command && failure.excerpt)
    .map((failure) => ({ label: failure.label ?? '', command: failure.command ?? '', excerpt: failure.excerpt ?? '' }));

  return {
    turnId: wire.turn_id,
    fingerprint: wire.fingerprint,
    failures,
    blocks: wire.blocks ?? 0,
    incomplete: wire.incomplete === true
  };
};

const handleEvent = async (event: StopEvent) => {
  if (event.hookEventName !== 'Stop' || process.env.SL_STOP_CHECK === 'off') {
    return {};
  }

  const root = repoRoot(path.resolve(event.cwd));
  const dir = stateRoot();
  const baselineFile = path.join(dir, 'baseline.json');
  const turnFile = path.join(dir, `${digest(`${event.sessionId}\0${root}`)}.json`);
  const baseline = await readJson<Baseline>(baselineFile);
  const tolerated = baseline?.warnings ?? [];
  const turn = await readJson<TurnStateWire>(turnFile);
  const state = decodeTurnState(turn);
  const fingerprint = workingTreeFingerprint(root);

  // A missing baseline forces a fresh evaluation: reusing a cached verdict would seed the baseline from that
  // verdict's empty warning list and make every tolerated warning look new. An incomplete verdict (missing tool
  // or exhausted deadline) is never reused either: a restored tool would stay unchecked, and seeding from a
  // partial warning list would make untouched warnings look new.
  const repeat =
    baseline !== null && !state?.incomplete && state?.turnId === event.turnId && state.fingerprint === fingerprint;

  const outcome = repeat
    ? { failures: state.failures, warnings: [], notes: [], incomplete: false }
    : evaluate(root, tolerated, baseline === null);

  // Hand-backs only accumulate inside one turn, so a new turn always starts with a fresh budget.
  const blocks = state !== null && state.turnId === event.turnId ? state.blocks : 0;

  await writeJson(turnFile, {
    turn_id: event.turnId,
    fingerprint,
    failures: outcome.failures,
    blocks,
    incomplete: outcome.incomplete
  });

  if (baseline === null && !outcome.incomplete) {
    await writeJson(baselineFile, { warnings: [...new Set(outcome.warnings)].toSorted().slice(0, BASELINE_LIMIT) });
  }

  if (!outcome.failures.length) {
    if (outcome.notes.length) {
      return { systemMessage: `sl stop check skipped steps: ${outcome.notes.join('; ')}` };
    }

    return {};
  }

  // Stop with a warning once the budget is spent, or when Codex already handed this turn back but no guard
  // state survived; blocking again would risk an endless hand-back loop.
  if (blocks >= MAX_BLOCKS_PER_TURN || (event.stopHookActive && blocks === 0)) {
    const headline = outcome.failures.map((failure) => `${failure.command}: ${failure.excerpt.split('\n')[0]}`);

    return {
      systemMessage: truncate(
        `sl stop check still fails, so this turn may finish:\n${headline.join('\n')}`,
        SNIPPET_LIMIT
      )
    };
  }

  await writeJson(turnFile, {
    turn_id: event.turnId,
    fingerprint,
    failures: outcome.failures,
    blocks: blocks + 1,
    incomplete: outcome.incomplete
  });

  return { decision: 'block', reason: truncate(continuationPrompt(outcome.failures, outcome.notes), PROMPT_LIMIT) };
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
