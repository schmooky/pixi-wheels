import { zipSync, strToU8 } from 'fflate';

/** Zip text files plus binary assets and trigger a browser download. */
export function downloadZip(name: string, textFiles: Record<string, string>, binaryFiles: Record<string, Uint8Array>): void {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, text] of Object.entries(textFiles)) entries[path] = strToU8(text);
  for (const [path, bytes] of Object.entries(binaryFiles)) entries[path] = bytes;
  const zipped = zipSync(entries, { level: 6 });
  downloadBytes(name, zipped, 'application/zip');
}

export function downloadText(name: string, text: string, mime = 'application/json'): void {
  downloadBytes(name, strToU8(text), mime);
}

function downloadBytes(name: string, bytes: Uint8Array, mime: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
