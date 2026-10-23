import { describe, expect, it } from 'vitest';
import { freshCopy } from './carry.ts';
import { samplePlan } from './plan.ts';

describe('freshCopy', () => {
  it('is fresh with nothing, or only the untouched example', () => {
    expect(freshCopy([])).toBe(true);
    expect(freshCopy([samplePlan()])).toBe(true);
  });

  it('is not fresh once the coach has written a class', () => {
    const edited = { ...samplePlan(), updatedAt: '2099-01-01T00:00:00.000Z' };
    expect(freshCopy([samplePlan(), edited])).toBe(false);
  });
});
