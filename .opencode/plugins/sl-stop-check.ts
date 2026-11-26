/**
 * OpenCode plugin that gives this repo the Stop hook its Codex and Copilot setups install.
 *
 * OpenCode has no `Stop` hook, so the plugin watches `session.execution.succeeded`, which the server streams when a
 * session finishes running a prompt. Every one of those runs `scripts/stop-check.ts` in a child process with the same
 * stdin payload and stdout response the Codex and Copilot hook files use, so the checks, the hand-back budget, and the
 * repair advice stay in that one script.
 *
 * A `{"decision":"block","reason":"..."}` answer becomes a queued prompt for the same session, which is how OpenCode
 * keeps an agent working instead of letting the turn end. A `systemMessage` — a spent budget with failures still
 * standing, or steps that could not run — becomes a synthetic message, so the user sees it without another turn.
 *
 * `scripts/stop-check.ts` counts hand-backs per turn id, and OpenCode turns carry none, so the plugin derives one from
 * the transcript: the id of the user message that started the turn. Prompts the plugin queues carry that id in message
 * metadata, which OpenCode stores without showing it to the model, so a hand-back reports the turn that caused it and a
 * real user prompt always opens a fresh budget.
 *
 * @module sl-stop-check
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Plugin } from '@opencode/plugin';

/** Stop hook payload in the shape `scripts/stop-check.ts` decodes from stdin. */
interface HookRequest {
  hook_event_name: string;
  session_id: string;
  turn_id: string;
  cwd: string;
  stop_hook_active: boolean;
}

/** Verdict `scripts/stop-check.ts` prints on stdout: a hand-back, a note, or nothing. */
interface HookVerdict {
  decision?: string;
  reason?: string;
  systemMessage?: string;
}

/** Turn marker the plugin stores in the metadata of the prompts it queues. */
interface TurnMark {
  origin?: string;
}

/** Prompt message metadata, as the plugin reads it back out of a session transcript. */
interface PromptMetadata {
  slStopCheck?: TurnMark;
}

/** One session transcript entry, as `ctx.session.context` returns it. */
type TranscriptEntry = Awaited<ReturnType<Plugin.Context['session']['context']>>[number];

/** Interpreters able to run a TypeScript file, in the order the Codex and Copilot hook commands try them. */
const RUNTIMES = ['bun', 'node'];

/** Wall-clock limit for one check run, matching the `timeout` both hook files declare. */
const HOOK_TIMEOUT_MS = 900000;

/**
 * `scripts/stop-check.ts`, resolved from this plugin's own location. One script holds the checks for every agent, and the
 * hand-back counter file it keeps is shared by all plugin instances, so one turn's budget cannot double across instances.
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
 * installed and the run failed, because a broken check deserves a log line rather than a silent pass.
 */
const runUnder = (runtime: string, request: HookRequest): Promise<HookVerdict | null> =>
  new Promise((resolve, reject) => {
    const child = spawn(runtime, [scriptPath], { cwd: request.cwd });
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
    child.stdin.write(`${JSON.stringify(request)}\n`);
    child.stdin.end();

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
const runStopCheck = async (request: HookRequest): Promise<HookVerdict> => {
  for (const runtime of RUNTIMES) {
    const verdict = await runUnder(runtime, request);

    if (verdict !== null) {
      return verdict;
    }
  }

  throw new Error(`${scriptPath} needs bun or node, and neither is installed here`);
};

/**
 * The id one finished execution earns for a hand-back or a note.
 *
 * OpenCode returns the original item when a prompt or synthetic reuses an id, so deriving it from the event makes a
 * redelivered event, or a second plugin instance in the same server, leave one message instead of two.
 */
const messageID = (eventID: string, kind: string) =>
  `msg_${createHash('sha256').update(`${eventID}\0${kind}`).digest('hex').slice(0, 32)}`;

/** The turn id a transcript owes the shared script: a queued hand-back keeps its origin, a real prompt starts its own. */
const turnID = (messages: readonly TranscriptEntry[]): string => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.type !== 'user') {
      continue;
    }

    // SAFETY: message metadata is JSON written by this plugin or a client, and an unreadable shape leaves the marker unset.
    const metadata = message.metadata as PromptMetadata | undefined;

    return metadata?.slStopCheck?.origin ?? message.id;
  }

  return '';
};

/** Runs the checks for one finished execution and hands the failures back, the way the Codex hook blocks a turn. */
const checkSession = async (ctx: Plugin.Context, sessionID: string, eventID: string): Promise<void> => {
  const session = await ctx.session.get({ sessionID });

  // A child session is a subagent task whose parent turn is checked when the parent finishes, an archived session has no
  // turn left to continue, and another project's session belongs to that project's own setup.
  if (session.parentID || session.time.archived || session.projectID !== ctx.location.project.id) {
    return;
  }

  const messages = await ctx.session.context({ sessionID });
  const turnId = turnID(messages);

  if (!turnId) {
    return;
  }

  const verdict = await runStopCheck({
    cwd: session.location.directory,
    hook_event_name: 'Stop',
    session_id: sessionID,
    stop_hook_active: false,
    turn_id: turnId
  });

  if (verdict.decision === 'block' && verdict.reason) {
    await ctx.session.prompt({
      delivery: 'queue',
      id: messageID(eventID, 'handback'),
      metadata: { slStopCheck: { origin: turnId } },
      sessionID,
      text: verdict.reason
    });

    return;
  }

  if (verdict.systemMessage) {
    await ctx.session.synthetic({
      id: messageID(eventID, 'note'),
      sessionID,
      text: verdict.systemMessage
    });
  }
};

export default Plugin.define({
  id: 'sl.stop-check',
  setup(ctx) {
    const controller = new AbortController();

    void (async () => {
      for await (const event of ctx.event.subscribe({
        signal: controller.signal,
        types: ['session.execution.succeeded']
      })) {
        const { sessionID } = event.data;

        // Awaiting inside the loop serialises finished executions, so two runs of the checks never overlap.
        await checkSession(ctx, sessionID, String(event.id)).catch((cause: unknown) => {
          console.error(`sl stop check failed for ${sessionID}: ${getErrorMessage(cause)}`);
        });
      }
    })();

    return () => controller.abort();
  }
});
