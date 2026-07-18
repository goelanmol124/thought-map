/* IdeaMap — production offline app shell.
 * Precaches the SPA shell; runtime-caches hashed Vite assets only.
 * Never caches cross-origin, opaque, or non-GET responses.
 */

const CACHE_PREFIX = 'ideamap-';
const CACHE_VERSION = 'v4';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/theme-boot.js',
  '/logo.svg',
  '/logo.png',
  '/favicon-16.png',
  '/favicon-32.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg',
  '/icons/mark.svg',
];

/**
 * @param {URL} url
 * @returns {boolean}
 */
function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

/**
 * Vite emits fingerprinted files under /assets/.
 * @param {URL} url
 * @returns {boolean}
 */
function isHashedAsset(url) {
  return isSameOrigin(url) && url.pathname.startsWith('/assets/');
}

/**
 * Safe to put in Cache Storage: same-origin, successful, non-opaque GET.
 * @param {Response} response
 * @returns {boolean}
 */
function isCacheableResponse(response) {
  if (!response || !response.ok) return false;
  // 'opaque' / 'opaqueredirect' must never be stored.
  if (response.type !== 'basic' && response.type !== 'cors' && response.type !== 'default') {
    return false;
  }
  // Prefer same-origin basic responses for the shell.
  if (response.type === 'cors') return false;
  return true;
}

/**
 * @param {Cache} cache
 * @param {string[]} urls
 */
async function precacheShell(cache, urls) {
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (isCacheableResponse(response)) {
          await cache.put(url, response);
        }
      } catch {
        // Individual precache failures must not block install.
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await precacheShell(cache, PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const allowed = new Set([SHELL_CACHE, ASSET_CACHE]);
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !allowed.has(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Network-first for navigations; fall back to cached shell.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirstNavigation(request) {
  const shellCache = await caches.open(SHELL_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (isCacheableResponse(networkResponse)) {
      // Store under stable keys so offline SPA fallback is reliable.
      await shellCache.put('/index.html', networkResponse.clone());
      await shellCache.put('/', networkResponse.clone());
      return networkResponse;
    }
  } catch {
    // Offline or network error — use cache.
  }

  const cached =
    (await shellCache.match('/index.html')) ||
    (await shellCache.match('/')) ||
    (await caches.match(request));

  if (cached) return cached;

  return new Response('IdeaMap is offline and no cached shell is available.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Cache-first for fingerprinted /assets/* files.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

/**
 * Cache-first for other same-origin static shell files (manifest, icons).
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirstShell(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const fallback = await caches.match(request);
    if (fallback) return fallback;
    throw new Error('Network error and no cache match');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch non-GET writes, mutations, or beacons.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept any cross-origin traffic. This also excludes every
  // third-party script, beacon, API, and opaque response by construction.
  if (!isSameOrigin(url)) {
    return;
  }

  // Do not cache API-like or dynamic paths if introduced later.
  if (
    url.pathname.startsWith('/api/') ||
    url.searchParams.has('token') ||
    url.searchParams.has('access_token')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isHashedAsset(url)) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  // Same-origin static shell resources only (manifest, icons, favicon, etc.).
  if (
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/theme-boot.js' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.png' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(cacheFirstShell(request));
  }
});
