import type { Ticker } from 'pixi.js';
import type { TickerCallback } from '../utils/TickerRef.js';

/**
 * Minimal drop-in for `PIXI.Ticker` in tests. Exposes the surface the
 * engine uses (`add`, `remove`, `deltaMS`) plus `tick(ms)` and `tickFor(ms)`
 * to advance time by hand, so a whole spin runs in a unit test with no
 * requestAnimationFrame and no wall clock.
 *
 * ```ts
 * const ticker = new FakeTicker();
 * const wheel = new WheelBuilder().ticker(ticker as unknown as Ticker)...build();
 * ticker.tickFor(5000); // five seconds, in 16 ms frames
 * ```
 */
export class FakeTicker {
  public deltaMS = 16;
  public deltaTime = 1;
  public elapsedMS = 0;
  public lastTime = 0;
  public speed = 1;
  public started = false;
  public FPS = 60;
  public minFPS = 10;
  public maxFPS = 0;

  private _callbacks: TickerCallback[] = [];

  add(fn: TickerCallback): this {
    this._callbacks.push(fn);
    return this;
  }

  addOnce(fn: TickerCallback): this {
    const wrapped: TickerCallback = (t) => {
      this.remove(wrapped);
      fn(t);
    };
    return this.add(wrapped);
  }

  remove(fn: TickerCallback): this {
    const i = this._callbacks.indexOf(fn);
    if (i !== -1) this._callbacks.splice(i, 1);
    return this;
  }

  start(): this {
    this.started = true;
    return this;
  }

  stop(): this {
    this.started = false;
    return this;
  }

  destroy(): void {
    this._callbacks.length = 0;
    this.started = false;
  }

  /** Advance by `deltaMs` and fire every listener once. */
  tick(deltaMs = 16): void {
    this.deltaMS = deltaMs;
    this.deltaTime = deltaMs / (1000 / 60);
    this.elapsedMS += deltaMs;
    this.lastTime += deltaMs;
    for (const cb of this._callbacks.slice()) cb(this as unknown as Ticker);
  }

  /** Advance `totalMs` in `stepMs` frames. */
  tickFor(totalMs: number, stepMs = 16): void {
    let remaining = totalMs;
    while (remaining > 0) {
      const step = Math.min(stepMs, remaining);
      this.tick(step);
      remaining -= step;
    }
  }

  get listenerCount(): number {
    return this._callbacks.length;
  }
}
