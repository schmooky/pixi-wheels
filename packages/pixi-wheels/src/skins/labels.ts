import { Text, TextStyle, type Container } from 'pixi.js';
import type { ResolvedSection } from '../config/types.js';
import { DEG_TO_RAD } from '../utils/angles.js';

/**
 * One `Text` per section, placed at the section's middle angle. Shared by
 * the graphics and texture skins so labels behave the same on both: radial
 * or tangential, auto-fitted to the room the section has, and re-centred
 * every time a dynamic section moves.
 */
export class SectionLabels {
  private readonly _texts = new Map<string, Text>();
  private _uprightIds = new Set<string>();
  private _discRotation = 0;

  constructor(private readonly _parent: Container) {}

  layout(sections: readonly ResolvedSection[], outerRadius: number, innerRadius: number): void {
    const seen = new Set<string>();
    for (const s of sections) {
      seen.add(s.id);
      if (s.label === '') {
        this._remove(s.id);
        continue;
      }
      let text = this._texts.get(s.id);
      if (!text) {
        text = new Text({ text: s.label, style: new TextStyle({ align: 'center' }) });
        text.anchor.set(0.5);
        text.label = `pixi-wheels:label:${s.id}`;
        this._parent.addChild(text);
        this._texts.set(s.id, text);
      }
      text.text = s.label;
      const st = s.style;
      text.style.fontFamily = st.labelFont;
      text.style.fontSize = st.labelSize;
      text.style.fill = st.labelColor;
      text.style.fontWeight = st.labelWeight as TextStyle['fontWeight'];
      const radius = outerRadius * st.labelRadius;
      const mid = s.midAngle * DEG_TO_RAD;
      text.position.set(Math.cos(mid) * radius, Math.sin(mid) * radius);
      // Fit: radial text has the radial room, tangential text the chord at its radius.
      const chord = 2 * radius * Math.sin(Math.min(Math.PI, (s.arc * DEG_TO_RAD) / 2));
      const radialRoom = Math.max(8, (outerRadius - innerRadius) * 0.82);
      text.scale.set(1);
      const w = text.width;
      const h = text.height;
      if (st.labelOrientation === 'radial') {
        text.rotation = mid;
        const fit = Math.min(1, radialRoom / Math.max(1, w), (chord * 0.92) / Math.max(1, h));
        text.scale.set(fit);
        this._uprightIds.delete(s.id);
      } else if (st.labelOrientation === 'tangential') {
        text.rotation = mid + Math.PI / 2;
        const fit = Math.min(1, (chord * 0.92) / Math.max(1, w), radialRoom / Math.max(1, h));
        text.scale.set(fit);
        this._uprightIds.delete(s.id);
      } else {
        const fit = Math.min(1, (chord * 0.92) / Math.max(1, w), radialRoom / Math.max(1, h));
        text.scale.set(fit);
        this._uprightIds.add(s.id);
        text.rotation = -this._discRotation * DEG_TO_RAD;
      }
    }
    for (const id of [...this._texts.keys()]) if (!seen.has(id)) this._remove(id);
  }

  /** Keep `'upright'` labels upright as the disc turns. */
  syncRotation(discRotationDeg: number): void {
    this._discRotation = discRotationDeg;
    if (this._uprightIds.size === 0) return;
    const rot = -discRotationDeg * DEG_TO_RAD;
    for (const id of this._uprightIds) {
      const t = this._texts.get(id);
      if (t) t.rotation = rot;
    }
  }

  get(id: string): Text | undefined {
    return this._texts.get(id);
  }

  private _remove(id: string): void {
    const t = this._texts.get(id);
    if (!t) return;
    this._parent.removeChild(t);
    t.destroy();
    this._texts.delete(id);
    this._uprightIds.delete(id);
  }

  destroy(): void {
    for (const id of [...this._texts.keys()]) this._remove(id);
  }
}
