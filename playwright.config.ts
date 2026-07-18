import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Demo recording project is separate from chromium.
 * Default CI stays clean via `npm run test:browser` → `--project=chromium`.
 * Record a dry-run cut: `npm run test:demo`
 * Optional: HEADED=1, DEMO_SLOW_MO=500
 *
 * Video lands under test-results/ (gitignored). `npm run test:demo` then copies a
 * keeper to demo/exports/ideamap-spine-dry-run.webm (also gitignored).
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/helpers/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      // Exclude paced demo recording from the default project.
      testIgnore: ['**/helpers/**', '**/demo-*.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'demo-video',
      testMatch: '**/demo-golden-path.spec.ts',
      fullyParallel: false,
      workers: 1,
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
        // Emulated desktop three-pane frame (marketing lock: ≥1100 / 1280×800).
        viewport: { width: 1280, height: 800 },
        // CRITICAL: bare `video: 'on'` scales viewport down to fit 800×800
        // (1280×800 → 800×500). Lock record size to the viewport.
        video: {
          mode: 'on',
          size: { width: 1280, height: 800 },
        },
        // Optional: HEADED=1 for a visible window while recording.
        headless: process.env.HEADED !== '1',
        launchOptions: {
          // Pace interactions so stance / readiness flips read on video.
          // Prefer DEMO_SLOW_MO=500+ when cutting a keeper.
          slowMo: Number(process.env.DEMO_SLOW_MO ?? 450),
        },
      },
    },
  ],
});
