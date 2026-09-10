/** @jsxImportSource react */
import type { WheelConfig, SpinProfile, SettleConfig } from 'pixi-wheels';
import { SpinPresets, EASE_NAMES } from 'pixi-wheels';
import { Field, NumberInput, Section, Select, SmallButton, Toggle } from './fields.tsx';

interface Props {
  config: WheelConfig;
  onChange: (next: WheelConfig) => void;
}

const easeOptions = EASE_NAMES.map((n) => ({ value: n, label: n }));

export function SpinTab({ config, onChange }: Props) {
  const speeds = config.speeds ?? { normal: SpinPresets.NORMAL };
  const name = config.initialSpeed && speeds[config.initialSpeed] ? config.initialSpeed : Object.keys(speeds)[0];
  const profile: SpinProfile = speeds[name];
  const setProfile = (patch: Partial<SpinProfile>) => onChange({ ...config, speeds: { ...speeds, [name]: { ...profile, ...patch } } });
  const landing = config.landing ?? {};
  const setLanding = (patch: typeof landing) => onChange({ ...config, landing: { ...landing, ...patch } });
  const settle: SettleConfig = typeof landing.settle === 'string' ? { mode: landing.settle } : landing.settle ?? { mode: 'none' };
  const setSettle = (patch: Partial<SettleConfig>) => setLanding({ settle: { ...settle, ...patch } });
  const skip = config.skip ?? {};
  const idle = config.idle;

  return (
    <div className="p-4">
      <Section title={`Speed profile "${name}"`}>
        <Field label="profile" className="col-span-2">
          <div className="flex flex-wrap items-center gap-1">
            {Object.keys(speeds).map((n) => (
              <SmallButton key={n} tone={n === name ? 'primary' : 'default'} onClick={() => onChange({ ...config, initialSpeed: n })}>{n}</SmallButton>
            ))}
            {(['NORMAL', 'TURBO', 'CINEMATIC', 'QUICK'] as const).map((p) => (
              <SmallButton key={p} onClick={() => onChange({ ...config, speeds: { ...speeds, [p.toLowerCase()]: SpinPresets[p] }, initialSpeed: p.toLowerCase() })} title={`Add the ${p} preset`}>+ {p.toLowerCase()}</SmallButton>
            ))}
          </div>
        </Field>
        <Field label="cruise speed deg/s"><NumberInput value={profile.spinSpeed} min={1} step={10} onChange={(v) => setProfile({ spinSpeed: v })} /></Field>
        <Field label="acceleration ms"><NumberInput value={profile.accelerationMs} min={0} step={50} onChange={(v) => setProfile({ accelerationMs: v })} /></Field>
        <Field label="acceleration ease"><Select value={String(profile.accelerationEase ?? 'power2.in')} onChange={(v) => setProfile({ accelerationEase: v })} options={easeOptions} /></Field>
        <Field label="minimum spin ms"><NumberInput value={profile.minimumSpinTime} min={0} step={100} onChange={(v) => setProfile({ minimumSpinTime: v })} /></Field>
        <Field label="min cruise ms"><NumberInput value={profile.minCruiseMs} min={0} step={50} onChange={(v) => setProfile({ minCruiseMs: v })} /></Field>
        <Field label="stop duration ms" hint="the planner gets as close as the turn count allows"><NumberInput value={profile.stopDuration} min={1} step={100} onChange={(v) => setProfile({ stopDuration: v })} /></Field>
        <Field label="stop ease" hint="an ease-out; its start is matched to the cruise speed"><Select value={String(profile.stopEase ?? 'power3.out')} onChange={(v) => setProfile({ stopEase: v })} options={easeOptions} /></Field>
        <Field label="min turns"><NumberInput value={profile.minTurns} min={0} onChange={(v) => setProfile({ minTurns: v })} /></Field>
        <Field label="max turns"><NumberInput value={profile.maxTurns} min={0} onChange={(v) => setProfile({ maxTurns: v })} /></Field>
        <Field label="skip duration ms"><NumberInput value={profile.skipDuration} min={1} step={50} onChange={(v) => setProfile({ skipDuration: v })} /></Field>
      </Section>

      <Section title="Landing">
        <Field label="where in the section"><Select value={landing.mode ?? 'center'} onChange={(v) => setLanding({ mode: v })} options={[{ value: 'center', label: 'center' }, { value: 'random', label: 'random' }, { value: 'exact', label: 'exact (offset from the target)' }]} /></Field>
        <Field label="random margin" hint="fraction of the arc kept clear of the edges"><NumberInput value={landing.margin ?? 0.12} step={0.01} min={0} max={0.49} onChange={(v) => setLanding({ margin: v })} /></Field>
        <Field label="settle"><Select value={settle.mode} onChange={(v) => setSettle({ mode: v })} options={[{ value: 'none', label: 'none' }, { value: 'center', label: 'glide to the middle' }, { value: 'bounce', label: 'bounce' }]} /></Field>
        {settle.mode !== 'none' && (
          <>
            <Field label="settle delay ms"><NumberInput value={settle.delayMs ?? 250} min={0} step={50} onChange={(v) => setSettle({ delayMs: v })} /></Field>
            <Field label="settle duration ms"><NumberInput value={settle.durationMs ?? 600} min={1} step={50} onChange={(v) => setSettle({ durationMs: v })} /></Field>
            <Field label="settle ease"><Select value={String(settle.ease ?? 'sine.inOut')} onChange={(v) => setSettle({ ease: v })} options={easeOptions} /></Field>
            {settle.mode === 'bounce' && <Field label="bounce deg"><NumberInput value={settle.bounceDeg ?? 4} step={0.5} onChange={(v) => setSettle({ bounceDeg: v })} /></Field>}
          </>
        )}
      </Section>

      <Section title="Skip">
        <Field label="allowed"><Toggle value={skip.allowed !== false} onChange={(v) => onChange({ ...config, skip: { ...skip, allowed: v } })} label="the player may skip" /></Field>
        <Field label="not before ms"><NumberInput value={skip.minimumSpinTime ?? 0} min={0} step={100} onChange={(v) => onChange({ ...config, skip: { ...skip, minimumSpinTime: v } })} /></Field>
        <Field label="protect anticipation" className="col-span-2"><Toggle value={skip.protectAnticipation === true} onChange={(v) => onChange({ ...config, skip: { ...skip, protectAnticipation: v } })} label="first press jumps to the bait, second lands" /></Field>
      </Section>

      <Section title="Idle">
        <Field label="idle"><Toggle value={!!idle} onChange={(v) => onChange({ ...config, idle: v ? { speed: 14, autoStart: true, rampMs: 800 } : undefined })} label="turn slowly between spins" /></Field>
        {idle && (
          <>
            <Field label="speed deg/s"><NumberInput value={idle.speed} min={0.1} step={1} onChange={(v) => onChange({ ...config, idle: { ...idle, speed: v } })} /></Field>
            <Field label="ramp ms"><NumberInput value={idle.rampMs ?? 600} min={0} step={100} onChange={(v) => onChange({ ...config, idle: { ...idle, rampMs: v } })} /></Field>
            <Field label="auto start"><Toggle value={idle.autoStart !== false} onChange={(v) => onChange({ ...config, idle: { ...idle, autoStart: v } })} label="idles from the first frame" /></Field>
          </>
        )}
      </Section>
    </div>
  );
}
