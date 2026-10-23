import { beforeEach, describe, expect, it } from 'vitest';
import { FREE_CLASSES, freeLeft, isUnlocked, judgeKey, recordMade, roomFor, saveUnlock, takeCarriedUnlock } from './access.ts';
import { blankPlan, duplicatePlan, normalizePlan, samplePlan, type ClassPlan } from './plan.ts';
import { readBackup, takeUnlockFrom } from './carry.ts';

const own = (): ClassPlan => ({ ...blankPlan(), updatedAt: '2099-01-01T00:00:00.000Z' });

describe('free classes', () => {
  beforeEach(() => localStorage.clear());

  it('lets three classes in, then asks for the unlock', () => {
    let plans: ClassPlan[] = [samplePlan()];
    for (let i = 0; i < FREE_CLASSES; i++) {
      const next = own();
      expect(roomFor(plans, [next])).toBe(true);
      plans = [next, ...plans];
      recordMade(plans);
    }
    expect(freeLeft(plans)).toBe(0);
    expect(roomFor(plans, [own()])).toBe(false);
  });

  it('never gives a slot back when a class is deleted', () => {
    const plans = [own(), own(), own()];
    recordMade(plans);
    expect(roomFor(plans.slice(1), [own()])).toBe(false);
    expect(freeLeft([])).toBe(0);
  });

  it('always lets classes already here be changed', () => {
    const plans = [own(), own(), own()];
    recordMade(plans);
    expect(roomFor(plans, [{ ...plans[0], title: 'Edited' }])).toBe(true);
  });

  it("doesn't count the example, but counts a copy of it", () => {
    const sample = samplePlan();
    recordMade([sample]);
    expect(freeLeft([sample])).toBe(FREE_CLASSES);
    const copy = duplicatePlan(sample);
    expect(copy.example).toBeUndefined();
    expect(freeLeft([copy, sample])).toBe(FREE_CLASSES - 1);
  });

  it('keeps the example mark through saving and loading', () => {
    expect(normalizePlan(JSON.parse(JSON.stringify(samplePlan())))?.example).toBe(true);
    expect(normalizePlan(JSON.parse(JSON.stringify(own())))?.example).toBeUndefined();
  });

  it('keeps every class a coach made before the free version, and stops new ones', () => {
    const plans = [own(), own(), own(), own(), own()];
    expect(freeLeft(plans)).toBe(0);
    expect(roomFor(plans, [plans[0]])).toBe(true);
    expect(roomFor(plans, [own()])).toBe(false);
  });

  it('lets everything in once unlocked', () => {
    const plans = [own(), own(), own()];
    recordMade(plans);
    saveUnlock({ key: 'ABC', at: '' });
    expect(roomFor(plans, [own(), own()])).toBe(true);
  });
});

describe('judgeKey', () => {
  it('takes a valid key and turns down the rest', () => {
    expect(judgeKey({ valid: true, license_key: { status: 'inactive' }, meta: { product_id: 1 } })).toBe('ok');
    expect(judgeKey({ valid: false, error: 'license_key not found.' })).toBe('bad');
    expect(judgeKey({ valid: true, license_key: { status: 'disabled' } })).toBe('bad');
    expect(judgeKey(null)).toBe('bad');
  });
});

describe('carrying the unlock', () => {
  beforeEach(() => localStorage.clear());

  it('reads the classes and the unlock from copied text', () => {
    const text = JSON.stringify({ classes: [own(), own()], unlock: { key: 'ABC', at: '2026-10-23' } });
    expect(readBackup(text)).toHaveLength(2);
    expect(takeUnlockFrom(text)).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it('ignores copied text without an unlock', () => {
    expect(takeUnlockFrom(JSON.stringify([own()]))).toBe(false);
    expect(takeCarriedUnlock({ key: '  ' })).toBe(false);
    expect(isUnlocked()).toBe(false);
  });
});
