/** @jsxImportSource react */
import type { RingConfig, RingSkinConfig, PointerConfigEntry } from 'pixi-wheels';
import type { StoredAsset } from '@/lib/studio/types.ts';
import { ColorInput, Field, NumberInput, Section, Select, TextInput, Toggle } from './fields.tsx';

interface Props {
  ring: RingConfig;
  onChange: (next: RingConfig) => void;
  assets: StoredAsset[];
  direction: 'cw' | 'ccw';
  onDirection: (d: 'cw' | 'ccw') => void;
}

export function WheelTab({ ring, onChange, assets, direction, onDirection }: Props) {
  const skin: RingSkinConfig = ring.skin ?? { type: 'graphics' };
  const setSkin = (patch: Record<string, unknown>) => onChange({ ...ring, skin: { ...skin, ...patch } as RingSkinConfig });
  const pointer: PointerConfigEntry = ring.pointers?.[0] ?? { angle: -90, facing: 'inward', tipInset: 18 };
  const setPointer = (patch: Partial<PointerConfigEntry>) => onChange({ ...ring, pointers: [{ ...pointer, ...patch }, ...(ring.pointers ?? []).slice(1)] });
  const pointerSkin = pointer.skin ?? { type: 'graphics' };
  const setPointerSkin = (patch: Record<string, unknown>) => setPointer({ skin: { ...pointerSkin, ...patch } });
  const textureKeys = assets.filter((a) => a.kind === 'texture').map((a) => a.key);
  const spineSkeletons = assets.filter((a) => a.kind === 'spine-skeleton').map((a) => a.key);
  const spineAtlases = assets.filter((a) => a.kind === 'spine-atlas').map((a) => a.key);
  const g = skin as Record<string, any>;

  return (
    <div className="p-4">
      <Section title="Geometry">
        <Field label="outer radius"><NumberInput value={ring.outerRadius} min={20} onChange={(v) => onChange({ ...ring, outerRadius: v })} /></Field>
        <Field label="inner radius"><NumberInput value={ring.innerRadius ?? 0} min={0} onChange={(v) => onChange({ ...ring, innerRadius: v })} /></Field>
        <Field label="start angle" hint="-90 puts section 0 at twelve o'clock"><NumberInput value={ring.startAngle ?? -90} step={5} onChange={(v) => onChange({ ...ring, startAngle: v })} /></Field>
        <Field label="spin direction"><Select value={direction} onChange={onDirection} options={[{ value: 'cw', label: 'clockwise' }, { value: 'ccw', label: 'counter-clockwise' }]} /></Field>
      </Section>

      <Section title="Pointer">
        <Field label="angle" hint="-90 top, 0 right, 90 bottom"><NumberInput value={pointer.angle ?? -90} step={5} onChange={(v) => setPointer({ angle: v })} /></Field>
        <Field label="facing"><Select value={pointer.facing ?? 'inward'} onChange={(v) => setPointer({ facing: v })} options={[{ value: 'inward', label: 'inward (on the rim)' }, { value: 'outward', label: 'outward (at the hub)' }]} /></Field>
        <Field label="tip inset"><NumberInput value={pointer.tipInset ?? 18} onChange={(v) => setPointer({ tipInset: v })} /></Field>
        <Field label="flap"><Toggle value={pointer.flap !== false} onChange={(v) => setPointer({ flap: v ? {} : false })} label={pointer.flap === false ? 'rigid' : 'springs on every divider'} /></Field>
        <Field label="pointer skin"><Select value={String(pointerSkin.type)} onChange={(v) => setPointer({ skin: v === 'graphics' ? { type: 'graphics' } : v === 'texture' ? { type: 'texture', texture: textureKeys[0] ?? '' } : { type: 'spine', skeleton: spineSkeletons[0] ?? '', atlas: spineAtlases[0] ?? '', length: 80 } })} options={[{ value: 'graphics', label: 'graphics' }, { value: 'texture', label: 'texture (upload)' }, { value: 'spine', label: 'spine (upload)' }]} /></Field>
        {pointerSkin.type === 'graphics' && (
          <>
            <Field label="shape"><Select value={String(pointerSkin.shape ?? 'tongue')} onChange={(v) => setPointerSkin({ shape: v })} options={[{ value: 'tongue', label: 'tongue' }, { value: 'triangle', label: 'triangle' }, { value: 'needle', label: 'needle' }]} /></Field>
            <Field label="colour"><ColorInput value={pointerSkin.color as number | undefined} onChange={(v) => setPointerSkin({ color: v })} /></Field>
            <Field label="length"><NumberInput value={Number(pointerSkin.length ?? 72)} onChange={(v) => setPointerSkin({ length: v })} /></Field>
            <Field label="width"><NumberInput value={Number(pointerSkin.width ?? 36)} onChange={(v) => setPointerSkin({ width: v })} /></Field>
          </>
        )}
        {pointerSkin.type === 'texture' && (
          <>
            <Field label="texture"><Select value={String(pointerSkin.texture ?? '')} onChange={(v) => setPointerSkin({ texture: v })} options={textureKeys.map((k) => ({ value: k, label: k }))} /></Field>
            <Field label="art points"><Select value={String(pointerSkin.artDirection ?? 'up')} onChange={(v) => setPointerSkin({ artDirection: v })} options={['up', 'right', 'down', 'left'].map((d) => ({ value: d, label: d }))} /></Field>
            <Field label="scale"><NumberInput value={Number(pointerSkin.scale ?? 1)} step={0.05} onChange={(v) => setPointerSkin({ scale: v })} /></Field>
          </>
        )}
        {pointerSkin.type === 'spine' && (
          <>
            <Field label="skeleton"><Select value={String(pointerSkin.skeleton ?? '')} onChange={(v) => setPointerSkin({ skeleton: v })} options={spineSkeletons.map((k) => ({ value: k, label: k }))} /></Field>
            <Field label="atlas"><Select value={String(pointerSkin.atlas ?? '')} onChange={(v) => setPointerSkin({ atlas: v })} options={spineAtlases.map((k) => ({ value: k, label: k }))} /></Field>
            <Field label="length (pin to tip)"><NumberInput value={Number(pointerSkin.length ?? 80)} onChange={(v) => setPointerSkin({ length: v })} /></Field>
            <Field label="tick animation"><TextInput value={String(pointerSkin.tickAnimation ?? 'tick')} onChange={(v) => setPointerSkin({ tickAnimation: v })} /></Field>
          </>
        )}
      </Section>

      <Section title="Skin">
        <Field label="type" className="col-span-2">
          <Select
            value={skin.type}
            onChange={(v) => onChange({ ...ring, skin: v === 'graphics' ? { type: 'graphics' } : v === 'debug' ? { type: 'debug' } : v === 'texture' ? { type: 'texture', face: textureKeys[0] ?? '' } : { type: 'spine', skeleton: spineSkeletons[0] ?? '', atlas: spineAtlases[0] ?? '' } })}
            options={[{ value: 'graphics', label: 'graphics (painted)' }, { value: 'debug', label: 'debug (plain)' }, { value: 'texture', label: 'texture (upload a face)' }, { value: 'spine', label: 'spine (upload a skeleton)' }]}
          />
        </Field>
        {skin.type === 'graphics' && (
          <>
            <Field label="shading"><Toggle value={g.shading !== false} onChange={(v) => setSkin({ shading: v })} label="depth vignette" /></Field>
            <Field label="labels"><Toggle value={g.labels !== false} onChange={(v) => setSkin({ labels: v })} label="draw labels" /></Field>
            <Field label="dividers"><Toggle value={g.dividers !== false} onChange={(v) => setSkin({ dividers: v ? {} : false })} label="between sections" /></Field>
            <Field label="rim"><Toggle value={g.rim !== false} onChange={(v) => setSkin({ rim: v ? {} : false })} label="outer ring" /></Field>
            <Field label="hub"><Toggle value={g.hub !== false} onChange={(v) => setSkin({ hub: v ? {} : false })} label="centre cap" /></Field>
            <Field label="bulbs"><NumberInput value={Number(g.bulbs?.count ?? 0)} min={0} onChange={(v) => setSkin({ bulbs: v > 0 ? { count: v } : false })} /></Field>
          </>
        )}
        {skin.type === 'texture' && (
          <>
            <Field label="face"><Select value={String(g.face ?? '')} onChange={(v) => setSkin({ face: v })} options={textureKeys.map((k) => ({ value: k, label: k }))} /></Field>
            <Field label="frame (fixed)"><Select value={String(g.frame ?? '')} onChange={(v) => setSkin({ frame: v || undefined })} options={[{ value: '', label: 'none' }, ...textureKeys.map((k) => ({ value: k, label: k }))]} /></Field>
            <Field label="face rotation"><NumberInput value={Number(g.faceRotation ?? 0)} step={1} onChange={(v) => setSkin({ faceRotation: v })} /></Field>
            <Field label="labels"><Toggle value={g.labels === true} onChange={(v) => setSkin({ labels: v })} label="draw labels over the face" /></Field>
          </>
        )}
        {skin.type === 'spine' && (
          <>
            <Field label="skeleton"><Select value={String(g.skeleton ?? '')} onChange={(v) => setSkin({ skeleton: v })} options={spineSkeletons.map((k) => ({ value: k, label: k }))} /></Field>
            <Field label="atlas"><Select value={String(g.atlas ?? '')} onChange={(v) => setSkin({ atlas: v })} options={spineAtlases.map((k) => ({ value: k, label: k }))} /></Field>
            <Field label="rotating bone" hint="empty = whole skeleton turns"><TextInput value={String(g.bone ?? '')} onChange={(v) => setSkin({ bone: v || undefined })} /></Field>
            <Field label="scale"><NumberInput value={Number(g.scale ?? 1)} step={0.05} onChange={(v) => setSkin({ scale: v })} /></Field>
          </>
        )}
        {textureKeys.length === 0 && skin.type === 'texture' && <p className="col-span-2 text-[11px] text-destructive">Upload a face image in the Assets tab first.</p>}
      </Section>
    </div>
  );
}
