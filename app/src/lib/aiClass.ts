// Planning a class with an AI chat. The coach copies a prompt (the class
// format, as JSON, plus their idea), pastes it into ChatGPT, Claude or any
// other chat, and pastes the reply back. The app pulls the JSON out of the
// reply and builds a normal plan from it, ready for clips and sharing.
//
// AI replies are messy: code fences, a sentence before and after, trailing
// commas, curly quotes, "3 min" where a number belongs, a list written as one
// string, a block kind in its own words. Everything here is forgiving about
// that, and only gives up with a reason the coach can act on.
//
// The class JSON (version 1). Every field is optional except `blocks`:
//
//   { "prancheta": 1, "title": "...", "date": "YYYY-MM-DD",
//     "blocks": [
//       { "kind": "warmup",    "title": "", "minutes": 10, "drills": ["..."] },
//       { "kind": "concept",   "minutes": 5, "rule": "...", "notes": "..." },
//       { "kind": "positionalSparring", "start": "...", "objective": "...",
//         "goals": ["..."], "details": ["..."], "transition": "...", "submission": "...",
//         "rounds": { "roundsPerSide": 2, "minutes": 3, "restSeconds": 30,
//                     "switchPartners": true, "switchPositions": true } },
//       { "kind": "technique", "minutes": 15, "moves": [{ "name": "...", "notes": "..." }], "options": ["..."] },
//       { "kind": "rolling",   "rounds": 4, "minutes": 5, "restSeconds": 60, "notes": "..." },
//       { "kind": "wrapup",    "minutes": 3, "question": "...", "notes": "..." } ] }
//
// A backup or class file's own JSON (internal kinds, `{id, text}` list items)
// reads too, so the same importer takes either.

import { blankPlan, normalizePlan, uid, type BlockKind, type ClassPlan } from './plan.ts';
import { getLang, type Lang } from './i18n.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

// ─── Pulling the JSON out of a chat reply ────────────────────────────────────

/** The first balanced {...} in the text, skipping braces inside strings. */
function firstObject(text: string, from: number): string | null {
  const start = text.indexOf('{', from);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  // Cut off before it closed: hand back the rest so the error says so.
  return text.slice(start);
}

/** Fixes the slips chat models make in JSON: curly quotes, comments, trailing commas. */
function repair(json: string): string {
  return json
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
}

export type ReadError = 'empty' | 'noJson' | 'cutOff' | 'badJson' | 'noBlocks';

/** The JSON object in a chat reply, or why there isn't one. */
export function extractJson(text: string): { value: unknown } | { error: ReadError } {
  if (!text.trim()) return { error: 'empty' };
  // Prefer what's inside a ```json fence, then any {...} at all.
  const fenced = [...text.matchAll(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g)].map((m) => m[1]);
  const candidates = [...fenced, text];
  let cutOff = false;
  let found = false;
  for (const c of candidates) {
    let at = 0;
    for (let obj = firstObject(c, at); obj; obj = firstObject(c, at)) {
      found = true;
      at = c.indexOf(obj, at) + 1;
      for (const attempt of [obj, repair(obj)]) {
        try {
          const value = JSON.parse(attempt);
          if (isObj(value)) return { value };
        } catch {
          // try the repaired text, then the next object
        }
      }
      if (!obj.trimEnd().endsWith('}')) cutOff = true;
    }
  }
  if (!found) return { error: 'noJson' };
  return { error: cutOff ? 'cutOff' : 'badJson' };
}

// ─── From the AI's words to the plan's shape ─────────────────────────────────

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/** What a chat model, or a coach, might call each kind. */
const KIND_WORDS: Record<BlockKind, string[]> = {
  warmup: ['warmup', 'warm', 'movement', 'aquecimento', 'movimentacao', 'aquecimentomovimentacao'],
  concept: ['concept', 'conceito', 'theme', 'tema', 'rule', 'principle'],
  game: [
    'game',
    'positionalsparring',
    'positionalgame',
    'sparring',
    'positional',
    'specific',
    'specifictraining',
    'situational',
    'especifico',
    'jogoposicional',
    'treinoespecifico',
  ],
  gems: ['gems', 'technique', 'techniques', 'tecnica', 'tecnicas', 'drilling', 'drill', 'instruction', 'pulodogato'],
  freeRoll: ['freeroll', 'rolling', 'roll', 'rolls', 'rola', 'rolalivre', 'livesparring', 'live', 'liverolling', 'treinolivre'],
  wrapup: ['wrapup', 'fechamento', 'cooldown', 'debrief', 'review', 'closing'],
};
const KIND_OF = new Map<string, BlockKind>(
  (Object.entries(KIND_WORDS) as [BlockKind, string[]][]).flatMap(([k, words]) => words.map((w) => [w, k] as const)),
);

export function kindFrom(v: unknown): BlockKind | null {
  return typeof v === 'string' ? (KIND_OF.get(plain(v)) ?? null) : null;
}

/** The first of several possible keys that's present. */
const pick = (r: Obj, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== null);

function text(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join('\n');
  return undefined;
}

/** "3", "3 min", "2.5" → a number; anything else is left out. */
function count(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function yes(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const w = plain(v);
    if (['true', 'yes', 'sim', 'y'].includes(w)) return true;
    if (['false', 'no', 'nao', 'n'].includes(w)) return false;
  }
  return undefined;
}

/** A list as `{id, text}` items, from strings, one string with a line per item, or items already. */
function items(v: unknown): { id: string; text: string }[] | undefined {
  const raw = typeof v === 'string' ? v.split(/\n+/) : Array.isArray(v) ? v : undefined;
  if (!raw) return undefined;
  return raw
    .map((x) => (isObj(x) ? { id: typeof x.id === 'string' && x.id ? x.id : uid(), text: text(pick(x, 'text', 'name', 'title')) ?? '' } : { id: uid(), text: text(x) ?? '' }))
    .map((x) => ({ ...x, text: x.text.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '') }))
    .filter((x) => x.text);
}

function moves(v: unknown): Obj[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .map((m): Obj | null => {
      if (typeof m === 'string') return m.trim() ? { name: m.trim(), notes: '' } : null;
      if (!isObj(m)) return null;
      // Keep what a backup carries (id, clip); take the AI's words for the rest.
      const notes = [text(pick(m, 'notes', 'description', 'details', 'steps')), text(pick(m, 'gems', 'keyDetails', 'tips'))]
        .filter(Boolean)
        .join('\n');
      return { ...m, name: text(pick(m, 'name', 'title', 'move', 'technique')) ?? '', notes };
    })
    .filter((m): m is Obj => m !== null && !!(m.name || m.notes));
}

/** One block in the shape normalizePlan reads, or null if its kind is unknown. */
function block(raw: unknown): Obj | null {
  if (!isObj(raw)) return null;
  const kind = kindFrom(pick(raw, 'kind', 'type', 'block'));
  if (!kind) return null;
  const r = raw;
  const out: Obj = { ...r, kind, title: text(pick(r, 'title', 'name', 'label')) ?? '' };
  const minutes = count(pick(r, 'minutes', 'duration', 'durationMinutes', 'time'));
  if (minutes !== undefined) out.minutes = minutes;
  switch (kind) {
    case 'warmup':
      out.drills = items(pick(r, 'drills', 'movements', 'exercises', 'items'));
      break;
    case 'concept':
      out.rule = text(pick(r, 'rule', 'concept', 'principle', 'idea'));
      out.notes = text(pick(r, 'notes', 'description', 'explanation'));
      break;
    case 'game': {
      const gr = isObj(r.rounds) ? r.rounds : r;
      out.start = text(pick(r, 'start', 'startPosition', 'position', 'startingPosition'));
      out.objective = text(pick(r, 'objective', 'goal', 'win', 'winCondition'));
      out.goals = items(pick(r, 'goals', 'movements', 'focus'));
      out.details = items(pick(r, 'details', 'keyDetails', 'tips'));
      out.transition = text(r.transition);
      out.submission = text(pick(r, 'submission', 'finish'));
      const perSide = count(pick(gr, 'roundsPerSide', 'rounds', 'count'));
      out.rounds = {
        roundsPerSide: perSide,
        // Flat on the block, "minutes" is a round's length only next to a round count;
        // alone it's the length of the whole game, which the rounds already decide.
        minutes: count(gr === r ? (pick(r, 'roundMinutes') ?? (perSide !== undefined ? r.minutes : undefined)) : pick(gr, 'minutes', 'roundMinutes')),
        restSeconds: count(pick(gr, 'restSeconds', 'rest')),
        switchPartners: yes(gr.switchPartners),
        switchPositions: yes(gr.switchPositions),
      };
      delete out.minutes;
      break;
    }
    case 'gems':
      out.moves = moves(pick(r, 'moves', 'techniques', 'items'));
      out.options = items(pick(r, 'options', 'counters', 'followUps'));
      break;
    case 'freeRoll':
      out.rounds = count(pick(r, 'rounds', 'count'));
      out.minutes = count(pick(r, 'minutes', 'roundMinutes'));
      out.restSeconds = count(pick(r, 'restSeconds', 'rest'));
      out.notes = text(pick(r, 'notes', 'description'));
      break;
    case 'wrapup':
      out.question = text(pick(r, 'question', 'prompt'));
      out.notes = text(pick(r, 'notes', 'description'));
      break;
  }
  return out;
}

export type AiImport = { plan: ClassPlan; skipped: number } | { error: ReadError };

/** Builds a new plan from class JSON, in the format above or a backup's. */
export function planFromJson(value: unknown, now = new Date()): AiImport {
  let root = isObj(value) ? value : {};
  // { "class": {...} } and friends.
  for (const k of ['class', 'plan', 'aula', 'classPlan']) if (isObj(root[k])) root = root[k] as Obj;
  const rawBlocks = pick(root, 'blocks', 'sections', 'blocos');
  if (!Array.isArray(rawBlocks)) return { error: 'noBlocks' };
  const blocks = rawBlocks.map(block).filter((b): b is Obj => b !== null);
  if (!blocks.length) return { error: 'noBlocks' };
  const plan = normalizePlan({ ...root, blocks });
  if (!plan) return { error: 'noBlocks' };
  // Always a new class: an AI reply must never overwrite one that's here.
  const fresh = blankPlan(now);
  return {
    plan: {
      ...plan,
      id: fresh.id,
      title: text(pick(root, 'title', 'name', 'titulo')) ?? '',
      date: typeof root.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(root.date) ? root.date : fresh.date,
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
    },
    skipped: rawBlocks.length - blocks.length,
  };
}

/** The whole trip: a pasted chat reply to a new plan. */
export function readAiReply(reply: string, now = new Date()): AiImport {
  const found = extractJson(reply);
  return 'error' in found ? found : planFromJson(found.value, now);
}

// ─── The prompt the coach copies ─────────────────────────────────────────────

const EXAMPLE = {
  prancheta: 1,
  title: 'Leg drag to the back',
  blocks: [
    { kind: 'warmup', minutes: 10, drills: ['Forward rolls', 'Shrimps', 'Technical stand-ups', 'Pummeling'] },
    {
      kind: 'concept',
      minutes: 5,
      rule: 'Pin the hips to one side before you move.',
      notes: 'Every option today comes from keeping the hips pinned.',
    },
    {
      kind: 'positionalSparring',
      title: '',
      start: 'Leg drag',
      objective: 'Take the back',
      goals: ['Top: keep the hips pinned and move toward the back', 'Bottom: square up or recover guard'],
      details: ['Chest to the far hip', 'Control the far wrist before you move'],
      transition: 'Leg drag to back take as they turn away',
      submission: 'Rear naked choke',
      rounds: { roundsPerSide: 2, minutes: 3, restSeconds: 30, switchPartners: true, switchPositions: true },
    },
    {
      kind: 'technique',
      minutes: 15,
      moves: [{ name: 'Back take when they turn away', notes: 'Seatbelt first, then the hook.' }],
      options: ['Switch to the opposite leg drag'],
    },
    { kind: 'rolling', rounds: 4, minutes: 5, restSeconds: 60, notes: 'Start from the leg drag.' },
  ],
};

const PROMPT: Record<Lang, (idea: string) => string> = {
  en: (idea) => `You are helping a Brazilian jiu-jitsu coach plan one class. Turn their idea into a class plan for the Prancheta app.

Reply with ONE JSON object in a \`\`\`json code block and nothing else. No comments inside the JSON.

The class is an ordered list of blocks. Use only these kinds, in any order, as many of each as the class needs:
- "warmup": movement to wake the body up, ending close to the real thing. Fields: minutes, drills (list of short strings).
- "concept": the one rule the whole class is about, said as what should happen. Fields: minutes, rule (one sentence), notes.
- "positionalSparring": sparring from a position toward a goal. Goals and movements first, details once they've felt it. Fields: start (start position), objective, goals (list), details (list), transition, submission, rounds { roundsPerSide, minutes, restSeconds, switchPartners (true/false), switchPositions (true/false) }.
- "technique": the moves that win the game. Fields: minutes, moves (list of { name, notes }; notes hold the key details), options (list: what to do when the move is stopped).
- "rolling": live rounds. Fields: rounds, minutes (per round), restSeconds, notes.
- "wrapup" (optional): fields minutes, question (one question back to the class), notes.
Any block may also have a "title" (the coach's own name for it). Leave it "" to use the kind's name.

Rules: numbers are plain numbers (3, not "3 min"). Keep every line short, the way a coach writes on a clipboard. Fit the class length the coach asks for, or about 60 minutes. A good default order is warmup, concept, positionalSparring, technique, positionalSparring, rolling.

Example of the format:
\`\`\`json
${JSON.stringify(EXAMPLE, null, 2)}
\`\`\`

The coach's idea:
${idea.trim() || '[Describe the class here: position, goal, level, length.]'}`,

  pt: (idea) => `Você está ajudando um professor de jiu-jitsu a planejar uma aula. Transforme a ideia dele num plano de aula para o app Prancheta.

Responda com UM objeto JSON num bloco de código \`\`\`json e mais nada. Sem comentários dentro do JSON. Escreva todo o texto da aula em português do Brasil, mas mantenha as chaves e os valores de "kind" em inglês, exatamente como abaixo.

A aula é uma lista ordenada de blocos. Use só estes tipos ("kind"), em qualquer ordem, quantos de cada a aula precisar:
- "warmup": aquecimento e movimentação, terminando perto da luta de verdade. Campos: minutes, drills (lista de textos curtos).
- "concept": a regra que guia a aula inteira, dita como o que deve acontecer. Campos: minutes, rule (uma frase), notes.
- "positionalSparring": treino específico de uma posição até um objetivo. Primeiro objetivos e movimentos, os detalhes depois que sentirem a posição. Campos: start (posição inicial), objective, goals (lista), details (lista), transition, submission, rounds { roundsPerSide, minutes, restSeconds, switchPartners (true/false), switchPositions (true/false) }.
- "technique": as técnicas que vencem o jogo. Campos: minutes, moves (lista de { name, notes }; em notes vão os detalhes-chave, o pulo do gato), options (lista: o que fazer quando a técnica é bloqueada).
- "rolling": rola livre. Campos: rounds, minutes (por round), restSeconds, notes.
- "wrapup" (opcional): campos minutes, question (uma pergunta de volta para a turma), notes.
Qualquer bloco pode ter "title" (o nome que o professor dá). Deixe "" para usar o nome do tipo.

Regras: números são números simples (3, e não "3 min"). Cada linha curta, como um professor escreve na prancheta. Respeite a duração que o professor pedir, ou uns 60 minutos. Uma boa ordem padrão é warmup, concept, positionalSparring, technique, positionalSparring, rolling.

Exemplo do formato:
\`\`\`json
${JSON.stringify(EXAMPLE, null, 2)}
\`\`\`

A ideia do professor:
${idea.trim() || '[Descreva a aula aqui: posição, objetivo, nível, duração.]'}`,
};

/** The prompt to paste into an AI chat, with the coach's idea at the end. */
export function aiPrompt(idea: string, lang: Lang = getLang()): string {
  return PROMPT[lang](idea);
}

/** Chats that take a prompt in the link, so one tap opens them ready to send. */
export const AI_CHATS = [
  { name: 'ChatGPT', url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { name: 'Claude', url: (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
] as const;
