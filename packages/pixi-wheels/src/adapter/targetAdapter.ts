import type { WheelTarget } from '../config/types.js';

/**
 * A serialisable description of how to read a wheel target out of a server
 * response: which field, interpreted how. This is the shape the studio
 * exports and `createTargetAdapter` compiles.
 *
 * ```ts
 * const adapter = createTargetAdapter({ by: 'value', path: 'bonus.wheel.multiplier' });
 * wheel.setResult(adapter(response));
 * ```
 */
export interface TargetAdapterConfig {
  /** How the field is interpreted. */
  by: 'section' | 'index' | 'value' | 'angle' | 'position';
  /** Dotted path into the response, e.g. `'result.wheel.sectorIndex'`. */
  path: string;
  /** `'value'` only: which of several matching sections to use. Default `'random'`. */
  pick?: 'random' | 'first' | 'last';
  /** Optional dotted path to a 0..1 offset within the section (id / index / value forms). */
  offsetPath?: string;
  /**
   * `'index'` only: what the server calls the first section. Default 0.
   * Some backends number sectors from 1.
   */
  indexBase?: number;
}

/** Read a dotted path (`a.b.0.c`) off an object. Throws when a step is missing. */
export function readPath(source: unknown, path: string): unknown {
  let cur: unknown = source;
  const parts = path.split('.').filter((p) => p.length > 0);
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      throw new Error(`Target adapter: "${path}" not found (stopped at "${part}").`);
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur === undefined) throw new Error(`Target adapter: "${path}" is undefined on the response.`);
  return cur;
}

/** Compile an adapter config into a function from any response to a {@link WheelTarget}. */
export function createTargetAdapter(config: TargetAdapterConfig): (response: unknown) => WheelTarget {
  return (response) => {
    const raw = readPath(response, config.path);
    const offset = config.offsetPath ? Number(readPath(response, config.offsetPath)) : undefined;
    switch (config.by) {
      case 'section':
        return offset === undefined ? { section: String(raw) } : { section: String(raw), offset };
      case 'index': {
        const index = Number(raw) - (config.indexBase ?? 0);
        return offset === undefined ? { index } : { index, offset };
      }
      case 'value': {
        const value = typeof raw === 'number' || typeof raw === 'string' ? raw : String(raw);
        const t: WheelTarget = { value, pick: config.pick ?? 'random' };
        return offset === undefined ? t : { ...t, offset };
      }
      case 'angle':
        return { angle: Number(raw) };
      case 'position':
        return { position: Number(raw) };
    }
  };
}
