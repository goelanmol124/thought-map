import { defineConfig, devices } from '@playwright/test';

// End-to-end tests. Run with `npm run test:e2e` (starts the Vite dev server automatically).
export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
