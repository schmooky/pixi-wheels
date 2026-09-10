import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

/**
 * Every recipe demo must build its wheel. Recipe sources are `@ts-nocheck`
 * strings that no compiler reads, so a recipe that throws on mount renders
 * an empty box and nothing else goes red. This serves the built site, opens
 * every recipe page, scrolls each demo into view (they mount lazily), and
 * asserts a canvas appeared and the console stayed clean.
 */

let server: ChildProcess | null = null;
const PORT = 5182;
const BASE = `http://127.0.0.1:${PORT}`;

const PAGES = ['starters', 'stopping', 'anticipation', 'sections-rings-idle', 'skins', 'integration'].map((s) => `/recipes/${s}/`);

test.beforeAll(async () => {
  let occupied = false;
  try {
    occupied = (await fetch(`${BASE}/`)).ok;
  } catch {
    /* nothing listening */
  }
  if (occupied) throw new Error(`${BASE} is already served by another process; kill it and re-run.`);
  server = spawn(
    'pnpm',
    ['--filter', '@pixi-wheels/site', 'exec', 'astro', 'preview', '--ignore-lock', '--port', String(PORT), '--host', '127.0.0.1'],
    { stdio: 'pipe', cwd: process.cwd(), detached: true, env: { ...process.env, ASTRO_PREVIEW_BACKGROUND: '1' } },
  );
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return;
    } catch {
      /* not up yet */
    }
    await wait(500);
  }
  throw new Error(`site preview never came up on ${PORT}. Run \`pnpm site:build\` first.`);
});

test.afterAll(async () => {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
  }
});

for (const path of PAGES) {
  test(`recipes mount on ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    const frames = page.locator('[data-recipe-frame]');
    const count = await frames.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await frames.nth(i).scrollIntoViewIfNeeded();
      await expect(frames.nth(i).locator('canvas')).toBeVisible({ timeout: 30_000 });
      // A recipe that throws renders its error inside the frame and still has a canvas.
      await expect(frames.nth(i).locator('.text-destructive')).toHaveCount(0);
    }
    // Every demo enables the debug handle; the last one wins the bare global.
    const state = await page.evaluate(() => {
      const w = window as unknown as { __PIXI_WHEELS_DEBUG?: { snapshot: () => { rings: unknown[] } } };
      return w.__PIXI_WHEELS_DEBUG?.snapshot() ?? null;
    });
    expect(state).not.toBeNull();
    expect(errors.filter((e) => !/favicon|pagefind/i.test(e))).toEqual([]);
  });
}

test('the studio boots and builds the default wheel', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/studio/`, { waitUntil: 'networkidle' });
  await expect(page.getByText(/Built: \d+ ring/)).toBeVisible({ timeout: 45_000 });
  expect(errors).toEqual([]);
});
