// The free version and the unlock. Every coach can make three classes for
// free; after that, a new class asks for the $10 unlock. Classes already made
// always open, teach and print. There are no accounts: Lemon Squeezy issues a
// license key, the app checks it once while online and remembers it here, and
// from then on it works offline for good. Someone determined can get around
// this by clearing storage. At $10 that's fine.

import { useSyncExternalStore } from 'react';
import type { ClassPlan } from './plan.ts';

export const FREE_CLASSES = 3;

/** The Lemon Squeezy checkout link. Until it's set, the unlock sheet only takes a key. */
export const CHECKOUT_URL = '';
/** The Lemon Squeezy product id. When set, keys for any other product are turned down. */
export const PRODUCT_ID = 0;

const MADE_KEY = 'maestranada.made';
const UNLOCK_KEY = 'maestranada.unlock';
const LS_VALIDATE = 'https://api.lemonsqueezy.com/v1/licenses/validate';

export interface Unlock {
  key: string;
  /** When the key was checked with Lemon Squeezy. */
  at: string;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: it lasts until the tab closes.
  }
}

// ---- Classes made ----

/**
 * Every class the coach has made here, by id. Deleting one never takes it off,
 * so the count only goes up. The example class never counts. Before this list
 * existed, only classes the coach had changed count, so an untouched example
 * from an older version doesn't either.
 */
export function madeIds(plans: ClassPlan[]): Set<string> {
  const raw = safeGet(MADE_KEY);
  let stored: string[] | null = null;
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (Array.isArray(parsed)) stored = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    stored = null;
  }
  const ids = new Set(stored ?? []);
  for (const p of plans) {
    if (p.example) continue;
    if (stored === null && p.updatedAt === p.createdAt) continue;
    ids.add(p.id);
  }
  return ids;
}

/** Writes down the classes made so far, so deleting them later doesn't free a slot. */
export function recordMade(plans: ClassPlan[]): void {
  const ids = madeIds(plans);
  const next = JSON.stringify([...ids]);
  if (safeGet(MADE_KEY) !== next) safeSet(MADE_KEY, next);
}

/** How many free classes are left (never below zero). */
export function freeLeft(plans: ClassPlan[]): number {
  return Math.max(0, FREE_CLASSES - madeIds(plans).size);
}

/**
 * Whether these classes can be added: always once unlocked, otherwise while
 * the classes made, these included, stay within the free three. Classes that
 * are already here (an edit, a re-import) are always let through.
 */
export function roomFor(plans: ClassPlan[], incoming: ClassPlan[]): boolean {
  if (isUnlocked()) return true;
  const ids = madeIds(plans);
  const before = ids.size;
  const here = new Set(plans.map((p) => p.id));
  for (const p of incoming) if (!p.example && !here.has(p.id)) ids.add(p.id);
  return ids.size <= Math.max(before, FREE_CLASSES);
}

// ---- The unlock ----

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readUnlock(raw: string | null): Unlock | null {
  try {
    const u: unknown = raw === null ? null : JSON.parse(raw);
    if (u && typeof u === 'object' && typeof (u as Unlock).key === 'string' && (u as Unlock).key.trim()) {
      return { key: (u as Unlock).key.trim(), at: String((u as Unlock).at ?? '') };
    }
  } catch {
    // Not an unlock.
  }
  return null;
}

let cachedRaw: string | null | undefined;
let cached: Unlock | null = null;

export function getUnlock(): Unlock | null {
  const raw = safeGet(UNLOCK_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = readUnlock(raw);
  }
  return cached;
}

export function isUnlocked(): boolean {
  return getUnlock() !== null;
}

export function saveUnlock(u: Unlock): void {
  safeSet(UNLOCK_KEY, JSON.stringify(u));
  emit();
}

/** An unlock carried over from another copy of the app (see carry.ts). */
export function takeCarriedUnlock(u: unknown): boolean {
  const found = readUnlock(JSON.stringify(u ?? null));
  if (!found || isUnlocked()) return false;
  saveUnlock(found);
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === UNLOCK_KEY && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useUnlocked(): boolean {
  return useSyncExternalStore(subscribe, isUnlocked, () => false);
}

// ---- Checking a key ----

export type KeyCheck = 'ok' | 'bad' | 'offline';

/** What Lemon Squeezy's answer says about the key. */
export function judgeKey(data: unknown): Exclude<KeyCheck, 'offline'> {
  const d = data as { valid?: unknown; license_key?: { status?: unknown }; meta?: { product_id?: unknown } } | null;
  if (!d || d.valid !== true) return 'bad';
  const status = d.license_key?.status;
  if (status === 'disabled' || status === 'expired') return 'bad';
  if (PRODUCT_ID && Number(d.meta?.product_id) !== PRODUCT_ID) return 'bad';
  return 'ok';
}

/**
 * Asks Lemon Squeezy whether the key is real. The app's own address passes the
 * question on first (a tiny function on Cloudflare Pages, a proxy rule on
 * Netlify), since browsers may not be let through to Lemon Squeezy directly;
 * where neither exists, it asks Lemon Squeezy straight.
 */
export async function checkKey(key: string): Promise<KeyCheck> {
  const body = new URLSearchParams({ license_key: key.trim() });
  for (const url of ['/api/license', LS_VALIDATE]) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!(res.headers.get('content-type') ?? '').includes('json')) continue;
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && 'valid' in data) return judgeKey(data);
    } catch {
      // Not reachable this way. Try the next.
    }
  }
  return 'offline';
}

/** Checks the key and, when it's good, unlocks this copy of the app. */
export async function unlockWith(key: string): Promise<KeyCheck> {
  const result = await checkKey(key);
  if (result === 'ok') saveUnlock({ key: key.trim(), at: new Date().toISOString() });
  return result;
}
