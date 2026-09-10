/** @jsxImportSource react */
import { ArrowDown, ArrowUp, Plus, Trash2, Camera } from 'lucide-react';
import type { RingConfig, WheelSectionConfig } from 'pixi-wheels';
import { ColorInput, Field, NumberInput, Section, SmallButton, TextInput } from './fields.tsx';

interface Props {
  ring: RingConfig;
  onChange: (next: RingConfig) => void;
}

export function SectionsTab({ ring, onChange }: Props) {
  const sections = ring.sections;
  const set = (i: number, patch: Partial<WheelSectionConfig>) => {
    const next = sections.map((s, k) => (k === i ? { ...s, ...patch } : s));
    onChange({ ...ring, sections: next });
  };
  const setStyle = (i: number, patch: Partial<NonNullable<WheelSectionConfig['style']>>) => {
    const s = sections[i];
    const style = { ...(s.style ?? {}), ...patch };
    for (const k of Object.keys(style) as Array<keyof typeof style>) if (style[k] === undefined) delete style[k];
    set(i, { style: Object.keys(style).length ? style : undefined });
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...ring, sections: next });
  };
  const remove = (i: number) => {
    if (sections.length <= 2) return;
    const id = sections[i].id;
    const dynamic = ring.dynamic ? { ...ring.dynamic, steps: ring.dynamic.steps.map((st) => Object.fromEntries(Object.entries(st).filter(([k]) => k !== id))) } : undefined;
    onChange({ ...ring, sections: sections.filter((_, k) => k !== i), dynamic });
  };
  const add = () => {
    let n = sections.length + 1;
    while (sections.some((s) => s.id === `s${n}`)) n++;
    onChange({ ...ring, sections: [...sections, { id: `s${n}`, label: `S${n}`, weight: 1 }] });
  };
  const steps = ring.dynamic?.steps ?? [];
  const snapshotStep = () => {
    const weights = Object.fromEntries(sections.map((s) => [s.id, s.weight ?? 1]));
    onChange({ ...ring, dynamic: { ...(ring.dynamic ?? { durationMs: 600 }), steps: [...steps, weights] } });
  };
  const removeStep = (i: number) => {
    const next = steps.filter((_, k) => k !== i);
    onChange({ ...ring, dynamic: next.length ? { ...ring.dynamic!, steps: next } : undefined });
  };

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Sections ({sections.length})</div>
        <SmallButton onClick={add} tone="primary"><Plus size={11} /> Add section</SmallButton>
      </div>
      <div className="space-y-2">
        {sections.map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-background/40 p-2">
            <div className="grid grid-cols-[1fr_1fr_0.7fr_0.6fr_auto] items-end gap-2">
              <Field label="id"><TextInput value={s.id} onChange={(v) => set(i, { id: v })} /></Field>
              <Field label="label"><TextInput value={s.label ?? ''} onChange={(v) => set(i, { label: v })} placeholder="(id)" /></Field>
              <Field label="value"><TextInput value={s.value === undefined ? '' : String(s.value)} onChange={(v) => set(i, { value: v === '' ? undefined : Number.isFinite(Number(v)) && v.trim() !== '' ? Number(v) : v })} /></Field>
              <Field label="weight"><NumberInput value={s.weight ?? 1} step={0.1} min={0.01} onChange={(v) => set(i, { weight: v > 0 ? v : 0.01 })} /></Field>
              <div className="flex items-center gap-1 pb-0.5">
                <SmallButton onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><ArrowUp size={11} /></SmallButton>
                <SmallButton onClick={() => move(i, 1)} disabled={i === sections.length - 1} title="Move down"><ArrowDown size={11} /></SmallButton>
                <SmallButton onClick={() => remove(i)} tone="danger" disabled={sections.length <= 2} title="Remove"><Trash2 size={11} /></SmallButton>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[auto_auto_1fr_1fr] items-end gap-3">
              <Field label="fill"><ColorInput value={s.style?.fill} onChange={(v) => setStyle(i, { fill: v })} /></Field>
              <Field label="label colour"><ColorInput value={s.style?.labelColor} onChange={(v) => setStyle(i, { labelColor: v })} /></Field>
              <Field label="label size"><NumberInput value={s.style?.labelSize ?? 26} min={6} onChange={(v) => setStyle(i, { labelSize: v })} /></Field>
              <Field label="label orientation">
                <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" value={s.style?.labelOrientation ?? 'radial'} onChange={(e) => setStyle(i, { labelOrientation: e.target.value as 'radial' })}>
                  <option value="radial">radial</option>
                  <option value="tangential">tangential</option>
                  <option value="tangential-in">tangential-in</option>
                  <option value="upright">upright</option>
                </select>
              </Field>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Dynamic steps ({steps.length})</div>
        <SmallButton onClick={snapshotStep}><Camera size={11} /> Snapshot current weights as a step</SmallButton>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">Each step is a set of weights the wheel animates to. Set the weights above, snapshot, repeat. The canvas has a Step button when there are steps.</p>
      {steps.length > 0 && (
        <Section title="Transition">
          <Field label="duration ms"><NumberInput value={ring.dynamic?.durationMs ?? 600} min={0} step={50} onChange={(v) => onChange({ ...ring, dynamic: { ...ring.dynamic!, durationMs: v } })} /></Field>
          <Field label="ease"><TextInput value={String(ring.dynamic?.ease ?? 'sine.inOut')} onChange={(v) => onChange({ ...ring, dynamic: { ...ring.dynamic!, ease: v } })} /></Field>
        </Section>
      )}
      <div className="space-y-1">
        {steps.map((st, i) => (
          <div key={i} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1 font-mono text-[11px]">
            <span className="truncate">step {i}: {Object.entries(st).map(([k, v]) => `${k}=${v}`).join(' ')}</span>
            <SmallButton onClick={() => removeStep(i)} tone="danger"><Trash2 size={11} /></SmallButton>
          </div>
        ))}
      </div>
    </div>
  );
}
