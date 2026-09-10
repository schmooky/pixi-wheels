/**
 * Contract for objects that allocate resources and need cleanup.
 *
 * Every class that subscribes to a ticker, creates display objects, or holds
 * references implements this so `Wheel.destroy()` can cascade teardown.
 */
export interface Disposable {
  destroy(): void;
  readonly isDestroyed: boolean;
}
