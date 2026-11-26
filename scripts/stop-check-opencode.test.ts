import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Plugin } from '@opencode/plugin';

import plugin, { checkSession, completedAgentTurn, rememberDelivered } from '../.opencode/plugins/sl-stop-check';

let home = '';
const originalHome = process.env.CODEX_HOME;

beforeAll(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'sl-stop-check-test-'));
  process.env.CODEX_HOME = home;
});

afterAll(async () => {
  if (originalHome === undefined) {
    delete process.env.CODEX_HOME;
  } else {
    process.env.CODEX_HOME = originalHome;
  }

  await rm(home, { recursive: true, force: true });
});

const fixture = (directory = '/repo') => {
  const saved = new Map<string, string>();

  const hooks = new Map<
    string,
    (event: { sessionID: string; messageID?: string; metadata?: { slStopCheck: { origin: string } } }) => Promise<void>
  >();

  const prompts: { metadata: { slStopCheck: { origin: string } } }[] = [];
  const notes: { resume?: boolean; description?: string }[] = [];
  let messages: { type: string; id: string; metadata?: object }[] = [];

  const context = {
    location: { project: { id: 'project' } },
    storage: {
      get: async (key: string) => saved.get(key),
      set: async (key: string, value: string) => {
        saved.set(key, value);
      },
      scan: async ({ prefix }: { prefix: string }) => ({
        entries: [...saved.entries()].flatMap(([key, value]) => (key.startsWith(prefix) ? [{ key, value }] : []))
      })
    },
    event: { subscribe: async function* () {} },
    session: {
      get: async () => ({ projectID: 'project', time: {}, location: { directory } }),
      context: async () => messages,
      hook: async (
        name: string,
        callback: (event: {
          sessionID: string;
          messageID?: string;
          metadata?: { slStopCheck: { origin: string } };
        }) => Promise<void>
      ) => {
        hooks.set(name, callback);

        return { dispose: async () => {} };
      },
      prompt: async (prompt: { metadata: { slStopCheck: { origin: string } } }) => {
        prompts.push(prompt);
      },
      synthetic: async (note: { resume?: boolean; description?: string }) => {
        notes.push(note);
      }
    }
  };

  return {
    // SAFETY: the tests provide every context operation exercised by the plugin.
    ctx: Object.assign(Object.create(null), context) as Plugin.Context,
    hooks,
    prompts,
    notes,
    setMessages: (value: typeof messages) => {
      messages = value;
    }
  };
};

test('preserves the original turn across compaction and uses a new user turn', async () => {
  const { ctx, hooks, prompts, setMessages } = fixture();
  const cleanup = await plugin.setup(ctx);
  await hooks.get('prompt')?.({
    sessionID: 'compacted',
    messageID: 'handback',
    metadata: { slStopCheck: { origin: 'original' } }
  });
  await rememberDelivered(ctx, 'compacted', 'handback', 10);
  setMessages([{ type: 'user', id: 'handback', metadata: { slStopCheck: { origin: 'original' } } }]);
  setMessages([{ type: 'compaction', id: 'summary' }]);

  const turns: string[] = [];

  const run = async (request: { turn_id: string }) => {
    turns.push(request.turn_id);

    return { decision: 'block', reason: 'fix' };
  };

  await checkSession(ctx, 'compacted', 'first', run, 15);
  setMessages([{ type: 'user', id: 'new-turn' }]);
  await hooks.get('prompt')?.({ sessionID: 'compacted', messageID: 'new-turn' });
  await rememberDelivered(ctx, 'compacted', 'new-turn', 20);
  await checkSession(ctx, 'compacted', 'second', run, 25);
  setMessages([{ type: 'compaction', id: 'next-summary' }]);
  await checkSession(ctx, 'compacted', 'third', run, 30);
  expect(turns).toEqual(['original', 'new-turn', 'new-turn']);
  expect(prompts.map((prompt) => prompt.metadata.slStopCheck.origin)).toEqual(turns);
  await cleanup?.();
});

test('tracks delivered prompts even when precomputed compaction skips model hooks', async () => {
  const { ctx, hooks, setMessages } = fixture();
  const cleanup = await plugin.setup(ctx);
  const sessionID = 'precomputed';
  await hooks.get('prompt')?.({ sessionID, messageID: 'first' });
  await hooks.get('prompt')?.({ sessionID, messageID: 'queued' });
  await rememberDelivered(ctx, sessionID, 'first', 10);
  setMessages([{ type: 'user', id: 'queued' }]);

  const turns: string[] = [];

  const run = async (request: { turn_id: string }) => {
    turns.push(request.turn_id);

    return {};
  };

  await rememberDelivered(ctx, sessionID, 'queued', 20);
  await rememberDelivered(ctx, sessionID, 'first', 10);
  await checkSession(ctx, sessionID, 'one', run, 15);
  await checkSession(ctx, sessionID, 'two', run, 25);
  expect(turns).toEqual(['first', 'queued']);
  await rememberDelivered(ctx, sessionID, 'unknown', 30);
  await checkSession(ctx, sessionID, 'three', run, 35);
  expect(turns).toEqual(['first', 'queued']);
  await cleanup?.();
});

test('claims duplicate events before checks, including staggered deliveries', async () => {
  const { ctx, setMessages } = fixture();
  const other = fixture();
  setMessages([{ type: 'user', id: 'turn' }]);
  other.setMessages([{ type: 'user', id: 'turn' }]);
  await ctx.storage.set('sl-stop-check/prompt/duplicate/turn', 'turn');
  await other.ctx.storage.set('sl-stop-check/prompt/duplicate/turn', 'turn');
  await rememberDelivered(ctx, 'duplicate', 'turn', 1);
  await rememberDelivered(other.ctx, 'duplicate', 'turn', 1);
  let checks = 0;
  const pending = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();

  const run = async () => {
    checks += 1;
    started.resolve();
    await pending.promise;

    return { decision: 'block', reason: 'fix' };
  };

  const first = checkSession(ctx, 'duplicate', 'event', run, 2);
  const second = checkSession(other.ctx, 'duplicate', 'event', run, 2);
  await started.promise;
  await Promise.race([first, second]);
  expect(checks).toBe(1);
  pending.resolve();
  await Promise.all([first, second]);
  await checkSession(other.ctx, 'duplicate', 'event', run, 2);
  await checkSession(ctx, 'duplicate', 'next-event', run, 3);
  expect(checks).toBe(2);
});

test('does not re-charge an event after the check fails', async () => {
  const { ctx, setMessages } = fixture();
  setMessages([{ type: 'user', id: 'turn' }]);
  await ctx.storage.set('sl-stop-check/prompt/failure/turn', 'turn');
  await rememberDelivered(ctx, 'failure', 'turn', 1);
  let checks = 0;

  const run = async () => {
    checks += 1;
    throw new Error('check failed');
  };

  await expect(checkSession(ctx, 'failure', 'event', run, 2)).rejects.toThrow('check failed');
  await checkSession(ctx, 'failure', 'event', run, 2);
  expect(checks).toBe(1);
});

test('does not resume the agent for informational notes', async () => {
  const { ctx, notes, setMessages } = fixture();
  setMessages([{ type: 'user', id: 'turn' }]);
  await ctx.storage.set('sl-stop-check/prompt/note/turn', 'turn');
  await rememberDelivered(ctx, 'note', 'turn', 1);
  await checkSession(ctx, 'note', 'event', async () => ({ systemMessage: 'still failing' }), 2);
  expect(notes).toHaveLength(1);
  expect(notes[0]?.resume).toBe(false);
  expect(notes[0]?.description).toBe('still failing');
});

test('only checks successful executions that ran a model step', () => {
  const stepped = new Set<string>();
  expect(completedAgentTurn(stepped, 'session', 'session.execution.started')).toBe(false);
  expect(completedAgentTurn(stepped, 'session', 'session.execution.succeeded')).toBe(false);
  expect(completedAgentTurn(stepped, 'session', 'session.step.ended')).toBe(false);
  expect(completedAgentTurn(stepped, 'session', 'session.execution.succeeded')).toBe(true);
  expect(completedAgentTurn(stepped, 'session', 'session.execution.succeeded')).toBe(false);
  completedAgentTurn(stepped, 'session', 'session.step.ended');
  expect(completedAgentTurn(stepped, 'session', 'session.execution.interrupted')).toBe(false);
  expect(completedAgentTurn(stepped, 'session', 'session.execution.succeeded')).toBe(false);
});

test('serializes distinct events from separate instances for the same session', async () => {
  const root = path.resolve(import.meta.dir, '..');
  const first = fixture(root);
  const second = fixture(path.join(root, 'scripts'));

  for (const { ctx } of [first, second]) {
    await ctx.storage.set('sl-stop-check/prompt/lock/turn', 'turn');
    await rememberDelivered(ctx, 'lock', 'turn', 1);
  }

  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let active = 0;
  let maxActive = 0;
  let checks = 0;

  const run = async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    checks += 1;
    entered.resolve();
    await release.promise;
    active -= 1;

    return {};
  };

  const firstCheck = checkSession(first.ctx, 'lock', 'first', run, 2);
  await entered.promise;
  const secondCheck = checkSession(second.ctx, 'lock', 'second', run, 3);
  await Bun.sleep(200);
  expect(checks).toBe(1);
  release.resolve();
  await Promise.all([firstCheck, secondCheck]);
  expect(checks).toBe(2);
  expect(maxActive).toBe(1);
});
