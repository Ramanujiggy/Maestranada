import {
  blankPlan,
  describeGameRounds,
  duplicatePlan,
  formatClock,
  formatMinutes,
  freeRollSchedule,
  gameRoundCount,
  gameSchedule,
  normalizePlan,
  samplePlan,
  sectionSummary,
  totalMinutes,
} from './plan.ts';
import { parseHash, hrefFor } from './router.ts';

const NOW = new Date('2026-10-20T10:00:00Z');

describe('class plan', () => {
  it('starts with the full class structure', () => {
    const p = blankPlan(NOW);
    expect(p.date).toBe('2026-10-20');
    expect(p.gems.moves).toHaveLength(2);
    expect(p.game.rounds).toMatchObject({ roundsPerSide: 2, minutes: 3, switchPartners: true, switchPositions: true });
  });

  it('carries the leg drag example', () => {
    const p = samplePlan(NOW);
    expect(p.warmup.drills.map((d) => d.text)).toEqual([
      'Forward rolls',
      'Backward rolls',
      'Shrimps',
      'Forward shrimps',
      'Cartwheels',
    ]);
    expect(p.game.start).toBe('Leg drag');
    expect(p.game.objective).toBe('Take the back');
  });

  it('describes 2 × 3 min, switch partners, then switch positions', () => {
    const r = blankPlan(NOW).game.rounds;
    expect(describeGameRounds(r)).toBe('2 × 3 min, switch partners, then switch positions');
    expect(gameRoundCount(r)).toBe(4);
    expect(gameRoundCount({ ...r, switchPositions: false })).toBe(2);
  });

  it('adds up the class length including rest between rounds', () => {
    const p = blankPlan(NOW);
    // warm-up 10 + concept 5 + game (4×3 min + 3×30 s = 13.5) + gems 15 + free roll (4×5 + 3×1 = 23)
    expect(totalMinutes(p)).toBeCloseTo(66.5);
    expect(formatMinutes(66.5)).toBe('1 h 6.5 min');
    expect(formatMinutes(45)).toBe('45 min');
  });
});

describe('round schedule', () => {
  it('switches partners between rounds and positions between sides', () => {
    const p = { ...blankPlan(NOW), game: { ...blankPlan(NOW).game, start: 'Leg drag' } };
    const s = gameSchedule(p);
    const rounds = s.filter((x) => x.kind === 'round');
    expect(rounds.map((r) => r.cue)).toEqual([
      'Start in Leg drag · Side A',
      'Switch partners · Side A',
      'Switch positions · Side B',
      'Switch partners · Side B',
    ]);
    expect(s.filter((x) => x.kind === 'rest')).toHaveLength(3);
    expect(s.at(-1)?.kind).toBe('round');
  });

  it('omits rest segments when rest is zero', () => {
    const p = blankPlan(NOW);
    p.freeRoll.restSeconds = 0;
    expect(freeRollSchedule(p).every((x) => x.kind === 'round')).toBe(true);
  });

  it('formats a countdown clock', () => {
    expect(formatClock(180)).toBe('3:00');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(-1)).toBe('0:00');
  });
});

describe('import and duplicate', () => {
  it('fills missing fields so partial JSON still renders', () => {
    const p = normalizePlan({ id: 'abc', title: 'Old', game: { start: 'Mount' } });
    expect(p?.id).toBe('abc');
    expect(p?.game.start).toBe('Mount');
    expect(p?.game.rounds.minutes).toBe(3);
    expect(p?.warmup.drills).toEqual([]);
    expect(normalizePlan('nope')).toBeNull();
  });

  it('duplicates with fresh ids', () => {
    const p = samplePlan(NOW);
    const d = duplicatePlan(p, NOW);
    expect(d.id).not.toBe(p.id);
    expect(d.title).toBe('Leg drag to the back (copy)');
    expect(d.warmup.drills[0].id).not.toBe(p.warmup.drills[0].id);
    expect(d.warmup.drills[0].text).toBe(p.warmup.drills[0].text);
  });
});

describe('router', () => {
  it('round-trips routes through the hash', () => {
    for (const r of [{ name: 'library' }, { name: 'edit', id: 'x1' }, { name: 'run', id: 'x1' }] as const) {
      expect(parseHash(hrefFor(r))).toEqual(r);
    }
    expect(parseHash('#/garbage')).toEqual({ name: 'library' });
  });
});

describe('folded section summaries', () => {
  it('invites the coach in when a section is empty', () => {
    const p = blankPlan(NOW);
    expect(sectionSummary(p, 'warmup')).toEqual({ filled: false, text: 'Pick a few drills' });
    expect(sectionSummary(p, 'game').filled).toBe(false);
  });

  it('shows what is planned once there is something', () => {
    const p = samplePlan(NOW);
    expect(sectionSummary(p, 'warmup').text.startsWith('Forward rolls, Backward rolls')).toBe(true);
    expect(sectionSummary({ ...p, game: { ...p.game, start: 'Leg drag', objective: ' ' } }, 'game')).toEqual({
      filled: true,
      text: 'Leg drag',
    });
    expect(sectionSummary({ ...p, freeRoll: { ...p.freeRoll, rounds: 0 } }, 'freeRoll').filled).toBe(false);
  });
});
