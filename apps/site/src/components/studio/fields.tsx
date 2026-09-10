/** @jsxImportSource react */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs', className)}>
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
    </label>
  );
}

const inputCls = 'h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

export function NumberInput({ value, onChange, step = 1, min, max }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return <input type="number" className={inputCls} value={Number.isFinite(value) ? value : ''} step={step} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />;
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function ColorInput({ value, onChange }: { value: number | undefined; onChange: (v: number | undefined) => void }) {
  const hex = value === undefined ? '#888888' : `#${value.toString(16).padStart(6, '0')}`;
  return (
    <div className="flex items-center gap-2">
      <input type="color" className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-0.5" value={hex} onChange={(e) => onChange(parseInt(e.target.value.slice(1), 16))} />
      <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onChange(undefined)} title="Use the palette colour">auto</button>
    </div>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-current" />
      <span>{label}</span>
    </label>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

export function SmallButton({ onClick, children, tone = 'default', disabled, title }: { onClick: () => void; children: ReactNode; tone?: 'default' | 'primary' | 'danger'; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-50',
        tone === 'primary' && 'border-primary bg-primary text-primary-foreground hover:brightness-110',
        tone === 'danger' && 'border-destructive/50 text-destructive hover:bg-destructive/10',
        tone === 'default' && 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
