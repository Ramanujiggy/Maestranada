// A calm reminder to keep a backup file. Classes live only in this browser, so
// once a coach has paid and has a real library, a lost phone or a cleared
// browser would cost them. Nothing is backed up by itself: the app only asks,
// about once a month, and "Not now" quiets it for two weeks.

const LAST_KEY = 'prancheta.lastBackup';
const SNOOZE_KEY = 'prancheta.backupSnooze';
const DAY = 24 * 60 * 60 * 1000;

/** More than this many classes before the reminder shows. */
export const NUDGE_AFTER = 4;
/** A backup older than this is due again. */
export const BACKUP_EVERY_DAYS = 30;
/** How long "Not now" keeps it quiet. */
export const SNOOZE_DAYS = 14;

export interface NudgeState {
  unlocked: boolean;
  classes: number;
  now: number;
  lastBackup: number | null;
  snoozedUntil: number | null;
}

export function shouldNudge(s: NudgeState): boolean {
  if (!s.unlocked || s.classes <= NUDGE_AFTER) return false;
  if (s.snoozedUntil !== null && s.now < s.snoozedUntil) return false;
  return s.lastBackup === null || s.now - s.lastBackup >= BACKUP_EVERY_DAYS * DAY;
}

function readTime(key: string): number | null {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeTime(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage refused: the reminder may show again, which is harmless.
  }
}

export const lastBackup = () => readTime(LAST_KEY);
export const snoozedUntil = () => readTime(SNOOZE_KEY);

/** A backup file was handed over (downloaded, or the share sheet opened). */
export function markBackedUp(now = Date.now()) {
  writeTime(LAST_KEY, now);
}

export function snoozeNudge(now = Date.now()) {
  writeTime(SNOOZE_KEY, now + SNOOZE_DAYS * DAY);
}

/** Whole days since the last backup, or null for never. */
export function daysSinceBackup(now = Date.now()): number | null {
  const last = lastBackup();
  return last === null ? null : Math.floor((now - last) / DAY);
}
