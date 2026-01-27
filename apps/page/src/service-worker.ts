// Service Worker for offline support
// Implements a network-first strategy with cache fallback for navigation
// and cache-first strategy for static assets

const CACHE_VERSION = 'v2';
const CACHE_NAME = `sl-page-${CACHE_VERSION}`;

// Dynamically determine the base path from the service worker's location
// For GitHub Pages project sites (e.g., https://username.github.io/project/),
// the service worker will be at /project/service-worker.js, so we extract /project/
const getBasePath = () => {
  const swPath = self.location.pathname;
  // Remove /service-worker.js to get the base directory
  const basePath = swPath.substring(0, swPath.lastIndexOf('/'));
  return basePath || '';
};

const BASE_PATH = getBasePath();

const ASSETS_TO_CACHE = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/embed.html`,
  `${BASE_PATH}/favicon.svg`,
  `${BASE_PATH}/index.js`,
  `${BASE_PATH}/embed.js`,
  `${BASE_PATH}/manifest.json`
  // WASM_PLACEHOLDER - will be replaced at build time
];

const ASSET_URLS = new Set(ASSETS_TO_CACHE.map((url) => new URL(url, self.location.origin).toString()));

// Install event - cache initial assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching initial assets');
        // Force reload to ensure we have the latest version during installation
        return cache.addAll(ASSETS_TO_CACHE.map((url) => new Request(url, { cache: 'reload' })));
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache initial assets', error);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const deleteOldCaches = Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );

      const cleanupStaleAssets = caches.open(CACHE_NAME).then((cache) => {
        return cache.keys().then((requests) => {
          return Promise.all(
            requests.map((request) => {
              const url = new URL(request.url);
              if (ASSET_URLS.has(url.toString())) {
                return;
              }
              if (url.origin === self.location.origin && url.pathname.endsWith('.wasm')) {
                console.log('Service Worker: Removing stale asset', request.url);
                return cache.delete(request);
              }
            })
          );
        });
      });

      return Promise.all([deleteOldCaches, cleanupStaleAssets]);
    })
  );
  // Claim all clients immediately
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip cross-origin requests (like Google Fonts)
  if (url.origin !== self.location.origin) {
    // For cross-origin requests, try network first, no caching
    event.respondWith(fetch(request));
    return;
  }

  // For navigation requests (HTML pages), use network-first strategy
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseToCache = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => {
              // Cache without query parameters since HTML is the same regardless
              // This ensures offline mode can find the cached page with any query params
              const urlWithoutQuery = new URL(request.url);
              urlWithoutQuery.search = '';
              const requestWithoutQuery = new Request(urlWithoutQuery.toString(), {
                method: request.method,
                headers: request.headers,
                mode: request.mode,
                credentials: request.credentials,
                cache: request.cache,
                redirect: request.redirect,
                referrer: request.referrer,
                integrity: request.integrity
              });
              cache.put(requestWithoutQuery, responseToCache);
            })
            .catch((error) => {
              console.error('Service Worker: Failed to cache navigation response', error);
            });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          // Strip query parameters from the URL since HTML is the same regardless of query params
          // JavaScript will read query params from window.location.search at runtime
          const urlWithoutQuery = new URL(request.url);
          urlWithoutQuery.search = '';
          const requestWithoutQuery = new Request(urlWithoutQuery.toString(), {
            method: request.method,
            headers: request.headers,
            mode: request.mode,
            credentials: request.credentials,
            cache: request.cache,
            redirect: request.redirect,
            referrer: request.referrer,
            integrity: request.integrity
          });

          return caches.match(requestWithoutQuery).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback to index.html for client-side routing
            return caches.match(`${BASE_PATH}/index.html`).then((indexResponse) => {
              return (
                indexResponse ||
                new Response('Offline - Page not found', {
                  status: 404,
                  statusText: 'Not Found'
                })
              );
            });
          });
        })
    );
    return;
  }

  // For all other requests (JS, CSS, images, WASM, etc.), use cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in background
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              caches
                .open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, response.clone());
                })
                .catch((error) => {
                  console.error('Service Worker: Failed to update cache in background', error);
                });
            }
          })
          .catch(() => {
            // Silently fail background update
          });
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Clone the response before caching
          const responseToCache = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache);
            })
            .catch((error) => {
              console.error('Service Worker: Failed to cache response', error);
            });

          return response;
        })
        .catch(() => {
          // Network failed and not in cache
          // For WASM files, provide a helpful error
          if (request.url.endsWith('.wasm')) {
            return new Response('WASM module not available offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          }
          throw new Error('Network request failed and no cache available');
        });
    })
  );
});
