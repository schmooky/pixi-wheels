import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../../src/events/EventEmitter.js';

interface TestEvents extends Record<string, unknown[]> {
  foo: [x: number, y: string];
  bar: [];
}

describe('EventEmitter', () => {
  it('emits to listeners with typed args', () => {
    const e = new EventEmitter<TestEvents>();
    const fn = vi.fn();
    e.on('foo', fn);
    e.emit('foo', 42, 'hi');
    expect(fn).toHaveBeenCalledWith(42, 'hi');
  });

  it('once fires once and off removes', () => {
    const e = new EventEmitter<TestEvents>();
    const once = vi.fn();
    const on = vi.fn();
    e.once('bar', once);
    e.on('bar', on);
    e.emit('bar');
    e.emit('bar');
    expect(once).toHaveBeenCalledTimes(1);
    expect(on).toHaveBeenCalledTimes(2);
    e.off('bar', on);
    e.emit('bar');
    expect(on).toHaveBeenCalledTimes(2);
  });

  it('emit returns whether anyone listened', () => {
    const e = new EventEmitter<TestEvents>();
    expect(e.emit('bar')).toBe(false);
    e.on('bar', () => {});
    expect(e.emit('bar')).toBe(true);
    expect(e.listenerCount('bar')).toBe(1);
    e.removeAllListeners();
    expect(e.listenerCount('bar')).toBe(0);
  });
});
