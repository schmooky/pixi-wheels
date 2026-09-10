import type { Ticker } from 'pixi.js';
import type { Disposable } from './Disposable.js';

export type TickerCallback = (ticker: Ticker) => void;

/**
 * Safe wrapper around PixiJS Ticker subscriptions.
 *
 * A dangling `ticker.add()` callback is the classic slot-client leak: the
 * wheel is removed from the stage, the ticker keeps calling into it. Every
 * callback registered through a `TickerRef` is removed on `destroy()`.
 *
 * ```ts
 * const ref = new TickerRef(app.ticker);
 * ref.add((ticker) => ring.update(ticker));
 * ref.destroy(); // all callbacks removed
 * ```
 */
export class TickerRef implements Disposable {
  private _callbacks: TickerCallback[] = [];
  private _isDestroyed = false;

  constructor(private _ticker: Ticker) {}

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  add(fn: TickerCallback): void {
    if (this._isDestroyed) return;
    this._callbacks.push(fn);
    this._ticker.add(fn);
  }

  remove(fn: TickerCallback): void {
    const idx = this._callbacks.indexOf(fn);
    if (idx !== -1) {
      this._callbacks.splice(idx, 1);
      this._ticker.remove(fn);
    }
  }

  destroy(): void {
    if (this._isDestroyed) return;
    for (const fn of this._callbacks) {
      this._ticker.remove(fn);
    }
    this._callbacks.length = 0;
    this._isDestroyed = true;
  }
}
