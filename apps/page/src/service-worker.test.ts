import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

/** The `install` event handed to the service worker's install handler. */
type InstallEventLike = {
  waitUntil: (promise: Promise<unknown>) => void;
};

/** The `fetch` event handed to the service worker's fetch handler. */
type FetchEventLike = {
  request: { destination: string; method: string; mode: string; url: string };
  respondWith: (promise: Promise<Response>) => void;
};

/** Event shape accepted by the service worker's lifecycle handlers. */
type ServiceWorkerEvent = InstallEventLike | FetchEventLike;

/** Handler the fake `self.addEventListener` records per event type. */
type ServiceWorkerListener = (event: ServiceWorkerEvent) => void;

/**
 * Cache surface used by tests. The service worker only calls `addAll`/`match`,
 * so fake caches implement just those members.
 */
type FakeCache = {
  addAll?: (requests: (RequestInfo | URL)[]) => Promise<void>;
  match?: (request: RequestInfo | URL) => Promise<Response | undefined>;
};

/** Fetch-shaped function backing the global fetch stub during tests. */
type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const listeners = new Map<string, ServiceWorkerListener>();
const originalSelf = globalThis.self;
const originalCaches = globalThis.caches;
const originalFetch = globalThis.fetch;
const originalRequest = globalThis.Request;

let skipWaitingCalls = 0;
let cacheOpenCalls = 0;
let openCache: () => Promise<FakeCache> = async () => ({});
let fetchImpl: FetchStub = originalFetch;

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
  });

  Reflect.set(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => fetchImpl(input, init));

  Reflect.set(
    globalThis,
    'Request',
    class RequestWithBase extends Request {
      constructor(input: string | Request, init?: RequestInit) {
        const resolved =
          !(input instanceof Request) && input.startsWith('/')
            ? new URL(input, 'https://example.com').toString()
            : input;

        super(resolved, init);
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
  openCache = async () => ({});
  fetchImpl = originalFetch;
});

describe('service worker regressions', () => {
  test('rejects install when required precaching fails', async () => {
    const installError = new Error('precache failed');
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      openCache = async () => ({
        addAll: async () => {
          throw installError;
        }
      });

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
    openCache = async () => ({
      match: async () =>
        new Response('<!doctype html>', {
          headers: {
            'Content-Type': 'text/html'
          }
        })
    });
    fetchImpl = async () => {
      throw new Error('offline');
    };

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

  test('serves the cached embed shell when the extensionless route returns 404', async () => {
    openCache = async () => ({
      match: async (request: RequestInfo | URL) => {
        expect(request).toBe('/sl/embed.html');

        return new Response('<!doctype html><title>SL embed</title>', {
          headers: {
            'Content-Type': 'text/html'
          }
        });
      }
    });
    fetchImpl = async () => new Response('Not found', { status: 404 });

    const fetchHandler = listeners.get('fetch');
    expect(fetchHandler).toBeDefined();

    let responsePromise: Promise<Response> | undefined;
    fetchHandler?.({
      request: {
        destination: 'document',
        method: 'GET',
        mode: 'navigate',
        url: 'https://example.com/sl/embed?trainType=d51'
      },
      respondWith: (promise: Promise<Response>) => {
        responsePromise = promise;
      }
    });

    expect(responsePromise).toBeDefined();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('SL embed');
    expect(cacheOpenCalls).toBe(1);
  });
});
