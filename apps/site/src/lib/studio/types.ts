import type { WheelConfig } from 'pixi-wheels';

/** One uploaded file, content-addressed by SHA-256 and stored in IndexedDB. */
export interface StoredAsset {
  hash: string;
  /** The key skin configs reference: the file name as uploaded. */
  key: string;
  mime: string;
  size: number;
  blob: Blob;
  /** `'texture'` for images, `'spine-skeleton'`, `'spine-atlas'`, or `'other'`. */
  kind: 'texture' | 'spine-skeleton' | 'spine-atlas' | 'other';
}

/** Which surface drives the canvas: the form (config) or the code editor. */
export type StudioMode = 'config' | 'code';

export interface StudioState {
  mode: StudioMode;
  config: WheelConfig;
  code: string;
  /** Section id the next spin lands on, or `'random'`. */
  landOn: string;
  /** Section id to bait with, or `'none'`. */
  bait: string;
}

export const STUDIO_STORAGE_KEY = 'pixi-wheels-studio:v1';
