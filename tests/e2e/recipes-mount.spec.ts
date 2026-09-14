import { expect, test } from '@playwright/test';

/**
 * Every recipe demo must build its wheel. Recipe sources are `@ts-nocheck`
 * strings that no compiler reads, so a recipe that throws on mount renders
 * an empty box and nothing else goes red. This serves the built site, opens
 * every recipe page, scrolls each demo into view (they mount lazily), and
 * asserts a canvas appeared and the console stayed clean. The preview
 * server comes from `webServer` in playwright.config.ts.
 */

const BASE = 'http://127.0.0.1:5182';

const PAGES = ['starters', 'stopping', 'anticipation', 'sections-rings-idle', 'skins', 'disc-art', 'tongue', 'integration'].map((s) => `/recipes/${s}/`);

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
