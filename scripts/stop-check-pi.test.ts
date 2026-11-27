import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type {
  AgentBeforeSettleEvent,
  AgentEndEvent,
  ExtensionContext,
  SessionEntry
} from '@earendil-works/pi-coding-agent';

import {
  type ChargeHandBack,
  checkRun,
  type HookRequest,
  type HookVerdict,
  lastUserTurnId,
  runStopCheck,
  runUnder,
  settleTurn
} from '../.pi/extensions/sl-stop-check';

const userEntry = (id: string): SessionEntry => ({
  id,
  message: { content: `prompt ${id}`, role: 'user', timestamp: 0 },
  parentId: null,
  timestamp: '2024-12-03T14:00:00.000Z',
  type: 'message'
});

/** Hand-back entries the extension injects are custom messages, so they must never claim the turn id. */
const handbackEntry = (id: string): SessionEntry => ({
  content: 'fix the failures',
  customType: 'sl-stop-check',
  display: true,
  id,
  parentId: null,
  timestamp: '2024-12-03T14:01:00.000Z',
  type: 'custom_message'
});

const assistantEnd = (stopReason: string): AgentEndEvent['messages'][number] =>
  // SAFETY: checkRun reads only role and stopReason from the last message of the run.
  Object.assign(Object.create(null), {
    content: [],
    role: 'assistant',
    stopReason,
    timestamp: 0
  }) as AgentEndEvent['messages'][number];

const endEvent = (stopReason = 'stop'): AgentEndEvent => {
  const base = { messages: [assistantEnd(stopReason)], type: 'agent_end' };

  // SAFETY: checkRun reads only messages from the agent_end event.
  return Object.assign(Object.create(null), base) as AgentEndEvent;
};

const context = (entries: SessionEntry[], opts: { hasUI?: boolean; aborted?: boolean; sessionId?: string } = {}) => {
  const notes: string[] = [];
  const statuses: (string | undefined)[] = [];
  const controller = new AbortController();

  if (opts.aborted) {
    controller.abort();
  }

  const base = {
    hasUI: opts.hasUI ?? true,
    sessionManager: {
      getCwd: () => '/repo',
      getBranch: () => entries,
      getSessionId: () => opts.sessionId ?? 'session-1'
    },
    ui: {
      notify: (message: string) => {
        notes.push(message);
      },
      setStatus: (key: string, text: string | undefined) => {
        statuses.push(text);
      }
    },
    signal: controller.signal
  };

  return {
    // SAFETY: the tests provide every context operation exercised by the extension.
    ctx: Object.assign(Object.create(null), base) as ExtensionContext,
    notes,
    signal: controller.signal,
    statuses
  };
};

const settle = (outcome: 'completed' | 'aborted' | 'error' = 'completed'): AgentBeforeSettleEvent => {
  const base = {
    continue: false,
    context: {
      canContinue: true,
      contextEntries: [],
      contextMessages: [],
      llmMessages: [],
      pendingMessages: []
    },
    entries: [],
    outcome,
    type: 'agent_before_settle'
  };

  // SAFETY: settleTurn reads only outcome and entries from the boundary event.
  return Object.assign(Object.create(null), base) as AgentBeforeSettleEvent;
};

const recorder = (verdict: HookVerdict) => {
  const requests: HookRequest[] = [];
  const signals: (AbortSignal | undefined)[] = [];

  const run = async (request: HookRequest, signal: AbortSignal | undefined) => {
    requests.push(request);
    signals.push(signal);

    return verdict;
  };

  return { requests, run, signals };
};

const chargeRecorder = () => {
  const charges: [string, string, string][] = [];

  const charge: ChargeHandBack = async (sessionId, cwd, turnId) => {
    charges.push([sessionId, cwd, turnId]);
  };

  return { charge, charges };
};

/** A charge that fails the test if settlement reaches it, proving nothing was delivered. */
const forbiddenCharge: ChargeHandBack = async () => {
  throw new Error('settlement charged a hand-back it did not deliver');
};

const brokenRun = async () => {
  throw new Error('bun scripts/stop-check.ts exited 1');
};

// A signal-driven rejection, like the one an interrupt in flight produces.
const abortedRun = async (_request: HookRequest, signal: AbortSignal | undefined) => {
  signal?.throwIfAborted();

  return { decision: 'block', reason: 'fix' };
};

test('checks at agent_end with the live run signal and hands the stored verdict back at settlement', async () => {
  const { ctx, signal, statuses } = context([userEntry('turn-1'), handbackEntry('handback-1')], {
    sessionId: 'hand-back'
  });

  const { requests, run, signals } = recorder({ decision: 'block', reason: 'fix clippy' });
  const { charge, charges } = chargeRecorder();

  await checkRun(endEvent(), ctx, run);

  expect(requests).toHaveLength(1);
  expect(requests[0]?.turn_id).toBe('turn-1');
  expect(requests[0]?.session_id).toBe('hand-back');
  expect(requests[0]?.cwd).toBe('/repo');
  expect(requests[0]?.hook_event_name).toBe('Stop');
  expect(requests[0]?.defer_budget).toBe(true);
  expect(signals[0]).toBe(signal);
  expect(statuses).toEqual(['Checking sl clippy, lint, and types', undefined]);
  expect(charges).toHaveLength(0);

  const result = await settleTurn(settle(), ctx, charge);

  expect(result?.continue).toBe(true);
  expect(result?.entries?.at(-1)).toMatchObject({
    content: 'fix clippy',
    customType: 'sl-stop-check',
    type: 'custom_message'
  });
  expect(charges).toEqual([['hand-back', '/repo', 'turn-1']]);
});

test('a settlement consumes its verdict once, charging the budget once', async () => {
  const { ctx } = context([userEntry('turn-1')], { sessionId: 'consume-once' });
  const { charge, charges } = chargeRecorder();
  await checkRun(endEvent(), ctx, recorder({ decision: 'block', reason: 'fix clippy' }).run);

  expect((await settleTurn(settle(), ctx, charge))?.continue).toBe(true);
  expect(await settleTurn(settle(), ctx, charge)).toBeUndefined();
  expect(charges).toHaveLength(1);
});

test('a stale verdict never spends the budget of a turn opened by a queued follow-up', async () => {
  const { ctx } = context([userEntry('turn-1')], { sessionId: 'fresh-turn' });
  await checkRun(endEvent(), ctx, recorder({ decision: 'block', reason: 'fix clippy' }).run);

  // The branch grew a new user message (a queued follow-up) after the check ran: its own run re-checks later,
  // and the dropped verdict must not have charged anything.
  const { ctx: nextCtx } = context([userEntry('turn-1'), userEntry('turn-2')], { sessionId: 'fresh-turn' });

  expect(await settleTurn(settle(), nextCtx, forbiddenCharge)).toBeUndefined();

  const { requests, run } = recorder({});
  await checkRun(endEvent(), nextCtx, run);

  expect(requests[0]?.turn_id).toBe('turn-2');
});

test('does not resume the agent for informational notes', async () => {
  const { ctx, notes } = context([userEntry('turn-1')], { sessionId: 'notes' });
  await checkRun(
    endEvent(),
    ctx,
    recorder({ systemMessage: 'sl stop check skipped steps: cargo is not installed' }).run
  );

  const result = await settleTurn(settle(), ctx, forbiddenCharge);

  expect(result).toBeUndefined();
  expect(notes).toEqual(['sl stop check skipped steps: cargo is not installed']);
});

test('reports a broken check at settlement without blocking the turn', async () => {
  const { ctx, notes } = context([userEntry('turn-1')], { sessionId: 'broken-check' });

  await checkRun(endEvent(), ctx, brokenRun);

  const result = await settleTurn(settle(), ctx, forbiddenCharge);

  expect(result).toBeUndefined();
  expect(notes).toEqual(['sl stop check could not run: bun scripts/stop-check.ts exited 1']);
});

test('an interrupt during the agent_end check stores nothing, because the aborted run skips settlement', async () => {
  const { ctx } = context([userEntry('turn-1')], { aborted: true, sessionId: 'interrupted' });

  // The run ended normally, but the user interrupted while the check was in flight: the signal-driven
  // rejection stores no verdict, so no settlement can hand work back after the interrupt.
  await checkRun(endEvent(), ctx, abortedRun);

  expect(await settleTurn(settle('aborted'), ctx, forbiddenCharge)).toBeUndefined();
  expect(await settleTurn(settle(), ctx, forbiddenCharge)).toBeUndefined();
});

test('skips checks for runs whose final message aborted or errored', async () => {
  for (const stopReason of ['aborted', 'error']) {
    const { ctx } = context([userEntry('turn-1')], { sessionId: `skip-${stopReason}` });
    const { requests, run } = recorder({ decision: 'block', reason: 'fix' });

    await checkRun(endEvent(stopReason), ctx, run);

    expect(requests).toHaveLength(0);
    expect(await settleTurn(settle(), ctx, forbiddenCharge)).toBeUndefined();
  }
});

test('skips settlement boundaries for aborted and errored outcomes, charging nothing', async () => {
  const { ctx } = context([userEntry('turn-1')], { sessionId: 'skip-outcome' });
  const { charge, charges } = chargeRecorder();
  await checkRun(endEvent(), ctx, recorder({ decision: 'block', reason: 'fix clippy' }).run);

  expect(await settleTurn(settle('aborted'), ctx, charge)).toBeUndefined();
  expect(await settleTurn(settle('error'), ctx, charge)).toBeUndefined();
  expect(charges).toHaveLength(0);

  // The verdict survives outcome-skipped boundaries: the same turn's completed settlement still applies it,
  // charging once, and any run that follows re-checks at its own agent_end.
  expect((await settleTurn(settle(), ctx, charge))?.continue).toBe(true);
  expect(charges).toEqual([['skip-outcome', '/repo', 'turn-1']]);
});

test('skips runs with no user message to charge', async () => {
  const { ctx } = context([handbackEntry('handback-1')], { sessionId: 'no-user' });
  const { requests, run } = recorder({ decision: 'block', reason: 'fix' });

  await checkRun(endEvent(), ctx, run);

  expect(requests).toHaveLength(0);
  expect(await settleTurn(settle(), ctx, forbiddenCharge)).toBeUndefined();
});

test('derives the turn id from the last user message on the branch', () => {
  expect(lastUserTurnId([userEntry('turn-1'), handbackEntry('handback-1')])).toBe('turn-1');
  expect(lastUserTurnId([userEntry('turn-1'), handbackEntry('handback-1'), userEntry('turn-2')])).toBe('turn-2');
  expect(lastUserTurnId([])).toBe('');
});

test('the runner rejects an already-aborted check before attempting to spawn', async () => {
  // A file cannot be the working directory. Attempting a spawn here would fail with an OS error instead.
  const request: HookRequest = {
    cwd: process.execPath,
    defer_budget: true,
    hook_event_name: 'Stop',
    session_id: 'pre-aborted',
    stop_hook_active: false,
    turn_id: 'turn-1'
  };

  const reason = new Error('cancelled before spawn');

  await expect(runStopCheck(request, AbortSignal.abort(reason))).rejects.toBe(reason);
});

const running = (pid: number) => {
  // An unreaped zombie may still have a PID but cannot hold a build lock.
  const { stdout } = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
  const state = stdout.trim();

  return state !== '' && !state.startsWith('Z');
};

test.skipIf(process.platform === 'win32')(
  'cancelling the runner kills a descendant that ignores SIGTERM',
  async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'sl-stop-check-tree-'));
    const script = path.join(cwd, 'check.sh');
    const pidPath = path.join(cwd, 'descendant.pid');
    const controller = new AbortController();
    let descendant = 0;

    try {
      // Redirect the descendant's stdio so the interpreter can close without waiting for it.
      await writeFile(
        script,
        `sh -c 'trap "" TERM; echo "$$" > descendant.tmp; mv descendant.tmp descendant.pid; exec sleep 120' </dev/null >/dev/null 2>&1 &\nwait\n`
      );

      const request: HookRequest = {
        cwd,
        defer_budget: true,
        hook_event_name: 'Stop',
        session_id: 'cancel-tree',
        stop_hook_active: false,
        turn_id: 'turn-1'
      };

      const result = runUnder('sh', request, controller.signal, script).catch((error: Error) => error);
      const readyDeadline = Date.now() + 2000;

      while (!(await Bun.file(pidPath).exists()) && Date.now() < readyDeadline) {
        await Bun.sleep(25);
      }

      descendant = Number((await readFile(pidPath, 'utf8')).trim());
      expect(descendant).toBeGreaterThan(1);
      expect(running(descendant)).toBe(true);

      controller.abort();
      expect(await result).toEqual(new Error('sl stop check was cancelled'));

      const exitDeadline = Date.now() + 2000;

      while (running(descendant) && Date.now() < exitDeadline) {
        await Bun.sleep(25);
      }

      expect(running(descendant)).toBe(false);
    } finally {
      controller.abort();

      if (descendant > 1 && running(descendant)) {
        process.kill(descendant, 'SIGKILL');
      }

      await rm(cwd, { recursive: true, force: true });
    }
  },
  10000
);
