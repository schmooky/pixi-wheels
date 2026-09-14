import { defineConfig, devices } from '@playwright/test';

/**
 * Browser coverage for the one thing unit tests cannot reach: the real stack
 * (WebGL, the PixiJS ticker, asset loading) on every recipe page. Asserts on
 * mounted canvases and a clean console, never on pixels: a WebGL screenshot
 * baseline is GPU- and platform-dependent.
 *
 * Run: `pnpm test:e2e` after `pnpm site:build`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 90_000,
  use: {
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // One static server of the built site for every spec. Not `astro preview`:
  // it daemonises itself in agent environments and refuses `--ignore-lock`
  // there, and Playwright cannot follow either.
  webServer: {
    command: 'node scripts/serve-dist.mjs 5182',
    url: 'http://127.0.0.1:5182/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
