import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPlans, PLANS_KEY, parsePlans, savePlans, storedPlans } from './storage.ts';
import { clipIds, pruneClips } from './clips.ts';
import { recordMade, roomFor } from './access.ts';
import type { ClassPlan } from './plan.ts';

export interface PlansApi {
  plans: ClassPlan[];
  get: (id: string) => ClassPlan | undefined;
  /** Insert or replace by id; stamps updatedAt. Returns false, and asks for
   *  the unlock, when a new class would go past the free ones. */
  upsert: (plan: ClassPlan) => boolean;
  remove: (id: string) => void;
  /** Adds new plans and replaces older copies of ones already here (by id).
   *  Returns how many plans changed, or null when they'd go past the free
   *  classes (the unlock is asked for instead). `moving` = the coach's own
   *  classes coming over from another copy or a backup: never turned down,
   *  though they still count as made. */
  importMany: (incoming: ClassPlan[], moving?: boolean) => number | null;
  /** The last save was refused by the browser (storage full or blocked). */
  saveFailed: boolean;
}

/** `onLimit` runs when a new class is turned down because the free ones are used up. */
export function usePlans(onLimit: () => void): PlansApi {
  const [initial] = useState(loadPlans);
  const [plans, setPlans] = useState<ClassPlan[]>(initial.plans);
  const [saveFailed, setSaveFailed] = useState(false);
  // Plans that arrived from another tab are already stored; writing them back
  // would only bounce them between tabs.
  const fromOtherTab = useRef(false);
  // While stored data was unreadable, clips are left alone until a real edit.
  const touched = useRef(!initial.damaged);

  useEffect(() => {
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    if (!touched.current) return;
    setSaveFailed(!savePlans(plans));
  }, [plans]);

  // Every class made is written down, so deleting one doesn't give a free class back.
  useEffect(() => recordMade(plans), [plans]);

  // The installed app and a browser tab share storage: keep them in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PLANS_KEY || e.newValue === null) return;
      const { plans: next, damaged } = parsePlans(e.newValue);
      if (damaged) return;
      fromOtherTab.current = true;
      setPlans(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Drop stored clips once no plan uses them (replaced, removed, class deleted).
  // Plans another tab has stored count too, so its new clips are never lost.
  const clipKey = [...clipIds(plans)].sort().join(',');
  useEffect(() => {
    if (!touched.current || saveFailed) return;
    void pruneClips([...plans, ...storedPlans()]).catch(() => {});
  }, [clipKey, saveFailed]);

  const edit = useCallback((fn: (prev: ClassPlan[]) => ClassPlan[]) => {
    touched.current = true;
    setPlans(fn);
  }, []);

  const get = useCallback((id: string) => plans.find((p) => p.id === id), [plans]);

  const upsert = useCallback(
    (plan: ClassPlan) => {
      if (!roomFor(plans, [plan])) {
        onLimit();
        return false;
      }
      const stamped = { ...plan, updatedAt: new Date().toISOString() };
      edit((prev) => {
        const i = prev.findIndex((p) => p.id === plan.id);
        if (i === -1) return [stamped, ...prev];
        const next = prev.slice();
        next[i] = stamped;
        return next;
      });
      return true;
    },
    [plans, edit, onLimit],
  );

  const remove = useCallback((id: string) => edit((prev) => prev.filter((p) => p.id !== id)), [edit]);

  const importMany = useCallback(
    (incoming: ClassPlan[], moving = false) => {
      const byId = new Map(plans.map((p) => [p.id, p]));
      const changed = incoming.filter((p) => {
        const here = byId.get(p.id);
        return !here || p.updatedAt > here.updatedAt;
      });
      if (!moving && !roomFor(plans, changed)) {
        onLimit();
        return null;
      }
      if (changed.length) {
        const ids = new Set(changed.map((p) => p.id));
        edit((prev) => [...changed, ...prev.filter((p) => !ids.has(p.id))]);
      }
      return changed.length;
    },
    [plans, edit, onLimit],
  );

  return { plans, get, upsert, remove, importMany, saveFailed };
}
