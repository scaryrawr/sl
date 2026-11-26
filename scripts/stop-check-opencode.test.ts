import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Plugin } from '@opencode/plugin';

import plugin, { checkSession, rememberDelivered } from '../.opencode/plugins/sl-stop-check';

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

const fixture = () => {
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
      get: async () => ({ projectID: 'project', time: {}, location: { directory: '/repo' } }),
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
  setMessages([{ type: 'user', id: 'handback', metadata: { slStopCheck: { origin: 'original' } } }]);
  await hooks.get('compaction')?.({ sessionID: 'compacted' });
  setMessages([{ type: 'compaction', id: 'summary' }]);

  const turns: string[] = [];

  const run = async (request: { turn_id: string }) => {
    turns.push(request.turn_id);

    return { decision: 'block', reason: 'fix' };
  };

  await checkSession(ctx, 'compacted', 'first', run);
  setMessages([{ type: 'user', id: 'new-turn' }]);
  await checkSession(ctx, 'compacted', 'second', run);
  await hooks.get('context')?.({ sessionID: 'compacted' });
  setMessages([{ type: 'compaction', id: 'next-summary' }]);
  await hooks.get('compaction')?.({ sessionID: 'compacted' });
  await checkSession(ctx, 'compacted', 'third', run);
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
  setMessages([{ type: 'compaction', id: 'summary' }]);

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
  await cleanup?.();
});

test('claims duplicate events before checks, including staggered deliveries', async () => {
  const { ctx, setMessages } = fixture();
  const other = fixture();
  setMessages([{ type: 'user', id: 'turn' }]);
  other.setMessages([{ type: 'user', id: 'turn' }]);
  let checks = 0;
  const pending = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();

  const run = async () => {
    checks += 1;
    started.resolve();
    await pending.promise;

    return { decision: 'block', reason: 'fix' };
  };

  const first = checkSession(ctx, 'duplicate', 'event', run);
  const second = checkSession(other.ctx, 'duplicate', 'event', run);
  await started.promise;
  await Promise.race([first, second]);
  expect(checks).toBe(1);
  pending.resolve();
  await Promise.all([first, second]);
  await checkSession(other.ctx, 'duplicate', 'event', run);
  await checkSession(ctx, 'duplicate', 'next-event', run);
  expect(checks).toBe(2);
});

test('does not re-charge an event after the check fails', async () => {
  const { ctx, setMessages } = fixture();
  setMessages([{ type: 'user', id: 'turn' }]);
  let checks = 0;

  const run = async () => {
    checks += 1;
    throw new Error('check failed');
  };

  await expect(checkSession(ctx, 'failure', 'event', run)).rejects.toThrow('check failed');
  await checkSession(ctx, 'failure', 'event', run);
  expect(checks).toBe(1);
});

test('does not resume the agent for informational notes', async () => {
  const { ctx, notes, setMessages } = fixture();
  setMessages([{ type: 'user', id: 'turn' }]);
  await checkSession(ctx, 'note', 'event', async () => ({ systemMessage: 'still failing' }));
  expect(notes).toHaveLength(1);
  expect(notes[0]?.resume).toBe(false);
  expect(notes[0]?.description).toBe('still failing');
});
