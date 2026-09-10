import type { StoredAsset } from './types.ts';

const DB_NAME = 'pixi-wheels-studio';
const DB_VERSION = 1;
const STORE = 'assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
  });
}

function txPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listAssets(): Promise<StoredAsset[]> {
  const db = await openDB();
  try {
    return (await txPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())) as StoredAsset[];
  } finally {
    db.close();
  }
}

export async function putAsset(asset: StoredAsset): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(asset);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteAsset(key: string): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

async function sha256(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function kindOf(file: File): StoredAsset['kind'] {
  const name = file.name.toLowerCase();
  if (/\.(png|webp|jpe?g|avif|gif)$/.test(name) || file.type.startsWith('image/')) return 'texture';
  if (name.endsWith('.atlas')) return 'spine-atlas';
  if (name.endsWith('.json') || name.endsWith('.skel')) return 'spine-skeleton';
  return 'other';
}

/** Store an uploaded file under its file name. Re-uploading a name replaces it. */
export async function ingestFile(file: File): Promise<StoredAsset> {
  const asset: StoredAsset = {
    hash: await sha256(file),
    key: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    blob: file,
    kind: kindOf(file),
  };
  await putAsset(asset);
  return asset;
}
