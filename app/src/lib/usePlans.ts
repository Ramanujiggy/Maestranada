import { useCallback, useEffect, useState } from 'react';
import { loadPlans, savePlans } from './storage.ts';
import { clipIds, pruneClips } from './clips.ts';
import type { ClassPlan } from './plan.ts';

export interface PlansApi {
  plans: ClassPlan[];
  get: (id: string) => ClassPlan | undefined;
  /** Insert or replace by id; stamps updatedAt. */
  upsert: (plan: ClassPlan) => void;
  remove: (id: string) => void;
  /** Adds plans that are not already present (by id). Returns how many were added. */
  importMany: (incoming: ClassPlan[]) => number;
}

export function usePlans(): PlansApi {
  const [plans, setPlans] = useState<ClassPlan[]>(() => loadPlans());

  useEffect(() => {
    savePlans(plans);
  }, [plans]);

  // Drop stored clips once no plan uses them (replaced, removed, class deleted).
  const clipKey = [...clipIds(plans)].sort().join(',');
  useEffect(() => {
    void pruneClips(plans).catch(() => {});
  }, [clipKey]);

  const get = useCallback((id: string) => plans.find((p) => p.id === id), [plans]);

  const upsert = useCallback((plan: ClassPlan) => {
    const stamped = { ...plan, updatedAt: new Date().toISOString() };
    setPlans((prev) => {
      const i = prev.findIndex((p) => p.id === plan.id);
      if (i === -1) return [stamped, ...prev];
      const next = prev.slice();
      next[i] = stamped;
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const importMany = useCallback(
    (incoming: ClassPlan[]) => {
      const known = new Set(plans.map((p) => p.id));
      const fresh = incoming.filter((p) => !known.has(p.id));
      if (fresh.length) setPlans((prev) => [...fresh, ...prev]);
      return fresh.length;
    },
    [plans],
  );

  return { plans, get, upsert, remove, importMany };
}
