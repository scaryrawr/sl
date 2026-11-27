import { expect, test } from 'bun:test';

import type {
  AgentActivityOutcome,
  AgentBeforeSettleEvent,
  ExtensionContext,
  SessionEntry
} from '@earendil-works/pi-coding-agent';

import { checkTurn, type HookRequest, type HookVerdict, lastUserTurnId } from '../.pi/extensions/sl-stop-check';

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

const context = (entries: SessionEntry[], hasUI = true) => {
  const notes: string[] = [];
  const statuses: (string | undefined)[] = [];

  const base = {
    hasUI,
    sessionManager: {
      getCwd: () => '/repo',
      getBranch: () => entries,
      getSessionId: () => 'session-1'
    },
    ui: {
      notify: (message: string) => {
        notes.push(message);
      },
      setStatus: (key: string, text: string | undefined) => {
        statuses.push(text);
      }
    },
    signal: undefined
  };

  return {
    // SAFETY: the tests provide every context operation exercised by the extension.
    ctx: Object.assign(Object.create(null), base) as ExtensionContext,
    notes,
    statuses
  };
};

const settle = (outcome: AgentActivityOutcome = 'completed'): AgentBeforeSettleEvent => {
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

  // SAFETY: checkTurn reads only outcome, entries, and continue from the boundary event.
  return Object.assign(Object.create(null), base) as AgentBeforeSettleEvent;
};

const recorder = (verdict: HookVerdict) => {
  const requests: HookRequest[] = [];

  const run = async (request: HookRequest) => {
    requests.push(request);

    return verdict;
  };

  return { requests, run };
};

test('charges the hand-back to the turn that started the run, not to its own injected messages', async () => {
  const { ctx } = context([userEntry('turn-1'), handbackEntry('handback-1')]);
  const { requests, run } = recorder({ decision: 'block', reason: 'fix clippy' });

  const result = await checkTurn(settle(), ctx, run);

  expect(requests).toHaveLength(1);
  expect(requests[0]?.turn_id).toBe('turn-1');
  expect(requests[0]?.session_id).toBe('session-1');
  expect(requests[0]?.cwd).toBe('/repo');
  expect(requests[0]?.hook_event_name).toBe('Stop');
  expect(result?.continue).toBe(true);
  expect(result?.entries?.at(-1)).toMatchObject({
    content: 'fix clippy',
    customType: 'sl-stop-check',
    type: 'custom_message'
  });
});

test('a real prompt or queued follow-up opens a fresh turn id', async () => {
  const { ctx } = context([userEntry('turn-1'), handbackEntry('handback-1'), userEntry('turn-2')]);
  const { requests, run } = recorder({});

  await checkTurn(settle(), ctx, run);

  expect(requests[0]?.turn_id).toBe('turn-2');
});

test('does not resume the agent for informational notes', async () => {
  const { ctx, notes, statuses } = context([userEntry('turn-1')]);
  const { run } = recorder({ systemMessage: 'sl stop check skipped steps: cargo is not installed here' });

  const result = await checkTurn(settle(), ctx, run);

  expect(result).toBeUndefined();
  expect(notes).toEqual(['sl stop check skipped steps: cargo is not installed here']);
  expect(statuses).toEqual(['Checking sl clippy, lint, and types', undefined]);
});

const brokenRun = async () => {
  throw new Error('bun scripts/stop-check.ts exited 1');
};

test('reports a broken check without blocking the turn', async () => {
  const { ctx, notes } = context([userEntry('turn-1')]);

  const result = await checkTurn(settle(), ctx, brokenRun);

  expect(result).toBeUndefined();
  expect(notes).toEqual(['sl stop check could not run: bun scripts/stop-check.ts exited 1']);
});

test('skips aborted and errored runs', async () => {
  const outcomes: AgentActivityOutcome[] = ['aborted', 'error'];

  for (const outcome of outcomes) {
    const { ctx } = context([userEntry('turn-1')]);
    const { requests, run } = recorder({ decision: 'block', reason: 'fix' });

    const result = await checkTurn(settle(outcome), ctx, run);

    expect(requests).toHaveLength(0);
    expect(result).toBeUndefined();
  }
});

test('skips runs with no user message to charge', async () => {
  const { ctx } = context([handbackEntry('handback-1')]);
  const { requests, run } = recorder({ decision: 'block', reason: 'fix' });

  const result = await checkTurn(settle(), ctx, run);

  expect(requests).toHaveLength(0);
  expect(result).toBeUndefined();
});

test('derives the turn id from the last user message on the branch', () => {
  expect(lastUserTurnId([userEntry('turn-1'), handbackEntry('handback-1')])).toBe('turn-1');
  expect(lastUserTurnId([userEntry('turn-1'), handbackEntry('handback-1'), userEntry('turn-2')])).toBe('turn-2');
  expect(lastUserTurnId([])).toBe('');
});
