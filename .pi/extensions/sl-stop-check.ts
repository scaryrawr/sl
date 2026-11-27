/**
 * Pi extension that gives this repo the Stop hook its Codex and Copilot setups install.
 *
 * Pi has no Stop hook protocol, and its settlement boundary cannot host the checks: `ctx.signal` is bound to the
 * active agent run, and the run is finished before settlement, so a subprocess started there cannot be cancelled —
 * pressing Esc would leave it running until it finishes or times out. Instead the checks run at `agent_end`, where
 * the run is still active and its signal is live, so the same `app.interrupt` (Esc) path that aborts a running turn
 * terminates the subprocess. `agent_before_settle`, the actionable boundary that may append entries and request one
 * more provider request, then consumes that verdict without spawning anything itself.
 *
 * A `{"decision":"block","reason":"..."}` answer becomes a `custom_message` entry carrying the failures plus
 * `continue: true`, which is how Pi keeps the agent working instead of letting the turn end. A `systemMessage` — a
 * spent budget with failures still standing, or steps that could not run — becomes a notification that resumes
 * nothing. An aborted run skips settlement entirely, and an errored one skips the check, because Pi continues those
 * runs through its own retry paths.
 *
 * Two lifecycles separate here on purpose. Processes: the interpreter spawns detached, so cancellation signals
 * reach the whole process group and an in-flight cargo, rustc, or tsgolint from the script's `spawnSync` steps
 * cannot survive an interrupt holding build locks. Budget: `scripts/stop-check.ts` counts hand-backs per turn id,
 * and Pi events carry none, so the extension derives one — the entry id of the last user message on the session
 * branch — while the payload defers the budget charge, and settlement calls `chargeHandBack` only when it actually
 * emits the hand-back. Pi can start another run before settlement and overwrite the stored verdict, so an
 * evaluation nobody delivered never spends the turn's allowance. Hand-back prompts this extension injects are
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
import type { ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AgentBeforeSettleEvent,
  AgentEndEvent,
  BoundaryResult,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry
} from '@earendil-works/pi-coding-agent';

import { chargeHandBack } from '../../scripts/stop-check';

/** Stop hook payload in the shape `scripts/stop-check.ts` decodes from stdin. */
export interface HookRequest {
  hook_event_name: string;
  session_id: string;
  turn_id: string;
  cwd: string;
  stop_hook_active: boolean;
  /** The verdict is only delivered at settlement, which may drop it, so the budget charge is deferred. */
  defer_budget: boolean;
}

/** Charges one delivered hand-back to the turn's budget in the shared counter file. */
export type ChargeHandBack = (sessionId: string, cwd: string, turnId: string) => Promise<void>;

/** Verdict `scripts/stop-check.ts` prints on stdout: a hand-back, a note, or nothing. */
export interface HookVerdict {
  decision?: string;
  reason?: string;
  systemMessage?: string;
}

/** A computed verdict, held between `agent_end` and the settlement boundary that consumes it. */
export interface StoredVerdict {
  turnId: string;
  verdict: HookVerdict;
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

/** Verdicts computed at `agent_end`, keyed by session id. Pi binds one session to one process, so nothing else writes. */
const storedVerdicts = new Map<string, StoredVerdict>();

const getErrorMessage = (cause: unknown) => {
  if (cause instanceof Error) {
    return cause.message;
  }

  return String(cause);
};

/**
 * Terminates the check interpreter and everything it launched. `scripts/stop-check.ts` runs its steps through
 * `spawnSync`, so killing only the interpreter would leave cargo, rustc, or tsgolint running with build locks held.
 * On POSIX the interpreter is a process-group leader (spawned detached) and the whole group gets the signal; on
 * Windows `taskkill /T` walks the tree.
 */
const killTree = (child: ChildProcess) => {
  if (child.pid === undefined) {
    child.kill('SIGKILL');

    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });

    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // ESRCH: the group is already gone; the child's close event reports the outcome.
    child.kill('SIGKILL');
  }
};

/**
 * Runs `scripts/stop-check.ts` once under `runtime` with `request` on stdin.
 *
 * Resolves `null` when `runtime` is not installed here so the caller can try the next one, and rejects when it is
 * installed and the run failed or was cancelled, because a broken check deserves a message rather than a silent pass.
 * Cancellation and timeout terminate the whole process tree, not just the interpreter.
 */
export const runUnder = (
  runtime: string,
  request: HookRequest,
  signal: AbortSignal | undefined,
  checkScript = scriptPath
): Promise<HookVerdict | null> =>
  new Promise((resolve, reject) => {
    // Detached on POSIX so the interpreter leads its own process group and killTree can signal the whole tree.
    const child = spawn(runtime, [checkScript], { cwd: request.cwd, detached: process.platform !== 'win32' });
    // Kill the group immediately: the interpreter can close its pipes before a descendant that ignores SIGTERM exits.
    const onAbort = () => killTree(child);
    const timer = setTimeout(onAbort, HOOK_TIMEOUT_MS);
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

    signal?.addEventListener('abort', onAbort, { once: true });

    // An abort between spawn and first write surfaces here as EPIPE, and an unhandled stdin error would fault
    // the whole Pi process. The child's exit reports the real outcome.
    child.stdin?.on('error', () => {});
    child.stdin?.write(`${JSON.stringify(request)}\n`);
    child.stdin?.end();

    child.on('error', (cause: Error) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);

      // SAFETY: spawn surfaces OS failures as ErrnoException, whose code carries ENOENT for a missing interpreter.
      const code = (cause as NodeJS.ErrnoException).code ?? '';

      if (code === 'ENOENT') {
        resolve(null);

        return;
      }

      reject(new Error(`${runtime} could not run ${checkScript}: ${getErrorMessage(cause)}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);

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
            `${runtime} ${checkScript} exited ${code ?? 'on a signal'}: ${stderr.trim() || getErrorMessage(cause)}`
          )
        );
      }
    });
  });

/** Runs the shared checks under the first interpreter that exists here. */
export const runStopCheck = async (request: HookRequest, signal: AbortSignal | undefined): Promise<HookVerdict> => {
  for (const runtime of RUNTIMES) {
    // Abort listeners do not replay earlier cancellations. Check before each spawn, including the fallback.
    signal?.throwIfAborted();

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
 * Runs the checks for one finished low-level run and stores the verdict for the settlement boundary.
 *
 * This is the event where Pi's run signal is still live, so the subprocess honors the same Esc interrupt that
 * aborts a running turn. `run` is injected so tests can stand in for `scripts/stop-check.ts` without paying for a
 * real clippy pass.
 */
export const checkRun = async (
  event: AgentEndEvent,
  ctx: ExtensionContext,
  run: (request: HookRequest, signal: AbortSignal | undefined) => Promise<HookVerdict>
) => {
  const sessionId = ctx.sessionManager.getSessionId();
  const last = event.messages.at(-1);

  // Aborted runs skip settlement entirely, and errored ones continue through Pi's retry paths: neither owes a check.
  if (last?.role === 'assistant' && (last.stopReason === 'aborted' || last.stopReason === 'error')) {
    storedVerdicts.delete(sessionId);

    return;
  }

  const turnId = lastUserTurnId(ctx.sessionManager.getBranch());

  // A run started without any user message (a bare custom-message trigger on a fresh session) has no turn to charge.
  if (!turnId) {
    return;
  }

  const request: HookRequest = {
    cwd: ctx.sessionManager.getCwd(),
    defer_budget: true,
    hook_event_name: 'Stop',
    session_id: sessionId,
    stop_hook_active: false,
    turn_id: turnId
  };

  if (ctx.hasUI) {
    ctx.ui.setStatus('sl-stop-check', 'Checking sl clippy, lint, and types');
  }

  try {
    const verdict = await run(request, ctx.signal);
    storedVerdicts.set(sessionId, { turnId, verdict });
  } catch (cause: unknown) {
    const message = getErrorMessage(cause);

    if (ctx.signal?.aborted) {
      // The user interrupted; Pi skips settlement for the aborted run, so nothing is stored.
      return;
    }

    // A broken check is reported at settlement as a note, never as a hand-back, so a missing tool cannot block a turn.
    storedVerdicts.set(sessionId, { turnId, verdict: { systemMessage: `sl stop check could not run: ${message}` } });
  } finally {
    if (ctx.hasUI) {
      ctx.ui.setStatus('sl-stop-check', undefined);
    }
  }
};

/**
 * Applies the stored verdict at the settlement boundary: a hand-back charges the budget through `charge` and
 * requests one more provider request, a note resumes nothing. This handler never spawns, so no subprocess can
 * outlive an interrupt during settlement, and a verdict the settlement drops never spends the turn's budget.
 */
export const settleTurn = async (
  event: AgentBeforeSettleEvent,
  ctx: ExtensionContext,
  charge: ChargeHandBack
): Promise<BoundaryResult | undefined> => {
  // Aborted and errored runs are not turns worth checking; Pi reports them through its own paths.
  if (event.outcome !== 'completed') {
    return undefined;
  }

  const turnId = lastUserTurnId(ctx.sessionManager.getBranch());

  if (!turnId) {
    return undefined;
  }

  const sessionId = ctx.sessionManager.getSessionId();
  const stored = storedVerdicts.get(sessionId);

  if (!stored || stored.turnId !== turnId) {
    return undefined;
  }

  storedVerdicts.delete(sessionId);

  const { verdict } = stored;

  if (verdict.decision === 'block' && verdict.reason) {
    // Budget accounting is charged here, at delivery, not when the verdict was evaluated: Pi can start another
    // run before settlement and overwrite this verdict, and an evaluation nobody delivered must not spend the turn.
    await charge(sessionId, ctx.sessionManager.getCwd(), turnId);

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

  return undefined;
};

export default function (pi: ExtensionAPI) {
  pi.on('agent_end', async (event, ctx) => {
    await checkRun(event, ctx, runStopCheck);
  });

  pi.on('agent_before_settle', async (event, ctx) => settleTurn(event, ctx, chargeHandBack));

  pi.on('session_shutdown', async (_event, ctx) => {
    storedVerdicts.delete(ctx.sessionManager.getSessionId());
  });
}
