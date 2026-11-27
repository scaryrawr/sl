/**
 * Pi extension that gives this repo the Stop hook its Codex and Copilot setups install.
 *
 * Pi has no Stop hook protocol, but `agent_before_settle` is the equivalent actionable boundary: it runs after a
 * finished run, before the turn ends, and may append entries and request one more provider request. Each time it
 * fires, this extension runs `scripts/stop-check.ts` in a child process with the same stdin payload and stdout
 * response the Codex and Copilot hook files use.
 *
 * A `{"decision":"block","reason":"..."}` answer becomes a `custom_message` entry carrying the failures plus
 * `continue: true`, which is how Pi keeps the agent working instead of letting the turn end. A `systemMessage` — a
 * spent budget with failures still standing, or steps that could not run — becomes a notification that resumes
 * nothing.
 *
 * `scripts/stop-check.ts` counts hand-backs per turn id, and Pi settle events carry none, so the extension derives
 * one: the entry id of the last user message on the session branch. Hand-back prompts this extension injects are
 * custom messages, not user messages, so a hand-back reports the turn that caused it and a real user prompt — or a
 * queued follow-up — always opens a fresh budget.
 *
 * Pi binds one session to one process, so no cross-instance claim or lock is needed: the per-session counter file
 * `scripts/stop-check.ts` keeps has exactly one writer. Editing this file needs `/reload`, which reloads
 * project-local extensions. Project-local `.pi/extensions` entries load only after the project is trusted.
 *
 * @module sl-stop-check
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AgentBeforeSettleEvent,
  BoundaryResult,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry
} from '@earendil-works/pi-coding-agent';

/** Stop hook payload in the shape `scripts/stop-check.ts` decodes from stdin. */
export interface HookRequest {
  hook_event_name: string;
  session_id: string;
  turn_id: string;
  cwd: string;
  stop_hook_active: boolean;
}

/** Verdict `scripts/stop-check.ts` prints on stdout: a hand-back, a note, or nothing. */
export interface HookVerdict {
  decision?: string;
  reason?: string;
  systemMessage?: string;
}

/** Interpreters able to run a TypeScript file, in the order the Codex and Copilot hook commands try them. */
const RUNTIMES = ['bun', 'node'];

/** Wall-clock limit for one check run, matching the `timeout` both hook files declare. */
const HOOK_TIMEOUT_MS = 900000;

/**
 * `scripts/stop-check.ts`, resolved from this extension's own location. One script holds the checks for every
 * agent, so all four setups share the same steps, budgets, and hand-back wording.
 */
const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'stop-check.ts');

const getErrorMessage = (cause: unknown) => {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
};

/**
 * Runs `scripts/stop-check.ts` once under `runtime` with `request` on stdin.
 *
 * Resolves `null` when `runtime` is not installed here so the caller can try the next one, and rejects when it is
 * installed and the run failed or was cancelled, because a broken check deserves a message rather than a silent pass.
 */
const runUnder = (
  runtime: string,
  request: HookRequest,
  signal: AbortSignal | undefined
): Promise<HookVerdict | null> =>
  new Promise((resolve, reject) => {
    const child = spawn(runtime, [scriptPath], { cwd: request.cwd, signal });
    const timer = setTimeout(() => child.kill('SIGKILL'), HOOK_TIMEOUT_MS);
    let stdout = '';
    let stderr = '';

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });

    // An abort between spawn and first write surfaces here as EPIPE, and an unhandled stdin error would fault
    // the whole Pi process. The child's exit reports the real outcome.
    child.stdin?.on('error', () => {});
    child.stdin?.write(`${JSON.stringify(request)}\n`);
    child.stdin?.end();

    child.on('error', (cause: Error) => {
      clearTimeout(timer);

      // SAFETY: spawn surfaces OS failures as ErrnoException, whose code carries ENOENT for a missing interpreter.
      const code = (cause as NodeJS.ErrnoException).code ?? '';

      if (code === 'ENOENT') {
        resolve(null);

        return;
      }

      reject(new Error(`${runtime} could not run ${scriptPath}: ${getErrorMessage(cause)}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (signal?.aborted) {
        reject(new Error('sl stop check was cancelled'));

        return;
      }

      try {
        // SAFETY: stop-check.ts prints exactly one JSON object on stdout; unparsable output is reported below.
        resolve(JSON.parse(stdout) as HookVerdict);
      } catch (cause) {
        reject(
          new Error(
            `${runtime} ${scriptPath} exited ${code ?? 'on a signal'}: ${stderr.trim() || getErrorMessage(cause)}`
          )
        );
      }
    });
  });

/** Runs the shared checks under the first interpreter that exists here. */
const runStopCheck = async (request: HookRequest, signal: AbortSignal | undefined): Promise<HookVerdict> => {
  for (const runtime of RUNTIMES) {
    const verdict = await runUnder(runtime, request, signal);

    if (verdict !== null) {
      return verdict;
    }
  }

  throw new Error(`${scriptPath} needs bun or node, and neither is installed here`);
};

/**
 * The id the current turn earns for hand-backs: the last user message on the active branch. Injected hand-back
 * prompts are custom messages, so they leave this id alone, and any real prompt or queued follow-up replaces it.
 */
export const lastUserTurnId = (entries: SessionEntry[]) => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];

    if (entry.type === 'message' && entry.message.role === 'user') {
      return entry.id;
    }
  }

  return '';
};

/**
 * Runs the checks for one settled run and turns the verdict into a boundary result.
 *
 * `run` is injected so the tests can stand in for `scripts/stop-check.ts` without paying for a real clippy pass.
 */
export const checkTurn = async (
  event: AgentBeforeSettleEvent,
  ctx: ExtensionContext,
  run: (request: HookRequest, signal: AbortSignal | undefined) => Promise<HookVerdict>
): Promise<BoundaryResult | undefined> => {
  // Aborted and errored runs are not turns worth checking; Pi reports them through its own paths.
  if (event.outcome !== 'completed') {
    return undefined;
  }

  const turnId = lastUserTurnId(ctx.sessionManager.getBranch());

  // A run started without any user message (a bare custom-message trigger on a fresh session) has no turn to charge.
  if (!turnId) {
    return undefined;
  }

  const request: HookRequest = {
    cwd: ctx.sessionManager.getCwd(),
    hook_event_name: 'Stop',
    session_id: ctx.sessionManager.getSessionId(),
    stop_hook_active: false,
    turn_id: turnId
  };

  if (ctx.hasUI) {
    ctx.ui.setStatus('sl-stop-check', 'Checking sl clippy, lint, and types');
  }

  try {
    const verdict = await run(request, ctx.signal);

    if (verdict.decision === 'block' && verdict.reason) {
      return {
        continue: true,
        entries: [
          ...event.entries,
          {
            content: verdict.reason,
            customType: 'sl-stop-check',
            display: true,
            type: 'custom_message'
          }
        ]
      };
    }

    if (verdict.systemMessage) {
      if (ctx.hasUI) {
        ctx.ui.notify(verdict.systemMessage, 'warning');
      } else {
        console.error(verdict.systemMessage);
      }
    }
  } catch (cause: unknown) {
    const message = `sl stop check could not run: ${getErrorMessage(cause)}`;

    if (ctx.hasUI) {
      ctx.ui.notify(message, 'warning');
    } else {
      console.error(message);
    }
  } finally {
    if (ctx.hasUI) {
      ctx.ui.setStatus('sl-stop-check', undefined);
    }
  }

  return undefined;
};

export default function (pi: ExtensionAPI) {
  pi.on('agent_before_settle', async (event, ctx) => checkTurn(event, ctx, runStopCheck));
}
