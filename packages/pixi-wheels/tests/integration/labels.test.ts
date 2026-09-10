import { Container, Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { RingGeometry } from '../../src/core/RingGeometry.js';
import { SectionLabels } from '../../src/skins/labels.js';
import type { LabelContext } from '../../src/config/types.js';

const box = (w: number, h: number) => new Graphics().rect(-w / 2, -h / 2, w, h).fill(0xffffff);

describe('SectionLabels with rich content', () => {
  it('places, rotates and fits a content container per section', () => {
    const seen: LabelContext[] = [];
    const geometry = new RingGeometry([
      { id: 'a', weight: 1, content: (ctx) => (seen.push(ctx), box(400, 40)), style: { labelOrientation: 'radial', labelRadius: 0.5 } },
      { id: 'b', weight: 1, content: box(10, 10), style: { labelOrientation: 'tangential' } },
      { id: 'c', weight: 1, content: box(10, 10), style: { labelOrientation: 'tangential-in' } },
      { id: 'd', weight: 1, content: box(10, 10), style: { labelOrientation: 'upright' } },
    ]);
    const parent = new Container();
    const labels = new SectionLabels(parent);
    labels.layout(geometry.sections, 200, 0);

    expect(parent.children).toHaveLength(4);
    expect(seen).toHaveLength(1);
    expect(seen[0].section.id).toBe('a');
    expect(seen[0].slot.radius).toBe(100);

    const a = labels.get('a')!;
    const [sa] = geometry.sections;
    expect(a.rotation).toBeCloseTo((sa.midAngle * Math.PI) / 180);
    expect(Math.hypot(a.position.x, a.position.y)).toBeCloseTo(100);
    // 400 wide into a radial room of 192: shrinks; a 10x10 box stays at 1.
    expect(a.scale.x).toBeCloseTo(192 / 400);
    expect(labels.get('b')!.scale.x).toBe(1);
    expect(labels.get('b')!.rotation).toBeCloseTo((geometry.sections[1].midAngle * Math.PI) / 180 + Math.PI / 2);
    expect(labels.get('c')!.rotation).toBeCloseTo((geometry.sections[2].midAngle * Math.PI) / 180 - Math.PI / 2);

    labels.syncRotation(90);
    expect(labels.get('d')!.rotation).toBeCloseTo(-Math.PI / 2);
    expect(labels.text('a')).toBeUndefined();
  });

  it('builds content once, rebuilds when the content changes, and re-fits on new geometry', () => {
    let built = 0;
    const factory = () => {
      built++;
      return box(300, 300);
    };
    const geometry = new RingGeometry([
      { id: 'a', weight: 1, content: factory },
      { id: 'b', weight: 1, content: box(10, 10) },
    ]);
    const parent = new Container();
    const labels = new SectionLabels(parent);
    labels.layout(geometry.sections, 200, 0);
    labels.layout(geometry.sections, 200, 0);
    expect(built).toBe(1);
    const before = labels.get('a')!.scale.x;

    geometry.setWeights({ a: 0.2, b: 1 });
    labels.layout(geometry.sections, 200, 0);
    expect(built).toBe(1);
    expect(labels.get('a')!.scale.x).toBeLessThan(before);

    const other = new RingGeometry([
      { id: 'a', weight: 1, content: () => box(5, 5) },
      { id: 'b', weight: 1, content: box(10, 10) },
    ]);
    const previous = labels.get('a');
    labels.layout(other.sections, 200, 0);
    expect(labels.get('a')).not.toBe(previous);
    expect(previous!.destroyed).toBe(true);

    labels.destroy();
    expect(parent.children).toHaveLength(0);
  });

  it('honours labelFit none and drops sections that lose their content', () => {
    const geometry = new RingGeometry([
      { id: 'a', weight: 1, content: box(1000, 1000), style: { labelFit: 'none' } },
      { id: 'b', weight: 1, label: '' },
    ]);
    const parent = new Container();
    const labels = new SectionLabels(parent);
    labels.layout(geometry.sections, 200, 0);
    expect(parent.children).toHaveLength(1);
    expect(labels.get('a')!.scale.x).toBe(1);
  });
});
