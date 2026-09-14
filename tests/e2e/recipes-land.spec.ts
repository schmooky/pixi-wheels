import { expect, test } from '@playwright/test';

/**
 * Every demo lands where it says. For each recipe page: mount every demo,
 * press Spin through the live handle, and compare each ring's
 * `spin:complete` result with the section under that ring's pointer. Then
 * spin again and press Spin mid-flight, which the runner turns into a skip
 * (or a queued one, before the result is in): the skipped spin has to land
 * the same way. The console must stay free of library notices throughout.
 *
 * Run: `pnpm test:e2e` after `pnpm site:build`. The preview server comes
 * from `webServer` in playwright.config.ts.
 */

const BASE = 'http://127.0.0.1:5182';
// A protected tease turns the first press into a jump to the bait, not a skip.
const PROTECTED = new Set(['bait-protected-skip']);
const PAGES = ['starters', 'stopping', 'anticipation', 'sections-rings-idle', 'skins', 'disc-art', 'tongue', 'integration'].map((s) => `/recipes/${s}/`);

interface Landing {
  ring: string;
  said: string;
  under: string;
  skipped: boolean;
}

interface DemoReport {
  landings: Landing[];
  problems: string[];
}

for (const path of PAGES) {
  test(`every demo on ${path} lands where it says, spun and skipped`, async ({ page }) => {
    test.setTimeout(300_000);
    const notices: string[] = [];
    page.on('console', (m) => {
      if ((m.type() === 'warning' || m.type() === 'error') && /pixi-wheels/.test(m.text())) notices.push(m.text());
    });
    page.on('pageerror', (e) => notices.push(e.message));
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    const frames = page.locator('[data-recipe]');
    const count = await frames.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const frame = frames.nth(i);
      const name = (await frame.getAttribute('data-recipe')) ?? `#${i}`;
      await frame.scrollIntoViewIfNeeded();
      await page.waitForFunction((n) => !!(window as unknown as { __pixiWheels?: Record<string, unknown> }).__pixiWheels?.[n], name, { timeout: 30_000 });
      const report = await page.evaluate(async (n): Promise<DemoReport> => {
        // Structural view of the runner's live handle; the real types live in RecipeRunner.tsx.
        type Listener = (...args: never[]) => void;
        type LiveWheel = {
          events: { on(event: string, fn: Listener): unknown; off(event: string, fn: Listener): unknown };
          ring(id: string): { sectionUnderPointer(): { id: string } };
        };
        type Live = { wheel: LiveWheel | null; spin(): Promise<void>; isSpinning(): boolean };
        const live = (window as unknown as { __pixiWheels: Record<string, Live> }).__pixiWheels[n];
        const wheel = live.wheel;
        const landings: Landing[] = [];
        const problems: string[] = [];
        if (!wheel) return { landings, problems: ['no wheel on the live handle'] };
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const record = (r: { ring: string; section: { id: string }; wasSkipped: boolean }) => {
          landings.push({ ring: r.ring, said: r.section.id, under: wheel.ring(r.ring).sectionUnderPointer().id, skipped: r.wasSkipped });
        };
        wheel.events.on('spin:complete', record);
        const press = async (skipAfterMs: number) => {
          const p = live.spin();
          if (skipAfterMs > 0) {
            await wait(skipAfterMs);
            if (live.isSpinning()) await live.spin(); // a second press while spinning is a skip
          }
          await Promise.race([p, wait(45_000).then(() => problems.push('spin did not finish in 45 s'))]);
          for (let k = 0; k < 100 && live.isSpinning(); k++) await wait(100);
        };
        await press(0);
        await press(1500);
        wheel.events.off('spin:complete', record);
        return { landings, problems };
      }, name);
      expect.soft(report.problems, name).toEqual([]);
      for (const l of report.landings) {
        expect.soft(l.under, `${name}: ${l.ring} said ${l.said}${l.skipped ? ' (skipped)' : ''}`).toBe(l.said);
      }
      if (report.landings.length > 0 && !PROTECTED.has(name)) {
        expect.soft(report.landings.some((l) => l.skipped), `${name}: the second press did not skip`).toBe(true);
      }
    }
    expect(notices).toEqual([]);
  });
}
