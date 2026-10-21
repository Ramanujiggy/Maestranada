import { describe, expect, it } from 'vitest';
import { aiPrompt, extractJson, kindFrom, planFromJson, readAiReply } from './aiClass.ts';
import { blocksOf, samplePlan, storedPlan, type ClassPlan } from './plan.ts';

const ok = (r: ReturnType<typeof readAiReply>): { plan: ClassPlan; skipped: number } => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('reading an AI reply', () => {
  it('takes the JSON out of a fenced block with chat around it', () => {
    const reply = 'Sure! Here is your class:\n\n```json\n{"title":"Half guard","blocks":[{"kind":"warmup","drills":["Shrimps"]}]}\n```\n\nWant changes?';
    const { plan } = ok(readAiReply(reply));
    expect(plan.title).toBe('Half guard');
    expect(blocksOf(plan, 'warmup')[0].drills.map((d) => d.text)).toEqual(['Shrimps']);
  });

  it('reads JSON with no fence, curly quotes, comments and trailing commas', () => {
    const reply = `Here you go {
      // the class
      “title”: “Open mat”,
      "blocks": [ { "kind": "rolling", "rounds": 6, }, ],
    } enjoy`;
    const { plan } = ok(readAiReply(reply));
    expect(plan.title).toBe('Open mat');
    expect(blocksOf(plan, 'freeRoll')[0].rounds).toBe(6);
  });

  it('says when the reply was cut off, has no JSON, or is empty', () => {
    expect(readAiReply('```json\n{"title":"x","blocks":[{"kind":"warmup"')).toEqual({ error: 'cutOff' });
    expect(readAiReply('I can help with that! What position?')).toEqual({ error: 'noJson' });
    expect(readAiReply('   ')).toEqual({ error: 'empty' });
    expect(readAiReply('{"title":"x"}')).toEqual({ error: 'noBlocks' });
    expect(readAiReply('{"blocks":[{"kind":"yoga"}]}')).toEqual({ error: 'noBlocks' });
  });

  it('skips braces inside strings when finding the object', () => {
    const r = extractJson('{"title":"Use {frames}","blocks":[]} trailing }');
    expect(r).toEqual({ value: { title: 'Use {frames}', blocks: [] } });
  });
});

describe('class JSON in the AI format', () => {
  it('maps every kind and field onto the plan', () => {
    const { plan, skipped } = ok(
      readAiReply(
        JSON.stringify({
          prancheta: 1,
          title: 'Leg drag',
          date: '2026-11-02',
          blocks: [
            { kind: 'warmup', minutes: '8 min', drills: '- Rolls\n- Shrimps' },
            { kind: 'concept', rule: 'Pin the hips', notes: ['One', 'Two'] },
            {
              kind: 'positionalSparring',
              title: 'Leg drag game',
              start: 'Leg drag',
              objective: 'Back',
              goals: ['Pin'],
              details: [{ text: 'Far hip' }],
              rounds: { roundsPerSide: '3', minutes: 2, restSeconds: 20, switchPartners: 'no', switchPositions: false },
            },
            { kind: 'technique', moves: [{ name: 'Back take', notes: 'Seatbelt', gems: ['Hook last'] }, 'Knee cut'], options: ['Armbar'] },
            { kind: 'rolling', rounds: 5, minutes: 6, restSeconds: 45 },
            { kind: 'wrapup', question: 'What opened the back?' },
            { kind: 'meditation', minutes: 5 },
          ],
        }),
      ),
    );
    expect(skipped).toBe(1);
    expect(plan.date).toBe('2026-11-02');
    expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'concept', 'game', 'gems', 'freeRoll', 'wrapup']);
    const [warmup, concept, game, gems, roll, wrap] = plan.blocks;
    expect(warmup).toMatchObject({ minutes: 8 });
    expect(warmup.kind === 'warmup' && warmup.drills.map((d) => d.text)).toEqual(['Rolls', 'Shrimps']);
    expect(concept).toMatchObject({ rule: 'Pin the hips', notes: 'One\nTwo' });
    expect(game).toMatchObject({
      title: 'Leg drag game',
      start: 'Leg drag',
      rounds: { roundsPerSide: 3, minutes: 2, restSeconds: 20, switchPartners: false, switchPositions: false },
    });
    expect(game.kind === 'game' && game.details[0].text).toBe('Far hip');
    expect(gems.kind === 'gems' && gems.moves.map((m) => [m.name, m.notes])).toEqual([
      ['Back take', 'Seatbelt\nHook last'],
      ['Knee cut', ''],
    ]);
    expect(roll).toMatchObject({ rounds: 5, minutes: 6, restSeconds: 45 });
    expect(wrap).toMatchObject({ question: 'What opened the back?' });
  });

  it('understands kinds in other words, Portuguese included', () => {
    expect(kindFrom('Positional Sparring')).toBe('game');
    expect(kindFrom('específico')).toBe('game');
    expect(kindFrom('Técnica')).toBe('gems');
    expect(kindFrom('Rola livre')).toBe('freeRoll');
    expect(kindFrom('warm-up')).toBe('warmup');
    expect(kindFrom('freeRoll')).toBe('freeRoll');
    expect(kindFrom('yoga')).toBeNull();
  });

  it('fills what the AI left out with the blank block defaults', () => {
    const { plan } = ok(readAiReply('{"blocks":[{"kind":"positionalSparring","start":"Mount"},{"kind":"technique"}]}'));
    const [game, gems] = plan.blocks;
    expect(game).toMatchObject({ start: 'Mount', objective: '', rounds: { roundsPerSide: 2, minutes: 3 } });
    expect(gems.kind === 'gems' && gems.moves).toHaveLength(2);
  });

  it('reads a flat game: minutes count as a round only next to a round count', () => {
    const flat = ok(readAiReply('{"blocks":[{"kind":"game","rounds":4,"minutes":2,"rest":15}]}')).plan.blocks[0];
    expect(flat).toMatchObject({ rounds: { roundsPerSide: 4, minutes: 2, restSeconds: 15 } });
    const whole = ok(readAiReply('{"blocks":[{"kind":"game","minutes":12}]}')).plan.blocks[0];
    expect(whole).toMatchObject({ rounds: { roundsPerSide: 2, minutes: 3 } });
  });

  it('always makes a new class, never one that would replace a plan here', () => {
    const sample = samplePlan();
    const { plan } = ok(planFromJson(storedPlan(sample)));
    expect(plan.id).not.toBe(sample.id);
    expect(plan.blocks.map((b) => b.kind)).toEqual(sample.blocks.map((b) => b.kind));
    expect(plan.title).toBe(sample.title);
  });

  it('accepts the class wrapped in another object', () => {
    expect(ok(readAiReply('{"class":{"title":"X","blocks":[{"kind":"concept","rule":"R"}]}}')).plan.title).toBe('X');
  });
});

describe('the prompt', () => {
  it('carries the idea and a JSON example the importer reads back', () => {
    for (const lang of ['en', 'pt'] as const) {
      const prompt = aiPrompt('Half guard sweeps, 45 minutes', lang);
      expect(prompt).toContain('Half guard sweeps, 45 minutes');
      // The prompt's own example is a valid class: paste it straight back.
      const { plan } = ok(readAiReply(prompt));
      expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'concept', 'game', 'gems', 'freeRoll']);
    }
  });
});
