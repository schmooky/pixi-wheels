// pixi.js@8 reads `navigator.userAgent` at module-load time. Provide a stub
// so the headless suite runs on any Node without a global navigator.
if (typeof (globalThis as { navigator?: unknown }).navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'node' },
    configurable: true,
    writable: true,
  });
}
