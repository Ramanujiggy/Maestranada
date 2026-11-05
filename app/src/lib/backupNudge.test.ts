import { describe, expect, it } from 'vitest';
import { shouldNudge } from './backupNudge.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_800_000_000_000;
const base = { unlocked: true, classes: 5, now, lastBackup: null, snoozedUntil: null };

describe('backup reminder', () => {
  it('waits for an unlocked app with more than four classes', () => {
    expect(shouldNudge(base)).toBe(true);
    expect(shouldNudge({ ...base, classes: 4 })).toBe(false);
    expect(shouldNudge({ ...base, unlocked: false, classes: 20 })).toBe(false);
  });

  it('stays quiet for a month after a backup', () => {
    expect(shouldNudge({ ...base, lastBackup: now - 29 * DAY })).toBe(false);
    expect(shouldNudge({ ...base, lastBackup: now - 30 * DAY })).toBe(true);
  });

  it('respects Not now until it runs out', () => {
    expect(shouldNudge({ ...base, snoozedUntil: now + DAY })).toBe(false);
    expect(shouldNudge({ ...base, snoozedUntil: now - 1 })).toBe(true);
  });
});
