// Technique clips (GIFs) live in IndexedDB, not localStorage: a few clips
// would blow through localStorage's ~5 MB, and IndexedDB stores Blobs as-is.
// A plan only holds the clip's id, so plans stay small JSON.

import { useEffect, useState } from 'react';
import type { ClassPlan, Clip } from './plan.ts';

const DB_NAME = 'maestranada'; // the app's first name; kept so saved clips still load
const STORE = 'clips';

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export function putClip(id: string, blob: Blob): Promise<IDBValidKey> {
  // Ask the browser not to evict the coach's clips under storage pressure.
  void navigator.storage?.persist?.().catch(() => {});
  return run('readwrite', (s) => s.put(blob, id));
}

export function getClip(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>('readonly', (s) => s.get(id));
}

export function deleteClip(id: string): Promise<undefined> {
  return run('readwrite', (s) => s.delete(id));
}

export function clipIds(plans: ClassPlan[]): Set<string> {
  const ids = new Set<string>();
  for (const p of plans) for (const m of p.gems.moves) if (m.clip) ids.add(m.clip.id);
  return ids;
}

/** Removes stored clips no plan points at any more (a replaced clip, a deleted class). */
export async function pruneClips(plans: ClassPlan[]): Promise<void> {
  const keep = clipIds(plans);
  const keys = await run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  await Promise.all(keys.filter((k) => !keep.has(String(k))).map((k) => deleteClip(String(k))));
}

/** An object URL for a stored clip, revoked when the component lets go of it. */
export function useClipUrl(clip: Clip | undefined): string | null {
  return useClip(clip).url;
}

/** The clip's object URL, and whether the plan points at a clip this device no longer has. */
export function useClip(clip: Clip | undefined): { url: string | null; missing: boolean } {
  const [state, setState] = useState<{ url: string | null; missing: boolean }>({ url: null, missing: false });
  const id = clip?.id;
  useEffect(() => {
    setState({ url: null, missing: false });
    if (!id) return;
    let live = true;
    let made: string | null = null;
    getClip(id)
      .then((blob) => {
        if (!live) return;
        if (!blob) {
          setState({ url: null, missing: true });
          return;
        }
        made = URL.createObjectURL(blob);
        setState({ url: made, missing: false });
      })
      .catch(() => live && setState({ url: null, missing: true }));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return state;
}

// ─── Backups: clips travel inside the exported JSON as data URLs ─────────────

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return new Blob([bytes], { type: m[1] || 'application/octet-stream' });
}

/** Plans plus their clips, ready to write to a backup file. */
export async function withClipData(plans: ClassPlan[]): Promise<Array<ClassPlan & { clipData?: Record<string, string> }>> {
  return Promise.all(
    plans.map(async (p) => {
      const clipData: Record<string, string> = {};
      for (const m of p.gems.moves) {
        if (!m.clip) continue;
        const blob = await getClip(m.clip.id).catch(() => undefined);
        if (blob) clipData[m.clip.id] = await blobToDataUrl(blob);
      }
      return Object.keys(clipData).length ? { ...p, clipData } : p;
    }),
  );
}

/** Stores any clips carried in an imported backup. */
export async function restoreClipData(raw: unknown[]): Promise<void> {
  for (const r of raw) {
    const data = (r as { clipData?: unknown } | null)?.clipData;
    if (!data || typeof data !== 'object') continue;
    for (const [id, url] of Object.entries(data as Record<string, unknown>)) {
      const blob = typeof url === 'string' ? dataUrlToBlob(url) : null;
      if (blob) await putClip(id, blob);
    }
  }
}
