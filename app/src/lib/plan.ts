// The class plan model — one shape for every class, built around the
// structure a good BJJ class follows:
//
//   1. Warm-up · Movement  — solo movement drills
//   2. Concept             — the general rule the class is about
//   3. Positional game     — a spar from a position toward a goal, taught as
//                            goals and movements first, details after
//   4. Gems                — the specific moves and their options
//   5. Free roll
//
// Everything here is pure data + pure functions so it can be tested without
// a browser and stored as plain JSON.

export interface ListItem {
  id: string;
  text: string;
}

/** A looping GIF of the technique. The image itself lives in IndexedDB (see clips.ts). */
export interface Clip {
  id: string;
  width: number;
  height: number;
}

export interface Move {
  id: string;
  name: string;
  notes: string;
  clip?: Clip;
}

export interface GameRounds {
  /** Rounds played before the players change sides. */
  roundsPerSide: number;
  minutes: number;
  /** Rest between rounds, in seconds. */
  restSeconds: number;
  /** Rotate partners between rounds. */
  switchPartners: boolean;
  /** After the first side's rounds, swap who starts in the position and repeat. */
  switchPositions: boolean;
}

export interface FreeRoll {
  rounds: number;
  minutes: number;
  restSeconds: number;
  notes: string;
}

export interface ClassPlan {
  id: string;
  title: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  createdAt: string;
  updatedAt: string;
  warmup: {
    minutes: number;
    drills: ListItem[];
  };
  concept: {
    minutes: number;
    rule: string;
    notes: string;
  };
  game: {
    start: string;
    objective: string;
    /** General goals and movements toward the objective — no technique yet. */
    goals: ListItem[];
    /** General guidelines for beating the position, shown after the first rounds. */
    details: ListItem[];
    transition: string;
    submission: string;
    rounds: GameRounds;
  };
  gems: {
    minutes: number;
    moves: Move[];
    options: ListItem[];
  };
  freeRoll: FreeRoll;
}

export const MOVEMENT_SUGGESTIONS = [
  'Forward rolls',
  'Backward rolls',
  'Shrimps',
  'Forward shrimps',
  'Cartwheels',
  'Technical stand-ups',
  'Bridges',
  'Granby rolls',
  'Sprawls',
  'Bear crawls',
  'Sit-throughs',
  'Hip switches',
];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function item(text: string): ListItem {
  return { id: uid(), text };
}

export function move(name = '', notes = ''): Move {
  return { id: uid(), name, notes };
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A blank plan that already carries the class structure. */
export function blankPlan(now = new Date()): ClassPlan {
  const stamp = now.toISOString();
  return {
    id: uid(),
    title: '',
    date: todayISO(now),
    createdAt: stamp,
    updatedAt: stamp,
    warmup: { minutes: 10, drills: [] },
    concept: { minutes: 5, rule: '', notes: '' },
    game: {
      start: '',
      objective: '',
      goals: [],
      details: [],
      transition: '',
      submission: '',
      rounds: { roundsPerSide: 2, minutes: 3, restSeconds: 30, switchPartners: true, switchPositions: true },
    },
    gems: { minutes: 15, moves: [move(), move()], options: [] },
    freeRoll: { rounds: 4, minutes: 5, restSeconds: 60, notes: '' },
  };
}

/** The example class: offensive opportunities from the leg drag. */
export function samplePlan(now = new Date()): ClassPlan {
  const plan = blankPlan(now);
  return {
    ...plan,
    title: 'Leg drag to the back',
    warmup: {
      minutes: 10,
      drills: ['Forward rolls', 'Backward rolls', 'Shrimps', 'Forward shrimps', 'Cartwheels'].map(item),
    },
    concept: {
      minutes: 5,
      rule: 'Offensive opportunities from the leg drag.',
      notes: 'The leg drag pins the hips to one side. Every option today comes from keeping them there.',
    },
    game: {
      ...plan.game,
      start: 'Leg drag',
      objective: 'Take the back',
      goals: [
        'Top: keep the hips pinned and move toward the back',
        'Bottom: square up, recover guard or come up on a single',
        'Reset if bottom recovers full guard',
      ].map(item),
      details: [
        'Chest to the far hip, not the near one',
        'Control the far sleeve or wrist before you move',
        'Step the back knee in behind as they turn away',
      ].map(item),
      transition: 'Leg drag → back take as they turn away',
      submission: 'Rear naked choke, or bow and arrow from the gi',
    },
    gems: {
      minutes: 15,
      moves: [
        move('Back take when they turn away', 'Seatbelt first, then the hook. Let them give you the turn.'),
        move('Far side knee cut', 'When they block the turn, cut back across to mount.'),
      ],
      options: ['Near side armbar if the far arm posts', 'Switch to the opposite leg drag'].map(item),
    },
  };
}

// ─── Time ────────────────────────────────────────────────────────────────────

export function gameRoundCount(r: GameRounds): number {
  return Math.max(0, r.roundsPerSide) * (r.switchPositions ? 2 : 1);
}

/** Total seconds for a block of rounds with rest between (not after the last). */
function blockSeconds(rounds: number, minutes: number, restSeconds: number): number {
  if (rounds <= 0) return 0;
  return rounds * minutes * 60 + (rounds - 1) * restSeconds;
}

export function gameSeconds(plan: ClassPlan): number {
  const r = plan.game.rounds;
  return blockSeconds(gameRoundCount(r), r.minutes, r.restSeconds);
}

export function freeRollSeconds(plan: ClassPlan): number {
  const f = plan.freeRoll;
  return blockSeconds(f.rounds, f.minutes, f.restSeconds);
}

export interface TimelineSegment {
  key: SectionKey;
  label: string;
  minutes: number;
}

export type SectionKey = 'warmup' | 'concept' | 'game' | 'gems' | 'freeRoll';

export const SECTION_LABELS: Record<SectionKey, string> = {
  warmup: 'Warm-up · Movement',
  concept: 'Concept',
  game: 'Positional game',
  gems: 'Gems',
  freeRoll: 'Free roll',
};

export function timeline(plan: ClassPlan): TimelineSegment[] {
  return [
    { key: 'warmup', label: SECTION_LABELS.warmup, minutes: plan.warmup.minutes },
    { key: 'concept', label: SECTION_LABELS.concept, minutes: plan.concept.minutes },
    { key: 'game', label: SECTION_LABELS.game, minutes: gameSeconds(plan) / 60 },
    { key: 'gems', label: SECTION_LABELS.gems, minutes: plan.gems.minutes },
    { key: 'freeRoll', label: SECTION_LABELS.freeRoll, minutes: freeRollSeconds(plan) / 60 },
  ];
}

export function totalMinutes(plan: ClassPlan): number {
  return timeline(plan).reduce((sum, s) => sum + s.minutes, 0);
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes * 2) / 2;
  if (rounded < 60) return `${trimZero(rounded)} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded - h * 60;
  return m === 0 ? `${h} h` : `${h} h ${trimZero(m)} min`;
}

function trimZero(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "2 × 3 min, switch partners, then switch positions" */
export function describeGameRounds(r: GameRounds): string {
  const parts = [`${r.roundsPerSide} × ${r.minutes} min`];
  if (r.switchPartners) parts.push('switch partners');
  if (r.switchPositions) parts.push('then switch positions');
  return parts.join(', ');
}

// ─── Round schedule (for the mat timer) ──────────────────────────────────────

export interface RoundSegment {
  kind: 'round' | 'rest';
  label: string;
  /** What the coach calls out for this segment. */
  cue: string;
  seconds: number;
}

export function gameSchedule(plan: ClassPlan): RoundSegment[] {
  const r = plan.game.rounds;
  const sides = r.switchPositions ? 2 : 1;
  const total = gameRoundCount(r);
  const position = plan.game.start || 'the position';
  const out: RoundSegment[] = [];
  let n = 0;
  for (let side = 0; side < sides; side++) {
    for (let i = 0; i < r.roundsPerSide; i++) {
      n++;
      const first = i === 0;
      let cue: string;
      if (n === 1) cue = `Start in ${position}`;
      else if (first) cue = 'Switch positions';
      else if (r.switchPartners) cue = 'Switch partners';
      else cue = 'Same partner, go again';
      out.push({
        kind: 'round',
        label: `Round ${n} of ${total}`,
        cue: sides === 2 ? `${cue} · Side ${side === 0 ? 'A' : 'B'}` : cue,
        seconds: r.minutes * 60,
      });
      if (n < total && r.restSeconds > 0) {
        const nextSwitchesSide = i === r.roundsPerSide - 1;
        out.push({
          kind: 'rest',
          label: 'Rest',
          cue: nextSwitchesSide ? 'Next: switch positions' : r.switchPartners ? 'Next: switch partners' : 'Next round',
          seconds: r.restSeconds,
        });
      }
    }
  }
  return out;
}

export function freeRollSchedule(plan: ClassPlan): RoundSegment[] {
  const f = plan.freeRoll;
  const out: RoundSegment[] = [];
  for (let i = 1; i <= f.rounds; i++) {
    out.push({ kind: 'round', label: `Roll ${i} of ${f.rounds}`, cue: i === 1 ? 'Slap, bump, roll' : 'New partner', seconds: f.minutes * 60 });
    if (i < f.rounds && f.restSeconds > 0) {
      out.push({ kind: 'rest', label: 'Rest', cue: 'Find a new partner', seconds: f.restSeconds });
    }
  }
  return out;
}

// ─── Normalisation (for imports and older saved data) ────────────────────────

/** Fills any missing fields from a blank plan, so imported JSON always renders. */
export function normalizePlan(raw: unknown): ClassPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  // Backups carry clip images alongside the plan; those are restored separately.
  const { clipData: _clipData, ...r } = raw as Partial<ClassPlan> & { clipData?: unknown };
  const base = blankPlan();
  return {
    ...base,
    ...r,
    id: typeof r.id === 'string' && r.id ? r.id : base.id,
    warmup: { ...base.warmup, ...r.warmup },
    concept: { ...base.concept, ...r.concept },
    game: { ...base.game, ...r.game, rounds: { ...base.game.rounds, ...r.game?.rounds } },
    gems: { ...base.gems, ...r.gems },
    freeRoll: { ...base.freeRoll, ...r.freeRoll },
  };
}

export function duplicatePlan(plan: ClassPlan, now = new Date()): ClassPlan {
  const stamp = now.toISOString();
  const reid = <T extends { id: string }>(xs: T[]) => xs.map((x) => ({ ...x, id: uid() }));
  return {
    ...plan,
    id: uid(),
    title: plan.title ? `${plan.title} (copy)` : '',
    createdAt: stamp,
    updatedAt: stamp,
    warmup: { ...plan.warmup, drills: reid(plan.warmup.drills) },
    game: { ...plan.game, goals: reid(plan.game.goals), details: reid(plan.game.details) },
    gems: { ...plan.gems, moves: reid(plan.gems.moves), options: reid(plan.gems.options) },
  };
}
