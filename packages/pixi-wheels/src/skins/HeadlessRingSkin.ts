import type { RingSkin, RingSkinContext } from './RingSkin.js';

/** A skin that draws nothing. What the headless test harness uses. */
export class HeadlessRingSkin implements RingSkin {
  private _isDestroyed = false;
  private _ctx: RingSkinContext | null = null;
  layoutCalls = 0;
  highlighted: string | null = null;

  attach(ctx: RingSkinContext): void {
    this._ctx = ctx;
  }

  layout(): void {
    this.layoutCalls++;
  }

  highlight(sectionId: string | null): void {
    this.highlighted = sectionId;
  }

  get context(): RingSkinContext | null {
    return this._ctx;
  }

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  destroy(): void {
    this._isDestroyed = true;
  }
}
