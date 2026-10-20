// Local persistence. Plans live in this browser's localStorage as one JSON
// array; the first visit seeds the example class so the app is never empty.

import { normalizePlan, samplePlan, type ClassPlan } from './plan.ts';

const KEY = 'maestranada.plans.v1';
const SEEDED_KEY = 'maestranada.seeded';

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
    // Storage full or blocked (private mode). The app keeps working in memory.
  }
}

export function loadPlans(): ClassPlan[] {
  const raw = safeGet(KEY);
  if (raw === null) {
    if (safeGet(SEEDED_KEY)) return [];
    const seeded = [samplePlan()];
    savePlans(seeded);
    safeSet(SEEDED_KEY, '1');
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePlan).filter((p): p is ClassPlan => p !== null);
  } catch {
    return [];
  }
}

export function savePlans(plans: ClassPlan[]): void {
  safeSet(KEY, JSON.stringify(plans));
}
