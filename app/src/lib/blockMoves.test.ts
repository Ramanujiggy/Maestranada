import { describe, expect, it } from 'vitest';
import { allMoves, blankPlan, copyBlock, move, newBlock, normalizePlan, type ClassPlan } from './plan.ts';
import { planFromJson, planToJson } from './aiClass.ts';
import { buildClassFile } from './classFile.ts';

// A warm-up holding a technique with a clip, the way the block menu's Add technique leaves it.
function planWithWarmupTechnique(): ClassPlan {
  const warmup = newBlock('warmup');
  warmup.moves = [{ ...move(), name: 'Technical stand-up', notes: 'Hand behind, hips back', clip: { id: 'clip-1', width: 360, height: 640 } }];
  return { ...blankPlan(), blocks: [warmup, newBlock('gems')] };
}

describe('techniques in any block', () => {
  it('counts their clips with the class, so pruning never deletes them', () => {
    expect(allMoves(planWithWarmupTechnique()).map((m) => m.clip?.id)).toContain('clip-1');
  });

  it('survive a save and reload', () => {
    const back = normalizePlan(JSON.parse(JSON.stringify(planWithWarmupTechnique())))!;
    expect(back.blocks[0].moves?.[0]).toMatchObject({ name: 'Technical stand-up', clip: { id: 'clip-1' } });
  });

  it('get new ids when the block is duplicated', () => {
    const b = planWithWarmupTechnique().blocks[0];
    expect(copyBlock(b).moves?.[0].id).not.toBe(b.moves?.[0].id);
  });

  it('travel through the AI format', () => {
    const json = planToJson(planWithWarmupTechnique()) as { blocks: { moves?: unknown }[] };
    expect(json.blocks[0].moves).toEqual([{ name: 'Technical stand-up', notes: 'Hand behind, hips back' }]);
    const read = planFromJson(json);
    expect('plan' in read && read.plan.blocks[0].moves?.[0].name).toBe('Technical stand-up');
  });

  it('leave other blocks without moves when they have none', () => {
    const read = planFromJson({ blocks: [{ kind: 'warmup', drills: ['Shrimps'] }] });
    expect('plan' in read && read.plan.blocks[0].moves).toBeUndefined();
  });

  it('show in the class file', () => {
    expect(buildClassFile(planWithWarmupTechnique())).toContain('Technical stand-up');
  });
});
