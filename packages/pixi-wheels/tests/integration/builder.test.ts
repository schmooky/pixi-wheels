import { describe, it, expect } from 'vitest';
import type { Ticker } from 'pixi.js';
import { WheelBuilder } from '../../src/core/WheelBuilder.js';
import { WheelTemplates, WHEEL_TEMPLATE_NAMES } from '../../src/core/templates.js';
import { assertWheelConfig } from '../../src/core/WheelConfig.js';
import { HeadlessRingSkin } from '../../src/skins/HeadlessRingSkin.js';
import { FakeTicker } from '../../src/testing/FakeTicker.js';
import { HeadlessPointerSkin } from '../../src/testing/testHarness.js';
import { debugArc, debugSnapshot } from '../../src/debug/debug.js';

const ticker = () => new FakeTicker() as unknown as Ticker;
const two = [{ id: 'a' }, { id: 'b' }];

describe('WheelBuilder validation', () => {
  it('requires a ticker, a radius and two sections', () => {
    expect(() => new WheelBuilder().radius(100).sections(two).build()).toThrow(/ticker\(app.ticker\)/);
    expect(() => new WheelBuilder().sections(two).ticker(ticker()).build()).toThrow(/radius\(outer\)/);
    expect(() => new WheelBuilder().radius(100).sections([{ id: 'a' }]).ticker(ticker()).build()).toThrow(/at least 2 sections/);
  });

  it('rejects an inner radius that is not smaller than the outer', () => {
    expect(() => new WheelBuilder().radius(100, 100).sections(two).ticker(ticker()).build()).toThrow(/inner radius/);
  });

  it('rejects overlapping rings and duplicate ring ids', () => {
    const b = new WheelBuilder().radius(300, 150).sections(two).ticker(ticker()).skin(new HeadlessRingSkin()).pointer({ skin: new HeadlessPointerSkin() });
    b.ring('inner', (r) => r.radius(200).sections(two).skin(new HeadlessRingSkin()).pointer({ skin: new HeadlessPointerSkin() }));
    expect(() => b.build()).toThrow(/overlap/);
    expect(() => b.ring('inner', () => {})).toThrow(/already added/);
    expect(() => b.ring('main', () => {})).toThrow(/main ring/);
  });

  it('validates speed profiles and eases at build time', () => {
    const base = () => new WheelBuilder().radius(100).sections(two).skin(new HeadlessRingSkin()).pointer({ skin: new HeadlessPointerSkin() }).ticker(ticker());
    expect(() => base().speed('x', { spinSpeed: 0, accelerationMs: 1, minimumSpinTime: 0, minCruiseMs: 0, stopDuration: 100, minTurns: 1, maxTurns: 2, skipDuration: 100 }).build()).toThrow(/spinSpeed/);
    expect(() => base().speed('x', { spinSpeed: 500, accelerationMs: 1, minimumSpinTime: 0, minCruiseMs: 0, stopDuration: 100, minTurns: 3, maxTurns: 2, skipDuration: 100 }).build()).toThrow(/maxTurns/);
    expect(() => base().speed('x', { spinSpeed: 500, accelerationMs: 1, minimumSpinTime: 0, minCruiseMs: 0, stopDuration: 100, minTurns: 1, maxTurns: 2, skipDuration: 100, stopEase: 'wobble.out' }).build()).toThrow(/Unknown ease/);
    expect(() => base().initialSpeed('ghost').build()).toThrow(/initialSpeed/);
  });

  it('rejects dynamic steps that name unknown sections', () => {
    expect(() =>
      new WheelBuilder().radius(100).sections(two).dynamic({ steps: [{ zzz: 1 }] }).skin(new HeadlessRingSkin()).ticker(ticker()).build(),
    ).toThrow(/unknown section "zzz"/);
  });
});

describe('configs', () => {
  it('round-trips through toConfig / fromConfig', () => {
    const b = new WheelBuilder()
      .name('round trip')
      .radius(240, 30)
      .sections([{ id: 'x2', value: 2, weight: 2 }, { id: 'x5', value: 5 }])
      .startAngle(-90)
      .direction('ccw')
      .pointer({ angle: -90, skin: { type: 'graphics', shape: 'triangle' } })
      .skin({ type: 'debug' })
      .dynamic({ steps: [{ x2: 1 }, { x2: 3 }] })
      .landing({ mode: 'random' })
      .skip({ allowed: false })
      .idle({ speed: 12 })
      .adapter({ by: 'value', path: 'r.m' });
    const cfg = b.toConfig();
    assertWheelConfig(cfg);
    expect(cfg.rings[0].sections).toHaveLength(2);
    expect(cfg.direction).toBe('ccw');
    const again = WheelBuilder.fromConfig(cfg).toConfig();
    expect(again).toEqual(cfg);
    expect(JSON.parse(JSON.stringify(cfg))).toEqual(cfg);
  });

  it('assertWheelConfig names the first problem', () => {
    expect(() => assertWheelConfig(null)).toThrow(/expected an object/);
    expect(() => assertWheelConfig({ version: 2, rings: [] })).toThrow(/version 2/);
    expect(() => assertWheelConfig({ version: 1, rings: [] })).toThrow(/non-empty array/);
    expect(() => assertWheelConfig({ version: 1, rings: [{ id: 'a', outerRadius: 'x', sections: [] }] })).toThrow(/outerRadius/);
  });

  it('every template is a valid config that builds headlessly', () => {
    for (const name of WHEEL_TEMPLATE_NAMES) {
      const cfg = WheelTemplates[name]();
      assertWheelConfig(cfg);
      // Templates name graphics / debug skins, which create Text; rebuild the
      // same rings with headless skins so the suite runs in Node.
      const headless = new WheelBuilder().ticker(ticker());
      const main = cfg.rings.find((r) => r.id === 'main') ?? cfg.rings[0];
      headless.radius(main.outerRadius, main.innerRadius ?? 0).sections(main.sections).skin(new HeadlessRingSkin()).pointer({ skin: new HeadlessPointerSkin() });
      if (main.dynamic) headless.dynamic(main.dynamic);
      for (const r of cfg.rings) {
        if (r === main) continue;
        headless.ring(r.id, (rb) => {
          rb.radius(r.outerRadius, r.innerRadius ?? 0).sections(r.sections).skin(new HeadlessRingSkin()).pointer({ ...(r.pointers?.[0] ?? {}), skin: new HeadlessPointerSkin() });
          if (r.direction) rb.direction(r.direction);
        });
      }
      for (const [n, p] of Object.entries(cfg.speeds ?? {})) headless.speed(n, p);
      const wheel = headless.build();
      expect(wheel.rings.length).toBe(cfg.rings.length);
      const snap = debugSnapshot(wheel);
      expect(snap.rings[0].sections.length).toBe(main.sections.length);
      expect(debugArc(wheel)).toContain('main');
      wheel.destroy();
    }
  });
});

describe('teardown', () => {
  it('destroy() removes ticker callbacks, emits destroyed and drops listeners', () => {
    const t = new FakeTicker();
    const wheel = new WheelBuilder()
      .radius(100)
      .sections(two)
      .skin(new HeadlessRingSkin())
      .pointer({ skin: new HeadlessPointerSkin() })
      .ticker(t as unknown as Ticker)
      .build();
    let destroyed = 0;
    wheel.events.on('destroyed', () => destroyed++);
    expect(t.listenerCount).toBe(1);
    wheel.destroy();
    expect(t.listenerCount).toBe(0);
    expect(destroyed).toBe(1);
    expect(wheel.isDestroyed).toBe(true);
    expect(wheel.events.listenerCount('destroyed')).toBe(0);
  });
});

describe('profiles', () => {
  it('fills a partial profile from DEFAULT_PROFILE and validates the result', () => {
    const base = () => new WheelBuilder().radius(100).sections(two).skin(new HeadlessRingSkin()).pointer({ skin: new HeadlessPointerSkin() }).ticker(ticker());
    const wheel = base().speed('slow', { spinSpeed: 300 }).build();
    try {
      expect(wheel.main.profile).toMatchObject({ spinSpeed: 300, stopDuration: 4200, minTurns: 1, maxTurns: 8, skipDuration: 450 });
    } finally {
      wheel.destroy();
    }
    expect(() => base().speed('x', { spinSpeed: 300, minTurns: undefined }).build()).toThrow(/minTurns/);
    const w = base().build();
    try {
      expect(() => w.main.addSpeed('bad', { spinSpeed: 0 })).toThrow(/spinSpeed/);
      w.main.addSpeed('turbo', { spinSpeed: 900, stopDuration: 1500 });
      expect(w.main.profile.spinSpeed).toBe(540);
      w.setSpeed('turbo');
      expect(w.main.profile).toMatchObject({ spinSpeed: 900, stopDuration: 1500, minTurns: 1 });
    } finally {
      w.destroy();
    }
  });

  it('two wheels from one builder do not share a profile table', () => {
    const b = new WheelBuilder().radius(100).sections(two).skin(new HeadlessRingSkin()).pointer({ skin: new HeadlessPointerSkin() }).ticker(ticker());
    const a = b.build();
    const c = b.build();
    try {
      a.main.addSpeed('only-a', { spinSpeed: 200 });
      expect(a.speedNames).toContain('only-a');
      expect(c.speedNames).not.toContain('only-a');
    } finally {
      a.destroy();
      c.destroy();
    }
  });
});

describe('fromConfig', () => {
  it('keeps the id of a main ring that is not called "main"', () => {
    const wheel = WheelBuilder.fromConfig({
      version: 1,
      rings: [{ id: 'bonus', outerRadius: 120, sections: two, skin: { type: 'headless' } }],
    })
      .ticker(ticker())
      .build();
    try {
      expect(wheel.rings.map((r) => r.id)).toEqual(['bonus']);
      expect(wheel.main.id).toBe('bonus');
      expect(wheel.ring('bonus')).toBe(wheel.main);
    } finally {
      wheel.destroy();
    }
  });

  it('rejects a dynamic initialStep outside the step list', () => {
    expect(() =>
      new WheelBuilder().radius(100).sections(two).dynamic({ steps: [{ a: 1 }], initialStep: 3 }).skin(new HeadlessRingSkin()).ticker(ticker()).build(),
    ).toThrow(/initialStep 3/);
  });
});
