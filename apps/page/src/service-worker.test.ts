import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

type ServiceWorkerListener = (event: unknown) => void;

const listeners = new Map<string, ServiceWorkerListener>();
const originalSelf = globalThis.self;
const originalCaches = globalThis.caches;
const originalFetch = globalThis.fetch;
const originalRequest = globalThis.Request;

let skipWaitingCalls = 0;
let cacheOpenCalls = 0;
let openCache = async () => ({}) as Cache;
let fetchImpl = fetch;

beforeAll(async () => {
  Reflect.set(globalThis, 'self', {
    location: {
      origin: 'https://example.com',
      pathname: '/sl/service-worker.js'
    },
    addEventListener: (type: string, listener: ServiceWorkerListener) => {
      listeners.set(type, listener);
    },
    skipWaiting: () => {
      skipWaitingCalls += 1;
      return Promise.resolve();
    },
    clients: {
      claim: () => Promise.resolve()
    }
  });

  Reflect.set(globalThis, 'caches', {
    open: async () => {
      cacheOpenCalls += 1;
      return openCache();
    },
    keys: async () => [],
    delete: async () => true,
    has: async () => false,
    match: async () => undefined
  } as unknown as CacheStorage);

  Reflect.set(
    globalThis,
    'fetch',
    Object.assign((input: RequestInfo | URL, init?: RequestInit) => fetchImpl(input, init), {
      preconnect: Reflect.get(originalFetch as object, 'preconnect')
    }) as unknown as typeof fetch
  );

  Reflect.set(
    globalThis,
    'Request',
    class RequestWithBase extends Request {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(
          typeof input === 'string' && input.startsWith('/') ? new URL(input, 'https://example.com').toString() : input,
          init
        );
      }
    }
  );

  await import(new URL(`./service-worker.ts?test=${Date.now()}`, import.meta.url).href);
});

afterAll(() => {
  Reflect.set(globalThis, 'self', originalSelf);
  Reflect.set(globalThis, 'caches', originalCaches);
  Reflect.set(globalThis, 'fetch', originalFetch);
  Reflect.set(globalThis, 'Request', originalRequest);
});

beforeEach(() => {
  skipWaitingCalls = 0;
  cacheOpenCalls = 0;
  openCache = async () => ({}) as Cache;
  fetchImpl = originalFetch;
});

describe('service worker regressions', () => {
  test('rejects install when required precaching fails', async () => {
    const installError = new Error('precache failed');
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      openCache = async () =>
        ({
          addAll: async () => {
            throw installError;
          }
        }) as unknown as Cache;

      const installHandler = listeners.get('install');
      expect(installHandler).toBeDefined();

      let installPromise: Promise<unknown> | undefined;
      installHandler?.({
        waitUntil: (promise: Promise<unknown>) => {
          installPromise = promise;
        }
      });

      expect(installPromise).toBeDefined();
      await expect(installPromise).rejects.toBe(installError);
      expect(skipWaitingCalls).toBe(0);
    } finally {
      console.error = originalConsoleError;
    }
  });

  test('redirects offline bare project navigations to the canonical shell URL', async () => {
    openCache = async () =>
      ({
        match: async () =>
          new Response('<!doctype html>', {
            headers: {
              'Content-Type': 'text/html'
            }
          })
      }) as unknown as Cache;
    fetchImpl = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    const fetchHandler = listeners.get('fetch');
    expect(fetchHandler).toBeDefined();

    let responsePromise: Promise<Response> | undefined;
    fetchHandler?.({
      request: {
        destination: 'document',
        method: 'GET',
        mode: 'navigate',
        url: 'https://example.com/sl'
      },
      respondWith: (promise: Promise<Response>) => {
        responsePromise = promise;
      }
    });

    expect(responsePromise).toBeDefined();
    const response = await responsePromise;

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://example.com/sl/');
    expect(cacheOpenCalls).toBe(0);
  });
});
