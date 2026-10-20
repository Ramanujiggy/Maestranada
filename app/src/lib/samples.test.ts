import { TEMPLATES } from './samples.ts';
import { gameSchedule, totalMinutes } from './plan.ts';

describe('templates', () => {
  it('each builds a complete class with fresh ids', () => {
    for (const t of TEMPLATES) {
      const a = t.build();
      const b = t.build();
      expect(a.title).toBe(t.title);
      expect(a.id).not.toBe(b.id);
      expect(a.warmup.drills.length).toBeGreaterThan(0);
      expect(a.concept.rule).not.toBe('');
      expect(a.game.goals.length).toBeGreaterThan(0);
      expect(a.gems.moves.every((m) => m.name)).toBe(true);
      expect(totalMinutes(a)).toBeGreaterThan(30);
      expect(gameSchedule(a)[0].cue).toContain(a.game.start);
    }
  });

  it('uses unique keys', () => {
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
  });
});
