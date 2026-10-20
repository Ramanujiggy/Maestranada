// Ready-made classes a coach can start from. Each one follows the same
// structure and is written the way you'd brief it on the mat.

import { blankPlan, item, move, samplePlan, type ClassPlan } from './plan.ts';

export interface Template {
  key: string;
  title: string;
  level: 'Fundamentals' | 'All levels' | 'Advanced';
  blurb: string;
  build: (now?: Date) => ClassPlan;
}

interface Spec {
  title: string;
  drills: string[];
  rule: string;
  ruleNotes: string;
  start: string;
  objective: string;
  goals: string[];
  details: string[];
  transition: string;
  submission: string;
  moves: [string, string][];
  options: string[];
  freeRollNotes?: string;
}

function fromSpec(s: Spec, now = new Date()): ClassPlan {
  const p = blankPlan(now);
  return {
    ...p,
    title: s.title,
    warmup: { ...p.warmup, drills: s.drills.map(item) },
    concept: { ...p.concept, rule: s.rule, notes: s.ruleNotes },
    game: {
      ...p.game,
      start: s.start,
      objective: s.objective,
      goals: s.goals.map(item),
      details: s.details.map(item),
      transition: s.transition,
      submission: s.submission,
    },
    gems: { ...p.gems, moves: s.moves.map(([n, d]) => move(n, d)), options: s.options.map(item) },
    freeRoll: { ...p.freeRoll, notes: s.freeRollNotes ?? '' },
  };
}

const closedGuard: Spec = {
  title: 'Closed guard: break posture first',
  drills: ['Shrimps', 'Bridges', 'Hip escapes to knees', 'Technical stand-ups', 'Granby rolls'],
  rule: 'Break the posture before you attack.',
  ruleNotes: 'A postured opponent can defend everything. Bring the head down and the attacks open up.',
  start: 'Closed guard',
  objective: 'Sweep or submit',
  goals: [
    'Bottom: break posture and keep it broken',
    'Top: posture up and open the guard',
    'Reset if top opens the guard and passes the knee line',
  ],
  details: [
    'Pull with the legs, not just the arms',
    'Control one sleeve and the collar or head',
    'Angle off before you attack. Never attack from square',
  ],
  transition: 'Broken posture → hip bump sweep to mount',
  submission: 'Kimura or guillotine off the hip bump',
  moves: [
    ['Hip bump sweep', 'Sit up into them when they posture. Post the hand, bump the hip, follow to mount.'],
    ['Kimura from the bump', 'They post the arm to stop the sweep. Catch the wrist, figure-four, fall back to an angle.'],
  ],
  options: ['Guillotine if they drop the head', 'Flower sweep if they push off to stand'],
};

const halfGuard: Spec = {
  title: 'Half guard: win the underhook',
  drills: ['Shrimps', 'Forward shrimps', 'Sit-throughs', 'Bear crawls', 'Granby rolls'],
  rule: 'In half guard, whoever owns the underhook owns the position.',
  ruleNotes: 'Bottom wants the underhook to come up. Top wants it to flatten them.',
  start: 'Half guard',
  objective: 'Come up to the back or a single leg',
  goals: [
    'Bottom: win the underhook and get to your side',
    'Top: crossface, flatten, and win the underhook yourself',
    'Reset if bottom is flattened with the crossface in',
  ],
  details: [
    'Underhook high on the back, not on the hip',
    'Head on their chest, never on the mat',
    'Knee shield frames until the underhook is in',
  ],
  transition: 'Underhook → dogfight → back take',
  submission: 'Rear naked choke once the hooks are in',
  moves: [
    ['Old school sweep', 'From the underhook, reach for the far ankle and drive into them with the head.'],
    ['Dogfight to the back', 'Come up on the knee, run around as they sprawl, seatbelt and hook.'],
  ],
  options: ['Single leg finish if they stand', 'Switch to deep half if they crossface hard'],
};

const backControl: Spec = {
  title: 'Back control: hands before the choke',
  drills: ['Forward rolls', 'Backward rolls', 'Shrimps', 'Hip switches', 'Bridges'],
  rule: 'Win the hand fight before you go for the choke.',
  ruleNotes: 'Chasing the neck against two hands loses the back. Clear a hand, then finish.',
  start: 'Back control with seatbelt',
  objective: 'Finish the choke',
  goals: [
    'Top: keep the seatbelt and hooks, trap or clear a hand',
    'Bottom: two-on-one the choking arm and slide to the mat',
    'Reset if bottom gets shoulders to the mat',
  ],
  details: [
    'Choke side under, but chest glued to their back',
    'Use the hook on the trapped side to pin the arm',
    'Fall to the choking-arm side, never the other one',
  ],
  transition: 'Seatbelt → body triangle when hooks are threatened',
  submission: 'Rear naked choke or bow and arrow',
  moves: [
    ['Arm trap to choke', 'Leg pins the bottom arm. Now one hand is free against one hand.'],
    ['Bow and arrow', 'Feed the collar, grab the pants, swing the leg over, pull apart.'],
  ],
  options: ['Armbar when they over-defend the neck', 'Mount if they turn into you'],
};

const mountEscapes: Spec = {
  title: 'Mount escapes for fundamentals',
  drills: ['Bridges', 'Shrimps', 'Forward shrimps', 'Technical stand-ups', 'Bear crawls'],
  rule: 'Frame first, then move your hips. Never push with straight arms.',
  ruleNotes: 'Frames create space. Hips use it. Arms that push get armbarred.',
  start: 'Mount',
  objective: 'Escape to guard or come up on top',
  goals: [
    'Bottom: frame, bridge, and get a knee back inside',
    'Top: stay heavy, keep the knees tight, climb high',
    'Reset when bottom gets half guard or better',
  ],
  details: [
    'Elbows tight, forearm frame across the hip',
    'Bridge to one side before you shrimp to the other',
    'Trap the arm and foot on the same side for the upa',
  ],
  transition: 'Elbow-knee escape → half guard → full guard',
  submission: 'None from bottom today. Keep your arms safe.',
  moves: [
    ['Upa (trap and roll)', 'Trap the arm and foot on one side, bridge over your shoulder, land in their guard.'],
    ['Elbow-knee escape', 'Frame, bridge, shrimp, and slide the knee inside. Repeat to the other side.'],
  ],
  options: ['Upa when they post a hand', 'Elbow-knee when they post a foot'],
  freeRollNotes: 'Beginners start from mount bottom and switch every round.',
};

export const TEMPLATES: Template[] = [
  {
    key: 'leg-drag',
    title: 'Leg drag to the back',
    level: 'All levels',
    blurb: 'Offensive opportunities from the leg drag.',
    build: samplePlan,
  },
  {
    key: 'closed-guard',
    title: closedGuard.title,
    level: 'Fundamentals',
    blurb: closedGuard.rule,
    build: (now) => fromSpec(closedGuard, now),
  },
  {
    key: 'half-guard',
    title: halfGuard.title,
    level: 'All levels',
    blurb: halfGuard.rule,
    build: (now) => fromSpec(halfGuard, now),
  },
  {
    key: 'back-control',
    title: backControl.title,
    level: 'Advanced',
    blurb: backControl.rule,
    build: (now) => fromSpec(backControl, now),
  },
  {
    key: 'mount-escapes',
    title: mountEscapes.title,
    level: 'Fundamentals',
    blurb: mountEscapes.rule,
    build: (now) => fromSpec(mountEscapes, now),
  },
];
