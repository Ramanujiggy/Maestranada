// Local persistence. Plans live in this browser's localStorage as one JSON
// array. A new copy starts empty: the example class is offered as a template
// when the coach plans their first class, never put in the library for them.

import { normalizePlan, storedPlan, type ClassPlan } from './plan.ts';

// Keys keep the app's first name so plans saved before the rename still load.
export const PLANS_KEY = 'maestranada.plans.v1';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Storage full or blocked (private mode). The app keeps working in memory.
    return false;
  }
}

export interface Loaded {
  plans: ClassPlan[];
  /** The stored data could not be read. It was copied aside, untouched. */
  damaged: boolean;
}

export function loadPlans(): Loaded {
  const raw = safeGet(PLANS_KEY);
  if (raw === null) return { plans: [], damaged: false };
  return parsePlans(raw);
}

export function parsePlans(raw: string): Loaded {
  const plans = readList(raw);
  if (plans) return { plans, damaged: false };
  // Keep the unreadable original so nothing is lost for good.
  safeSet(`${PLANS_KEY}.damaged-${Date.now()}`, raw);
  return { plans: [], damaged: true };
}

/** Returns false when the browser refused to store the plans. */
export function savePlans(plans: ClassPlan[]): boolean {
  return safeSet(PLANS_KEY, JSON.stringify(plans.map(storedPlan)));
}

/** Plans as they are stored right now, which another tab may have changed. */
export function storedPlans(): ClassPlan[] {
  const raw = safeGet(PLANS_KEY);
  return (raw !== null && readList(raw)) || [];
}

function readList(raw: string): ClassPlan[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizePlan).filter((p): p is ClassPlan => p !== null) : null;
  } catch {
    return null;
  }
}
