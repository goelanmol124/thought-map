const MANIFEST_HREF = '/manifest.webmanifest';
const SW_URL = '/sw.js';
const CACHE_PREFIX = 'ideamap-';

function ensureManifestLink(): void {
  if (document.querySelector('link[rel="manifest"]')) return;
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = MANIFEST_HREF;
  document.head.appendChild(link);
}

async function unregisterDevServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    );
  }
}

function registerProductionServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  const register = () => {
    void navigator.serviceWorker.register(SW_URL, { scope: '/' }).catch((error: unknown) => {
      console.warn('[pwa] Service worker registration failed:', error);
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

/**
 * Production-only offline app shell registration.
 * In development, clears any leftover SW/caches so Vite HMR stays unaffected.
 * Manifest is linked from JS so index.html ownership is not required.
 */
export function registerPwa(): void {
  if (typeof window === 'undefined') return;

  if (!import.meta.env.PROD) {
    void unregisterDevServiceWorkers();
    return;
  }

  ensureManifestLink();
  registerProductionServiceWorker();
}
