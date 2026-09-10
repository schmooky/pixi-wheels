/** @jsxImportSource react */
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CanvasSkeletonProps {
  /** Number of wedges in the placeholder wheel. Default 8. */
  wedges?: number;
  /** Optional caption under the spinner. */
  label?: string;
  className?: string;
}

/**
 * Greyed-out wheel placeholder shown while a recipe's PixiJS canvas is
 * compiling or booting. Styling only; never mounts a canvas.
 */
export function CanvasSkeleton({ wedges = 8, label = 'Loading interactive demo...', className }: CanvasSkeletonProps) {
  const r = 44;
  const paths = Array.from({ length: wedges }, (_, i) => {
    const a0 = (i / wedges) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / wedges) * Math.PI * 2 - Math.PI / 2;
    const x0 = 50 + Math.cos(a0) * r;
    const y0 = 50 + Math.sin(a0) * r;
    const x1 = 50 + Math.cos(a1) * r;
    const y1 = 50 + Math.sin(a1) * r;
    return `M50 50 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  });
  return (
    <div
      className={cn('absolute inset-0 flex flex-col items-center justify-center gap-4', 'bg-card/95 backdrop-blur-sm', 'animate-in fade-in duration-200', className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <svg viewBox="0 0 100 100" className="h-24 w-24 opacity-30" aria-hidden>
        {paths.map((d, i) => (
          <path key={i} d={d} className="fill-muted-foreground animate-pulse" style={{ opacity: i % 2 === 0 ? 0.9 : 0.5, animationDelay: `${i * 90}ms` }} />
        ))}
        <circle cx="50" cy="50" r="7" className="fill-background" />
        <path d="M50 -2 L45 10 L55 10 Z" className="fill-foreground" />
      </svg>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" strokeWidth={2.25} />
        <span>{label}</span>
      </div>
    </div>
  );
}
