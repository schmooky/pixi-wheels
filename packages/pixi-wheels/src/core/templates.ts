import type { WheelSectionConfig } from '../config/types.js';
import { SpinPresets } from '../config/SpinPresets.js';
import { WHEEL_CONFIG_VERSION, type WheelConfig } from './WheelConfig.js';

const RED = 0xd7263d;
const GREEN = 0x1e9e5a;
const GOLD = 0xf1c40f;

/**
 * Ready-made wheel configs for the common shapes. Each is a plain
 * `WheelConfig`: load one into `WheelBuilder.fromConfig()`, or copy the
 * JSON into the studio and tune it there.
 */
export const WheelTemplates = {
  /** Two halves, red and green, as a gamble wheel. */
  gamble(): WheelConfig {
    return {
      version: WHEEL_CONFIG_VERSION,
      name: 'Gamble red / green',
      speeds: { normal: SpinPresets.QUICK, turbo: SpinPresets.TURBO },
      landing: { mode: 'random', settle: 'none' },
      rings: [
        {
          id: 'main',
          outerRadius: 220,
          innerRadius: 30,
          sections: [
            { id: 'red', label: '', value: 'red', style: { fill: RED } },
            { id: 'green', label: '', value: 'green', style: { fill: GREEN } },
          ],
          skin: { type: 'graphics', dividers: { width: 4, color: 0xffffff }, hub: { radius: 30 } },
        },
      ],
      adapter: { by: 'value', path: 'gamble.result' },
    };
  },

  /**
   * The same two colours whose split moves step by step: the green share
   * grows or shrinks as the round goes on. A dynamic-section gamble.
   */
  gambleDynamic(): WheelConfig {
    const cfg = WheelTemplates.gamble();
    cfg.name = 'Gamble, dynamic split';
    cfg.rings[0].dynamic = {
      steps: [
        { red: 1, green: 1 },
        { red: 3, green: 2 },
        { red: 2, green: 1 },
        { red: 3, green: 1 },
        { red: 4, green: 1 },
      ],
      durationMs: 600,
    };
    return cfg;
  },

  /** Multipliers with unequal arcs: the big ones are thin. */
  multipliers(): WheelConfig {
    const sections: WheelSectionConfig[] = [
      { id: 'x2a', label: 'x2', value: 2, weight: 3 },
      { id: 'x5a', label: 'x5', value: 5, weight: 2 },
      { id: 'x3a', label: 'x3', value: 3, weight: 2.5 },
      { id: 'x10', label: 'x10', value: 10, weight: 1 },
      { id: 'x2b', label: 'x2', value: 2, weight: 3 },
      { id: 'x8', label: 'x8', value: 8, weight: 1.2 },
      { id: 'x3b', label: 'x3', value: 3, weight: 2.5 },
      { id: 'x50', label: 'x50', value: 50, weight: 0.5, style: { fill: GOLD, labelColor: 0x2b1d00 } },
    ];
    return {
      version: WHEEL_CONFIG_VERSION,
      name: 'Multipliers',
      speeds: { normal: SpinPresets.NORMAL, turbo: SpinPresets.TURBO },
      landing: { mode: 'random' },
      rings: [{ id: 'main', outerRadius: 260, innerRadius: 40, sections, skin: { type: 'graphics', bulbs: { count: 24 } } }],
      adapter: { by: 'value', path: 'bonus.multiplier' },
    };
  },

  /** Four jackpot tiers; the small ones wide, the grand a sliver. */
  jackpots(): WheelConfig {
    return {
      version: WHEEL_CONFIG_VERSION,
      name: 'Jackpot tiers',
      speeds: { normal: SpinPresets.CINEMATIC },
      landing: { mode: 'center', settle: { mode: 'bounce', bounceDeg: 3, durationMs: 500 } },
      rings: [
        {
          id: 'main',
          outerRadius: 280,
          innerRadius: 60,
          sections: [
            { id: 'mini', label: 'MINI', weight: 5, style: { fill: 0x2e86de } },
            { id: 'minor', label: 'MINOR', weight: 3, style: { fill: 0x10ac84 } },
            { id: 'mini2', label: 'MINI', weight: 5, style: { fill: 0x2e86de } },
            { id: 'major', label: 'MAJOR', weight: 1.5, style: { fill: 0xee5253 } },
            { id: 'mini3', label: 'MINI', weight: 5, style: { fill: 0x2e86de } },
            { id: 'minor2', label: 'MINOR', weight: 3, style: { fill: 0x10ac84 } },
            { id: 'grand', label: 'GRAND', weight: 0.6, style: { fill: GOLD, labelColor: 0x2b1d00 } },
          ],
          skin: { type: 'graphics', bulbs: { count: 32 } },
        },
      ],
      adapter: { by: 'section', path: 'jackpot.tier' },
    };
  },

  /**
   * The studio brief: jackpot sections whose arcs move step by step, as a
   * purely cosmetic state, with the titles following the middle of each.
   */
  dynamicJackpot(): WheelConfig {
    const cfg = WheelTemplates.jackpots();
    cfg.name = 'Jackpots, dynamic sectors';
    cfg.rings[0].dynamic = {
      steps: [
        { mini: 5, minor: 3, mini2: 5, major: 1.5, mini3: 5, minor2: 3, grand: 0.6 },
        { mini: 4, minor: 3.5, mini2: 4, major: 2, mini3: 4, minor2: 3.5, grand: 1 },
        { mini: 3, minor: 4, mini2: 3, major: 3, mini3: 3, minor2: 4, grand: 1.6 },
        { mini: 2, minor: 4, mini2: 2, major: 4, mini3: 2, minor2: 4, grand: 2.5 },
      ],
      durationMs: 700,
      ease: 'sine.inOut',
    };
    return cfg;
  },

  /** An outer ring of tiers and an inner ring read by an inward-facing pointer. */
  twoRing(): WheelConfig {
    return {
      version: WHEEL_CONFIG_VERSION,
      name: 'Two rings',
      speeds: { normal: SpinPresets.NORMAL },
      landing: { mode: 'center' },
      rings: [
        {
          id: 'main',
          outerRadius: 280,
          innerRadius: 190,
          sections: [
            { id: 'mini', label: 'MINI', style: { fill: 0x2e86de } },
            { id: 'major', label: 'MAJOR', style: { fill: 0xee5253 } },
            { id: 'minor', label: 'MINOR', style: { fill: 0x10ac84 } },
            { id: 'minor2', label: 'MINOR', style: { fill: 0x10ac84 } },
            { id: 'major2', label: 'MAJOR', style: { fill: 0xee5253 } },
            { id: 'mini2', label: 'MINI', style: { fill: 0x2e86de } },
            { id: 'minor3', label: 'MINOR', style: { fill: 0x10ac84 } },
            { id: 'major3', label: 'MAJOR', style: { fill: 0xee5253 } },
          ],
          skin: { type: 'graphics', hub: false },
        },
        {
          id: 'inner',
          outerRadius: 175,
          innerRadius: 50,
          direction: 'ccw',
          pointers: [{ angle: 0, facing: 'inward', tipInset: 12 }],
          sections: [
            { id: 'grand', label: 'GRAND', weight: 0.7, style: { fill: GOLD, labelColor: 0x2b1d00 } },
            { id: 'minor', label: 'MINOR', style: { fill: 0x10ac84 } },
            { id: 'major', label: 'MAJOR', style: { fill: 0xee5253 } },
            { id: 'minor2', label: 'MINOR', style: { fill: 0x10ac84 } },
            { id: 'major2', label: 'MAJOR', style: { fill: 0xee5253 } },
            { id: 'minor3', label: 'MINOR', style: { fill: 0x10ac84 } },
            { id: 'major3', label: 'MAJOR', style: { fill: 0xee5253 } },
            { id: 'minor4', label: 'MINOR', style: { fill: 0x10ac84 } },
          ],
          skin: { type: 'graphics', rim: { width: 6 } },
        },
      ],
    };
  },

  /** Twelve equal sections in the debug skin: for wiring and tests. */
  debug(): WheelConfig {
    return {
      version: WHEEL_CONFIG_VERSION,
      name: 'Debug 12',
      speeds: { normal: SpinPresets.NORMAL, turbo: SpinPresets.TURBO },
      rings: [
        {
          id: 'main',
          outerRadius: 240,
          innerRadius: 30,
          sections: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, label: String(i), value: i })),
          skin: { type: 'debug' },
        },
      ],
      adapter: { by: 'index', path: 'wheel.index' },
    };
  },
} as const;

export type WheelTemplateName = keyof typeof WheelTemplates;

/** The template names, for pickers. */
export const WHEEL_TEMPLATE_NAMES = Object.keys(WheelTemplates) as WheelTemplateName[];
