import type {
  DynamicSectionsConfig,
  IdleConfig,
  LandingOptions,
  PointerConfig,
  SkipConfig,
  SpinDirection,
  SpinProfile,
  WheelSectionConfig,
  PegConfig,
} from '../config/types.js';
import type { PointerSkinConfig, RingSkinConfig } from '../skins/skinRegistry.js';
import type { TargetAdapterConfig } from '../adapter/targetAdapter.js';

/** The current config schema version. Bumped when a field changes meaning. */
export const WHEEL_CONFIG_VERSION = 1;

/** A pointer in a config: its placement plus a serialised skin. */
export interface PointerConfigEntry extends PointerConfig {
  skin?: PointerSkinConfig;
}

/** One ring, serialised. */
export interface RingConfig {
  id: string;
  outerRadius: number;
  innerRadius?: number;
  startAngle?: number;
  /** Overrides the wheel's direction for this ring. */
  direction?: SpinDirection;
  sections: WheelSectionConfig[];
  pointers?: PointerConfigEntry[];
  skin?: RingSkinConfig;
  dynamic?: DynamicSectionsConfig;
  /** Pegs the tongues touch; `false` for none. Default one per divider. */
  pegs?: PegConfig | false;
  palette?: number[];
}

/**
 * A whole wheel as JSON. What the studio exports, what
 * `WheelBuilder.fromConfig()` builds from, and what `builder.toConfig()`
 * gives back. Asset references (textures, Spine aliases) are string keys
 * resolved at build time.
 */
export interface WheelConfig {
  version: typeof WHEEL_CONFIG_VERSION;
  /** Human name, for the studio's gallery. */
  name?: string;
  direction?: SpinDirection;
  speeds?: Record<string, SpinProfile>;
  initialSpeed?: string;
  landing?: LandingOptions;
  skip?: SkipConfig;
  idle?: IdleConfig;
  rings: RingConfig[];
  /** How to read a target out of the game server's response. Informational for the library; the studio's example uses it. */
  adapter?: TargetAdapterConfig;
}

/**
 * Structural check on a config object from an untrusted source (a file, a
 * form). Throws a message that names the first problem. The builder runs
 * the deeper validation (section ids, radii, eases) on `build()`.
 */
export function assertWheelConfig(cfg: unknown): asserts cfg is WheelConfig {
  if (!cfg || typeof cfg !== 'object') throw new Error('WheelConfig: expected an object.');
  const c = cfg as Record<string, unknown>;
  if (c.version !== WHEEL_CONFIG_VERSION) {
    throw new Error(`WheelConfig: version ${String(c.version)} is not supported; this build reads version ${WHEEL_CONFIG_VERSION}.`);
  }
  if (!Array.isArray(c.rings) || c.rings.length === 0) throw new Error('WheelConfig: "rings" must be a non-empty array.');
  c.rings.forEach((r: unknown, i: number) => {
    if (!r || typeof r !== 'object') throw new Error(`WheelConfig: rings[${i}] must be an object.`);
    const ring = r as Record<string, unknown>;
    if (typeof ring.id !== 'string' || ring.id === '') throw new Error(`WheelConfig: rings[${i}].id must be a non-empty string.`);
    if (typeof ring.outerRadius !== 'number') throw new Error(`WheelConfig: rings[${i}].outerRadius must be a number.`);
    if (!Array.isArray(ring.sections)) throw new Error(`WheelConfig: rings[${i}].sections must be an array.`);
    if (ring.pegs !== undefined && ring.pegs !== false && (typeof ring.pegs !== 'object' || ring.pegs === null)) {
      throw new Error(`WheelConfig: rings[${i}].pegs must be an object or false.`);
    }
  });
}
