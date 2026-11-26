/**
 * OpenCode plugin that gives this repo the Stop hook its Codex and Copilot setups install.
 *
 * OpenCode has no `Stop` hook, so the plugin watches `session.execution.succeeded`, which the server streams when a
 * session finishes running a prompt. Executions with a completed model step run `scripts/stop-check.ts` in a child
 * process with the same stdin payload and stdout response the Codex and Copilot hook files use.
 *
 * A `{"decision":"block","reason":"..."}` answer becomes a queued prompt for the same session, which is how OpenCode
 * keeps an agent working instead of letting the turn end. A `systemMessage` — a spent budget with failures still
 * standing, or steps that could not run — becomes a non-resuming synthetic message.
 *
 * `scripts/stop-check.ts` counts hand-backs per turn id, and OpenCode turns carry none, so the plugin derives one from
 * prompt delivery: the id of the user message that started the turn. Prompts the plugin queues carry that id in message
 * metadata, which OpenCode stores without showing it to the model, so a hand-back reports the turn that caused it and a
 * real user prompt always opens a fresh budget. Prompt delivery records preserve that id across compaction.
 *
 * @module sl-stop-check
 */

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, rmdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
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
const responseID = (eventID: string, kind: string) =>
  `msg_${createHash('sha256').update(`${eventID}\0${kind}`).digest('hex').slice(0, 32)}`;

const promptKey = (sessionID: string, messageID: string) => `sl-stop-check/prompt/${sessionID}/${messageID}`;
const deliveryPrefix = (sessionID: string) => `sl-stop-check/delivery/${sessionID}/`;

export const rememberDelivered = async (
  ctx: Plugin.Context,
  sessionID: string,
  messageID: string,
  sequence: number
): Promise<void> => {
  const key = promptKey(sessionID, messageID);
  const turnId = await ctx.storage.get(key);

  await ctx.storage.set(`${deliveryPrefix(sessionID)}${String(sequence).padStart(16, '0')}`, turnId ?? '');
};

const deliveredTurn = async (ctx: Plugin.Context, sessionID: string, sequence: number): Promise<string> => {
  const prefix = deliveryPrefix(sessionID);
  let after: string | undefined;
  let latest = -1;
  let turnId = '';

  do {
    const page = await ctx.storage.scan({ prefix, after });

    page.entries.forEach((entry) => {
      const current = Number(entry.key.slice(prefix.length));

      if (current <= sequence && current > latest) {
        latest = current;
        // SAFETY: this plugin stores only a turn ID string at delivery keys.
        turnId = entry.value as string;
      }
    });
    after = page.next;
  } while (after);

  return turnId;
};

/** Claim an event across plugin instances before it can consume a hand-back allowance. Claims survive errors and restarts. */
const claimEvent = async (sessionID: string, eventID: string, cwd: string): Promise<string | null> => {
  const home = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
  const directory = path.join(home, 'cache', 'sl-stop-check', 'opencode-events');
  const id = createHash('sha256').update(`${cwd}\0${sessionID}\0${eventID}`).digest('hex');
  const file = path.join(directory, id);

  await mkdir(directory, { recursive: true, mode: 0o700 });

  try {
    await writeFile(file, '', { flag: 'wx', mode: 0o600 });

    return file;
  } catch (cause) {
    // SAFETY: filesystem errors carry an errno code, including EEXIST when another instance claimed the event.
    if ((cause as NodeJS.ErrnoException).code === 'EEXIST') {
      return null;
    }

    throw cause;
  }
};

/** Serialize the shared counter across instances, failing closed if a crashed owner left a lock behind. */
const withSessionLock = async <T>(sessionID: string, cwd: string, work: () => Promise<T>): Promise<T> => {
  let root: string;

  try {
    root = path.resolve(
      execFileSync('git', ['rev-parse', '--show-toplevel'], {
        cwd,
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim()
    );
  } catch {
    root = path.resolve(path.dirname(scriptPath), '..');
  }

  const home = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
  const directory = path.join(home, 'cache', 'sl-stop-check', 'opencode-locks');
  const id = createHash('sha256').update(`${sessionID}\0${root}`).digest('hex');
  const lock = path.join(directory, id);
  const deadline = Date.now() + HOOK_TIMEOUT_MS;
  await mkdir(directory, { recursive: true, mode: 0o700 });

  while (true) {
    try {
      await mkdir(lock, { mode: 0o700 });
      break;
    } catch (cause) {
      // SAFETY: EEXIST means another process holds the atomic directory lock.
      if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw cause;
      }

      if (Date.now() >= deadline) {
        throw new Error(`timed out waiting for stop-check lock ${lock}; remove it if its owner has stopped`, { cause });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  try {
    return await work();
  } finally {
    await rmdir(lock);
  }
};

export const completedAgentTurn = (stepped: Set<string>, sessionID: string, type: string): boolean => {
  if (type === 'session.step.ended') {
    stepped.add(sessionID);

    return false;
  }

  if (type === 'session.execution.started') {
    stepped.delete(sessionID);

    return false;
  }

  const hadStep = stepped.delete(sessionID);

  return type === 'session.execution.succeeded' && hadStep;
};

/** Runs the checks for one finished execution and hands the failures back, the way the Codex hook blocks a turn. */
export const checkSession = async (
  ctx: Plugin.Context,
  sessionID: string,
  eventID: string,
  run: typeof runStopCheck,
  sequence: number
): Promise<void> => {
  const session = await ctx.session.get({ sessionID });

  // A child session is a subagent task whose parent turn is checked when the parent finishes, an archived session has no
  // turn left to continue, and another project's session belongs to that project's own setup.
  if (session.parentID || session.time.archived || session.projectID !== ctx.location.project.id) {
    return;
  }

  const turnId = await deliveredTurn(ctx, sessionID, sequence);

  if (!turnId) {
    return;
  }

  const claim = await claimEvent(sessionID, eventID, session.location.directory);

  if (!claim) {
    return;
  }

  const verdict = await withSessionLock(sessionID, session.location.directory, () =>
    run({
      cwd: session.location.directory,
      hook_event_name: 'Stop',
      session_id: sessionID,
      stop_hook_active: false,
      turn_id: turnId
    })
  );

  if (verdict.decision === 'block' && verdict.reason) {
    await ctx.session.prompt({
      delivery: 'queue',
      id: responseID(eventID, 'handback'),
      metadata: { slStopCheck: { origin: turnId } },
      sessionID,
      text: verdict.reason
    });

    return;
  }

  if (verdict.systemMessage) {
    await ctx.session.synthetic({
      description: verdict.systemMessage,
      id: responseID(eventID, 'note'),
      resume: false,
      sessionID,
      text: verdict.systemMessage
    });
  }
};

export default Plugin.define({
  id: 'sl.stop-check',
  async setup(ctx) {
    const controller = new AbortController();

    const prompt = await ctx.session.hook('prompt', async ({ sessionID, messageID, metadata }) => {
      try {
        // SAFETY: prompt metadata is JSON written by this plugin or a client.
        const mark = metadata as PromptMetadata | undefined;

        await ctx.storage.set(promptKey(sessionID, messageID), mark?.slStopCheck?.origin ?? messageID);
      } catch (cause) {
        console.error(`sl stop check could not save prompt for ${sessionID}: ${getErrorMessage(cause)}`);
      }
    });

    void (async () => {
      const stepped = new Set<string>();

      for await (const event of ctx.event.subscribe({
        signal: controller.signal,
        types: [
          'session.inbox.delivered',
          'session.execution.started',
          'session.step.ended',
          'session.execution.succeeded',
          'session.execution.failed',
          'session.execution.interrupted'
        ]
      })) {
        const { sessionID } = event.data;

        if (event.type === 'session.inbox.delivered') {
          await rememberDelivered(ctx, sessionID, event.data.inboxID, event.durable.seq).catch((cause: unknown) => {
            console.error(`sl stop check could not save delivered turn for ${sessionID}: ${getErrorMessage(cause)}`);
          });
          continue;
        }

        if (!completedAgentTurn(stepped, sessionID, event.type) || event.type !== 'session.execution.succeeded') {
          continue;
        }

        await checkSession(ctx, sessionID, String(event.id), runStopCheck, event.durable.seq).catch(
          (cause: unknown) => {
            console.error(`sl stop check failed for ${sessionID}: ${getErrorMessage(cause)}`);
          }
        );
      }
    })();

    return async () => {
      controller.abort();
      await prompt.dispose();
    };
  }
});
