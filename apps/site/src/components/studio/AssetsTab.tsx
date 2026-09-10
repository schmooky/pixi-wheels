/** @jsxImportSource react */
import { useRef } from 'react';
import { Trash2, Upload } from 'lucide-react';
import type { StoredAsset } from '@/lib/studio/types.ts';
import { SmallButton } from './fields.tsx';

interface Props {
  assets: StoredAsset[];
  onUpload: (files: FileList) => void;
  onDelete: (key: string) => void;
}

export function AssetsTab({ assets, onUpload, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Your assets ({assets.length})</div>
        <SmallButton tone="primary" onClick={() => inputRef.current?.click()}><Upload size={11} /> Upload</SmallButton>
        <input ref={inputRef} type="file" multiple accept=".png,.webp,.jpg,.jpeg,.avif,.json,.skel,.atlas" className="hidden" onChange={(e) => e.target.files && onUpload(e.target.files)} />
      </div>
      <p className="mb-4 text-[11px] text-muted-foreground">
        Images become textures the Wheel tab can pick as a face, a frame or a pointer. A Spine bundle is its skeleton (.json), its .atlas and every page image the atlas names, uploaded with the same file names. Files stay in this browser (IndexedDB) and go into the exported project under <code>public/assets/</code>.
      </p>
      {assets.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Nothing uploaded yet.</div>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {assets.map((a) => (
          <li key={a.key} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2">
            <AssetThumb asset={a} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-[11px]">{a.key}</div>
              <div className="text-[10px] text-muted-foreground">{a.kind} - {(a.size / 1024).toFixed(0)} KB</div>
            </div>
            <SmallButton tone="danger" onClick={() => onDelete(a.key)} title="Remove"><Trash2 size={11} /></SmallButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssetThumb({ asset }: { asset: StoredAsset }) {
  if (asset.kind !== 'texture') {
    return <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-muted font-mono text-[9px] text-muted-foreground">{asset.key.split('.').pop()}</div>;
  }
  const url = URL.createObjectURL(asset.blob);
  return <img src={url} alt={asset.key} className="h-10 w-10 flex-shrink-0 rounded object-contain bg-muted" onLoad={() => URL.revokeObjectURL(url)} />;
}
