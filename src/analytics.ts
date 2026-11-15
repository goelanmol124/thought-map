// Google Analytics is opt-in: it loads only when VITE_GA_MEASUREMENT_ID is set at build time
// (e.g. in .env.local or your host's build environment). Forks and local builds send nothing.
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function initAnalytics(): void {
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag expects the raw arguments object, not an array copy
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);
}
