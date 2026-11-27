import { expect, test } from 'bun:test';

import type {
  AgentBeforeSettleEvent,
  AgentEndEvent,
  ExtensionContext,
  SessionEntry
} from '@earendil-works/pi-coding-agent';

import {
  checkRun,
  type HookRequest,
  type HookVerdict,
  lastUserTurnId,
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

const brokenRun = async () => {
  throw new Error('bun scripts/stop-check.ts exited 1');
};

test('checks at agent_end with the live run signal and hands the stored verdict back at settlement', async () => {
  const { ctx, signal, statuses } = context([userEntry('turn-1'), handbackEntry('handback-1')], {
    sessionId: 'hand-back'
  });

  const { requests, run, signals } = recorder({ decision: 'block', reason: 'fix clippy' });

  await checkRun(endEvent(), ctx, run);

  expect(requests).toHaveLength(1);
  expect(requests[0]?.turn_id).toBe('turn-1');
  expect(requests[0]?.session_id).toBe('hand-back');
  expect(requests[0]?.cwd).toBe('/repo');
  expect(requests[0]?.hook_event_name).toBe('Stop');
  expect(signals[0]).toBe(signal);
  expect(statuses).toEqual(['Checking sl clippy, lint, and types', undefined]);

  const result = await settleTurn(settle(), ctx);

  expect(result?.continue).toBe(true);
  expect(result?.entries?.at(-1)).toMatchObject({
    content: 'fix clippy',
    customType: 'sl-stop-check',
    type: 'custom_message'
  });
});

test('a settlement consumes its verdict once, so a repeat boundary cannot double-charge the turn', async () => {
  const { ctx } = context([userEntry('turn-1')], { sessionId: 'consume-once' });
  await checkRun(endEvent(), ctx, recorder({ decision: 'block', reason: 'fix clippy' }).run);

  expect((await settleTurn(settle(), ctx))?.continue).toBe(true);
  expect(await settleTurn(settle(), ctx)).toBeUndefined();
});

test('a real prompt or queued follow-up opens a fresh turn id and stale verdicts never apply', async () => {
  const { ctx } = context([userEntry('turn-1')], { sessionId: 'fresh-turn' });
  await checkRun(endEvent(), ctx, recorder({ decision: 'block', reason: 'fix clippy' }).run);

  // The branch grew a new user message (a queued follow-up) after the check ran: its own run re-checks later.
  const { ctx: nextCtx } = context([userEntry('turn-1'), userEntry('turn-2')], { sessionId: 'fresh-turn' });

  expect(await settleTurn(settle(), nextCtx)).toBeUndefined();

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

  const result = await settleTurn(settle(), ctx);

  expect(result).toBeUndefined();
  expect(notes).toEqual(['sl stop check skipped steps: cargo is not installed']);
});

test('reports a broken check at settlement without blocking the turn', async () => {
  const { ctx, notes } = context([userEntry('turn-1')], { sessionId: 'broken-check' });

  await checkRun(endEvent(), ctx, brokenRun);

  const result = await settleTurn(settle(), ctx);

  expect(result).toBeUndefined();
  expect(notes).toEqual(['sl stop check could not run: bun scripts/stop-check.ts exited 1']);
});

// A signal-driven rejection, like the one an interrupt in flight produces.
const abortedRun = async (_request: HookRequest, signal: AbortSignal | undefined) => {
  signal?.throwIfAborted();

  return { decision: 'block', reason: 'fix' };
};

test('an interrupt during the agent_end check stores nothing, because the aborted run skips settlement', async () => {
  const { ctx } = context([userEntry('turn-1')], { aborted: true, sessionId: 'interrupted' });

  // The run ended normally, but the user interrupted while the check was in flight: the signal-driven
  // rejection stores no verdict, so no settlement can hand work back after the interrupt.
  await checkRun(endEvent(), ctx, abortedRun);

  expect(await settleTurn(settle('aborted'), ctx)).toBeUndefined();
  expect(await settleTurn(settle(), ctx)).toBeUndefined();
});

test('skips checks for runs whose final message aborted or errored', async () => {
  for (const stopReason of ['aborted', 'error']) {
    const { ctx } = context([userEntry('turn-1')], { sessionId: `skip-${stopReason}` });
    const { requests, run } = recorder({ decision: 'block', reason: 'fix' });

    await checkRun(endEvent(stopReason), ctx, run);

    expect(requests).toHaveLength(0);
    expect(await settleTurn(settle(), ctx)).toBeUndefined();
  }
});

test('skips settlement boundaries for aborted and errored outcomes', async () => {
  const { ctx } = context([userEntry('turn-1')], { sessionId: 'skip-outcome' });
  await checkRun(endEvent(), ctx, recorder({ decision: 'block', reason: 'fix clippy' }).run);

  expect(await settleTurn(settle('aborted'), ctx)).toBeUndefined();
  expect(await settleTurn(settle('error'), ctx)).toBeUndefined();

  // The verdict survives outcome-skipped boundaries: the same turn's completed settlement still applies it,
  // and any run that follows re-checks at its own agent_end.
  expect((await settleTurn(settle(), ctx))?.continue).toBe(true);
});

test('skips runs with no user message to charge', async () => {
  const { ctx } = context([handbackEntry('handback-1')], { sessionId: 'no-user' });
  const { requests, run } = recorder({ decision: 'block', reason: 'fix' });

  await checkRun(endEvent(), ctx, run);

  expect(requests).toHaveLength(0);
  expect(await settleTurn(settle(), ctx)).toBeUndefined();
});

test('derives the turn id from the last user message on the branch', () => {
  expect(lastUserTurnId([userEntry('turn-1'), handbackEntry('handback-1')])).toBe('turn-1');
  expect(lastUserTurnId([userEntry('turn-1'), handbackEntry('handback-1'), userEntry('turn-2')])).toBe('turn-2');
  expect(lastUserTurnId([])).toBe('');
});
