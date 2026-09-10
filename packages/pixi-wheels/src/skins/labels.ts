import { type Container, Text, TextStyle } from 'pixi.js';
import type { LabelContent, LabelContext, ResolvedSection } from '../config/types.js';
import { DEG_TO_RAD } from '../utils/angles.js';
import { fitContainer, labelSlot } from '../utils/fit.js';

interface LabelItem {
  view: Container;
  /** The text object when the label is plain text; null for rich content. */
  text: Text | null;
  /** The `content` the view was built from, to notice a swap. */
  source: LabelContent | null;
}

/**
 * One label per section, placed at the section's middle angle. Shared by the
 * graphics, texture and Spine skins so labels behave the same everywhere:
 * radial, tangential or upright, fitted to the room the section has, and
 * re-centred every time a dynamic section moves.
 *
 * A label is the section's `label` string as a `Text`, or its `content`: any
 * container (an icon, a bitmap text, a Spine instance, a group). Content is
 * built once per section, fitted with `labelFit`, and rebuilt when the
 * section is given a different `content`.
 */
export class SectionLabels {
  private readonly _items = new Map<string, LabelItem>();
  private _uprightIds = new Set<string>();
  private _discRotation = 0;

  constructor(private readonly _parent: Container) {}

  layout(sections: readonly ResolvedSection[], outerRadius: number, innerRadius: number): void {
    const seen = new Set<string>();
    for (const s of sections) {
      seen.add(s.id);
      const rich = s.content !== undefined;
      if (!rich && s.label === '') {
        this._remove(s.id);
        continue;
      }
      const st = s.style;
      const slot = labelSlot(s, outerRadius, innerRadius, { radius: st.labelRadius, orientation: st.labelOrientation });
      let item = this._items.get(s.id);
      if (item && (rich ? item.source !== s.content : item.text === null)) {
        this._remove(s.id);
        item = undefined;
      }
      if (!item) {
        let view: Container;
        let text: Text | null = null;
        if (rich) {
          const content = s.content as LabelContent;
          const ctx: LabelContext = {
            section: s,
            outerRadius,
            innerRadius,
            slot,
            fit: (obj, options) => fitContainer(obj, slot, options),
          };
          view = typeof content === 'function' ? content(ctx) : content;
        } else {
          text = new Text({ text: s.label, style: new TextStyle({ align: 'center' }) });
          text.anchor.set(0.5);
          view = text;
        }
        if (!view.label) view.label = `pixi-wheels:label:${s.id}`;
        this._parent.addChild(view);
        item = { view, text, source: rich ? (s.content as LabelContent) : null };
        this._items.set(s.id, item);
      }
      const { view, text } = item;
      if (text) {
        text.text = s.label;
        text.style.fontFamily = st.labelFont;
        text.style.fontSize = st.labelSize;
        text.style.fill = st.labelColor;
        text.style.fontWeight = st.labelWeight as TextStyle['fontWeight'];
      }
      const mid = s.midAngle * DEG_TO_RAD;
      view.position.set(Math.cos(mid) * slot.radius, Math.sin(mid) * slot.radius);
      switch (st.labelOrientation) {
        case 'radial':
          view.rotation = mid;
          this._uprightIds.delete(s.id);
          break;
        case 'tangential':
          view.rotation = mid + Math.PI / 2;
          this._uprightIds.delete(s.id);
          break;
        case 'tangential-in':
          view.rotation = mid - Math.PI / 2;
          this._uprightIds.delete(s.id);
          break;
        default:
          this._uprightIds.add(s.id);
          view.rotation = -this._discRotation * DEG_TO_RAD;
      }
      fitContainer(view, slot, { mode: st.labelFit });
    }
    for (const id of [...this._items.keys()]) if (!seen.has(id)) this._remove(id);
  }

  /** Keep `'upright'` labels upright as the disc turns. */
  syncRotation(discRotationDeg: number): void {
    this._discRotation = discRotationDeg;
    if (this._uprightIds.size === 0) return;
    const rot = -discRotationDeg * DEG_TO_RAD;
    for (const id of this._uprightIds) {
      const item = this._items.get(id);
      if (item) item.view.rotation = rot;
    }
  }

  /** The label view of a section: its `Text`, or the content container. */
  get(id: string): Container | undefined {
    return this._items.get(id)?.view;
  }

  /** The `Text` of a plain text label; undefined for rich content. */
  text(id: string): Text | undefined {
    return this._items.get(id)?.text ?? undefined;
  }

  private _remove(id: string): void {
    const item = this._items.get(id);
    if (!item) return;
    this._parent.removeChild(item.view);
    item.view.destroy({ children: true });
    this._items.delete(id);
    this._uprightIds.delete(id);
  }

  destroy(): void {
    for (const id of [...this._items.keys()]) this._remove(id);
  }
}
