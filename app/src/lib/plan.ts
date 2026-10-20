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

import { getLang, t } from './i18n.ts';

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

const MOVEMENTS_EN = [
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

const MOVEMENTS_PT = [
  'Rolamento para frente',
  'Rolamento para trás',
  'Fuga de quadril',
  'Fuga de quadril para frente',
  'Estrelinha',
  'Levantada técnica',
  'Ponte',
  'Rolamento granby',
  'Sprawl',
  'Andar de urso',
  'Sit-through',
  'Troca de quadril',
];

/** Movement drills to tap into the warm-up, in the app's language. */
export function movementSuggestions(): string[] {
  return getLang() === 'pt' ? MOVEMENTS_PT : MOVEMENTS_EN;
}

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
  return getLang() === 'pt' ? samplePlanPt(now) : samplePlanEn(now);
}

function samplePlanEn(now: Date): ClassPlan {
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

function samplePlanPt(now: Date): ClassPlan {
  const plan = blankPlan(now);
  return {
    ...plan,
    title: 'Leg drag para as costas',
    warmup: {
      minutes: 10,
      drills: ['Rolamento para frente', 'Rolamento para trás', 'Fuga de quadril', 'Fuga de quadril para frente', 'Estrelinha'].map(item),
    },
    concept: {
      minutes: 5,
      rule: 'Oportunidades de ataque a partir do leg drag.',
      notes: 'O leg drag prende o quadril para um lado. Toda opção de hoje vem de manter ele ali.',
    },
    game: {
      ...plan.game,
      start: 'Leg drag',
      objective: 'Pegar as costas',
      goals: [
        'Por cima: prenda o quadril e vá para as costas',
        'Por baixo: fique de frente, recupere a guarda ou suba numa single leg',
        'Recomeça se quem está por baixo recuperar a guarda fechada',
      ].map(item),
      details: [
        'Peito no quadril de longe, não no de perto',
        'Controle a manga ou o punho de longe antes de se mexer',
        'Encaixe o joelho de trás quando ele virar de costas',
      ].map(item),
      transition: 'Leg drag → pegada nas costas quando ele vira',
      submission: 'Mata-leão, ou arco e flecha de kimono',
    },
    gems: {
      minutes: 15,
      moves: [
        move('Pegada nas costas quando ele vira', 'Primeiro a pegada de cinto, depois o gancho. Deixe ele te dar o giro.'),
        move('Passagem de joelho do outro lado', 'Quando ele bloqueia o giro, corte de volta para a montada.'),
      ],
      options: ['Chave de braço do lado de perto se ele apoiar o braço de longe', 'Troque para o leg drag do outro lado'].map(item),
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

/** The block's name in the app's language. */
export function sectionLabel(key: SectionKey): string {
  return t(`sec.${key}`);
}

export function timeline(plan: ClassPlan): TimelineSegment[] {
  return [
    { key: 'warmup', label: sectionLabel('warmup'), minutes: plan.warmup.minutes },
    { key: 'concept', label: sectionLabel('concept'), minutes: plan.concept.minutes },
    { key: 'game', label: sectionLabel('game'), minutes: gameSeconds(plan) / 60 },
    { key: 'gems', label: sectionLabel('gems'), minutes: plan.gems.minutes },
    { key: 'freeRoll', label: sectionLabel('freeRoll'), minutes: freeRollSeconds(plan) / 60 },
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
  const parts = [t('roundsDescribe', { n: r.roundsPerSide, min: r.minutes })];
  if (r.switchPartners) parts.push(t('switchPartnersLower'));
  if (r.switchPositions) parts.push(t('thenSwitchPositionsLower'));
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
  const position = plan.game.start || t('thePosition');
  const out: RoundSegment[] = [];
  let n = 0;
  for (let side = 0; side < sides; side++) {
    for (let i = 0; i < r.roundsPerSide; i++) {
      n++;
      const first = i === 0;
      let cue: string;
      if (n === 1) cue = t('cueStartIn', { position });
      else if (first) cue = t('cueSwitchPositions');
      else if (r.switchPartners) cue = t('cueSwitchPartners');
      else cue = t('cueSameAgain');
      out.push({
        kind: 'round',
        label: t('roundNofM', { n, total }),
        cue: sides === 2 ? t('cueSide', { cue, side: side === 0 ? 'A' : 'B' }) : cue,
        seconds: r.minutes * 60,
      });
      if (n < total && r.restSeconds > 0) {
        const nextSwitchesSide = i === r.roundsPerSide - 1;
        out.push({
          kind: 'rest',
          label: t('rest'),
          cue: nextSwitchesSide ? t('nextSwitchPositions') : r.switchPartners ? t('nextSwitchPartners') : t('nextRound'),
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
    out.push({
      kind: 'round',
      label: t('rollNofM', { n: i, total: f.rounds }),
      cue: i === 1 ? t('cueSlapRoll') : t('cueNewPartner'),
      seconds: f.minutes * 60,
    });
    if (i < f.rounds && f.restSeconds > 0) {
      out.push({ kind: 'rest', label: t('rest'), cue: t('cueFindPartner'), seconds: f.restSeconds });
    }
  }
  return out;
}

// ─── Normalisation (for imports and older saved data) ────────────────────────

/** Rebuilds a plan from untrusted JSON: every field takes the stored value only
 *  when it has the right type, otherwise the blank plan's, so a damaged or
 *  hand-edited backup can never crash the screens that draw it. */
export function normalizePlan(raw: unknown): ClassPlan | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const base = blankPlan();
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const list = (v: unknown, d: ListItem[]): ListItem[] =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof x === 'object' && typeof (x as ListItem).text === 'string')
          .map((x) => ({ id: str((x as ListItem).id, '') || uid(), text: (x as ListItem).text }))
      : d;
  const clip = (v: unknown): Clip | undefined => {
    const c = obj(v);
    return typeof c.id === 'string' && c.id ? { id: c.id, width: num(c.width, 400), height: num(c.height, 300) } : undefined;
  };
  const moves = (v: unknown, d: Move[]): Move[] =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof x === 'object')
          .map((x) => {
            const m = x as Record<string, unknown>;
            const c = clip(m.clip);
            return { id: str(m.id, '') || uid(), name: str(m.name, ''), notes: str(m.notes, ''), ...(c ? { clip: c } : {}) };
          })
      : d;

  const w = obj(r.warmup);
  const c = obj(r.concept);
  const g = obj(r.game);
  const gr = obj(g.rounds);
  const ge = obj(r.gems);
  const f = obj(r.freeRoll);
  const date = str(r.date, '');
  return {
    id: str(r.id, '') || base.id,
    title: str(r.title, base.title),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : base.date,
    createdAt: str(r.createdAt, base.createdAt),
    updatedAt: str(r.updatedAt, base.updatedAt),
    warmup: { minutes: num(w.minutes, base.warmup.minutes), drills: list(w.drills, base.warmup.drills) },
    concept: { minutes: num(c.minutes, base.concept.minutes), rule: str(c.rule, base.concept.rule), notes: str(c.notes, base.concept.notes) },
    game: {
      start: str(g.start, base.game.start),
      objective: str(g.objective, base.game.objective),
      goals: list(g.goals, base.game.goals),
      details: list(g.details, base.game.details),
      transition: str(g.transition, base.game.transition),
      submission: str(g.submission, base.game.submission),
      rounds: {
        roundsPerSide: num(gr.roundsPerSide, base.game.rounds.roundsPerSide),
        minutes: num(gr.minutes, base.game.rounds.minutes),
        restSeconds: num(gr.restSeconds, base.game.rounds.restSeconds),
        switchPartners: bool(gr.switchPartners, base.game.rounds.switchPartners),
        switchPositions: bool(gr.switchPositions, base.game.rounds.switchPositions),
      },
    },
    gems: { minutes: num(ge.minutes, base.gems.minutes), moves: moves(ge.moves, base.gems.moves), options: list(ge.options, base.gems.options) },
    freeRoll: {
      rounds: num(f.rounds, base.freeRoll.rounds),
      minutes: num(f.minutes, base.freeRoll.minutes),
      restSeconds: num(f.restSeconds, base.freeRoll.restSeconds),
      notes: str(f.notes, base.freeRoll.notes),
    },
  };
}

export function duplicatePlan(plan: ClassPlan, now = new Date()): ClassPlan {
  const stamp = now.toISOString();
  const reid = <T extends { id: string }>(xs: T[]) => xs.map((x) => ({ ...x, id: uid() }));
  return {
    ...plan,
    id: uid(),
    title: plan.title ? t('copyOf', { title: plan.title }) : '',
    createdAt: stamp,
    updatedAt: stamp,
    warmup: { ...plan.warmup, drills: reid(plan.warmup.drills) },
    game: { ...plan.game, goals: reid(plan.game.goals), details: reid(plan.game.details) },
    gems: { ...plan.gems, moves: reid(plan.gems.moves), options: reid(plan.gems.options) },
  };
}
