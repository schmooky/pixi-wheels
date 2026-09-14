import { expect, test } from '@playwright/test';

/**
 * The landing page opens on a live wheel. Tapping it spins; the pill under
 * it reports the state and the landing. The preview server comes from
 * `webServer` in playwright.config.ts.
 */
const BASE = 'http://127.0.0.1:5182';

test('the home page opens on a wheel that spins when tapped', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|pagefind/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const hero = page.locator('[data-hero-wheel]');
  await expect(hero).toHaveAttribute('data-hero-wheel', 'idle', { timeout: 30_000 });
  await hero.locator('canvas').click();
  await expect(hero).toHaveAttribute('data-hero-wheel', 'spinning');
  await expect(hero).toHaveAttribute('data-hero-wheel', 'landed', { timeout: 30_000 });
  await expect(hero.getByRole('button')).toHaveText(/Landed on x\d+/);
  expect(errors).toEqual([]);
});
