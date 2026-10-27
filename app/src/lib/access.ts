// The free version and the unlock. Every coach can make three classes for
// free; after that, a new class asks for the $10 unlock. Classes already made
// always open, teach and print. There are no accounts: the coach pays through a
// Stripe payment link, which sends them back here with the checkout's id. The
// app asks Stripe once, through the app's own Worker, whether it was paid,
// remembers the answer here and works offline from then on. On another copy
// of the app, the email they paid with does the same. Someone determined can
// get around this by editing storage. At $10 that's fine.

import { useSyncExternalStore } from 'react';
import type { ClassPlan } from './plan.ts';

export const FREE_CLASSES = 3;

/**
 * The $10 Stripe payment link (Managed Payments), the same one the sales page
 * opens. After paying, it redirects back here with the checkout's id. A
 * buy.stripe.com/test_ link takes test cards only. With no link, the unlock
 * sheet only offers "Already bought it?".
 */
export const CHECKOUT_URL = 'https://buy.stripe.com/28E3cufEv1cCaLc3TT2B201';

const MADE_KEY = 'maestranada.made';
const UNLOCK_KEY = 'maestranada.unlock';
/** The Worker route that asks Stripe (worker/index.js). */
const CHECK_URL = '/api/unlock';

export interface Unlock {
  /** 'paid': Stripe confirmed a purchase. 'carried': pasted from an unlocked copy. */
  via: 'paid' | 'carried';
  /** When it was unlocked. */
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
    if (!u || typeof u !== 'object') return null;
    const { via, at } = u as Unlock;
    if (via === 'paid' || via === 'carried') return { via, at: String(at ?? '') };
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

/**
 * Unlocks this copy when classes pasted from an unlocked copy say so (see
 * carry.ts). Only a mark travels: nothing about the purchase (no checkout id,
 * no email) is ever in copied classes, backups or exports.
 */
export function takeCarriedUnlock(mark: unknown): boolean {
  if (mark !== true || isUnlocked()) return false;
  saveUnlock({ via: 'carried', at: new Date().toISOString() });
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

// ---- Checking a purchase ----

export type PurchaseCheck = 'ok' | 'bad' | 'offline';

/** What the app's checkout id or email asks Stripe about. */
export type Proof = { session: string } | { email: string };

/** The checkout id Stripe sends the coach back with (`?paid=cs_...`), if any. */
export function paidSession(search: string): string | null {
  const id = new URLSearchParams(search).get('paid');
  return id && /^cs_[A-Za-z0-9_]+$/.test(id) ? id : null;
}

/** Asks the app's Worker whether Stripe has a paid purchase for this checkout or email. */
export async function checkPurchase(proof: Proof): Promise<PurchaseCheck> {
  try {
    const res = await fetch(CHECK_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(proof),
    });
    if (!(res.headers.get('content-type') ?? '').includes('json')) return 'offline';
    const data = (await res.json()) as { ok?: unknown } | null;
    if (data && typeof data.ok === 'boolean') return data.ok ? 'ok' : 'bad';
  } catch {
    // No connection, or no Worker behind this address.
  }
  return 'offline';
}

/** Checks the purchase and, when Stripe says it was paid, unlocks this copy of the app. */
export async function unlockWith(proof: Proof): Promise<PurchaseCheck> {
  const result = await checkPurchase(proof);
  if (result === 'ok') saveUnlock({ via: 'paid', at: new Date().toISOString() });
  return result;
}
