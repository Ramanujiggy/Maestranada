// Bringing classes in from Evernote. Evernote exports any number of notes as
// one .enex file: XML holding each note's text and every picture in it, the
// pictures as base64. The text points at each picture by the MD5 of its bytes.
//
// One note becomes one class. Each GIF in it becomes a technique card whose
// name is the short line just above the GIF and whose notes are the lines
// below it, up to the next GIF. Text before the first GIF goes to a Concept
// block. Nothing is sorted further: the coach's words come over as written,
// and the AI can sort them into blocks afterwards.
//
// This file only reads; turning each GIF into a clip happens in gifClip.ts.

import { md5 } from './md5.ts';
import { item, move, newBlock, todayISO, uid, type Block, type BlockKind, type ClassPlan, type Clip, type Move } from './plan.ts';

export interface EnexNote {
  title: string;
  /** YYYY-MM-DD, from when the note was made. */
  date?: string;
  /** The note's lines in order, with a number where each GIF sits (an index into gifs). */
  pieces: Array<string | number>;
  /** Each GIF's bytes, or null where the note shows a GIF the export didn't include. */
  gifs: Array<Uint8Array | null>;
}

/** Longest line that still reads as a technique's name rather than a sentence of notes. */
const NAME_MAX = 70;

export function looksLikeEnex(text: string): boolean {
  return text.slice(0, 4000).includes('<en-export');
}

/** How many notes the export holds, without reading them. */
export function countNotes(text: string): number {
  let n = 0;
  for (let i = text.indexOf('<note>'); i >= 0; i = text.indexOf('<note>', i + 6)) n++;
  return n;
}

/** The notes in the export, one at a time, so a big export never sits in memory twice. */
export function* readEnex(text: string): Generator<EnexNote> {
  let from = 0;
  for (;;) {
    const start = text.indexOf('<note>', from);
    if (start < 0) return;
    // An export cut short (Evernote on iPhone can stop after the GIFs it has
    // downloaded) still gives the note's text and whatever GIFs made it in.
    let end = text.indexOf('</note>', start);
    if (end < 0) end = text.length;
    from = end + 7;
    yield readNote(text.slice(start + 6, end));
  }
}

function tag(xml: string, name: string): string | undefined {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return m?.[1];
}

function unescapeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function base64Bytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const isGif = (bytes: Uint8Array) => bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46; // "GIF"

function readNote(xml: string): EnexNote {
  const title = unescapeXml(tag(xml, 'title') ?? '').trim();
  const created = /^(\d{4})(\d{2})(\d{2})T/.exec((tag(xml, 'created') ?? '').trim());
  const date = created ? `${created[1]}-${created[2]}-${created[3]}` : undefined;

  // Every GIF the note carries, by its MD5.
  const files: Array<{ hash: string; bytes: Uint8Array }> = [];
  const resourceRe = /<resource>([\s\S]*?)<\/resource>/g;
  for (let m = resourceRe.exec(xml); m; m = resourceRe.exec(xml)) {
    const data = tag(m[1], 'data');
    if (!data) continue;
    let bytes: Uint8Array;
    try {
      bytes = base64Bytes(data);
    } catch {
      continue;
    }
    if (isGif(bytes)) files.push({ hash: md5(bytes), bytes });
  }

  // The note's text is XHTML, usually wrapped in CDATA; without it, it is escaped.
  const raw = tag(xml, 'content') ?? '';
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
  const content = cdata ? cdata[1] : unescapeXml(raw);
  const gifs: Array<Uint8Array | null> = [];
  const used = new Set<number>();
  const pieces: Array<string | number> = [];
  for (const p of noteLines(content)) {
    if (typeof p === 'string') {
      pieces.push(p);
      continue;
    }
    if (!p.gif) continue;
    // Match by hash. A GIF the export left out (Evernote on a phone only
    // exports what it has downloaded) keeps its place, without its file.
    let i = files.findIndex((f, k) => !used.has(k) && f.hash === p.hash);
    if (i < 0 && !p.hash) i = files.findIndex((_, k) => !used.has(k));
    if (i >= 0) used.add(i);
    pieces.push(gifs.length);
    gifs.push(i >= 0 ? files[i].bytes : null);
  }
  // GIFs the text never shows still come over, at the end.
  files.forEach((f, k) => {
    if (used.has(k)) return;
    pieces.push(gifs.length);
    gifs.push(f.bytes);
  });
  return { title, date, pieces, gifs };
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'TABLE', 'HR']);

/** A note's text as lines, with a marker for each picture: whether it's a GIF, and its hash. */
export function noteLines(enml: string): Array<string | { gif: boolean; hash: string }> {
  const html = enml.replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!DOCTYPE[\s\S]*?>/i, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: Array<string | { gif: boolean; hash: string }> = [];
  let line = '';
  const breakLine = () => {
    const l = line.replace(/\s+/g, ' ').trim();
    if (l) out.push(l);
    line = '';
  };
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      line += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const name = el.tagName.toUpperCase();
    if (name === 'EN-MEDIA') {
      breakLine();
      const type = (el.getAttribute('type') ?? '').toLowerCase();
      out.push({ gif: type === 'image/gif', hash: (el.getAttribute('hash') ?? '').toLowerCase() });
      // HTML ignores the "/>" on <en-media/>, so whatever follows lands inside it.
      el.childNodes.forEach(walk);
      return;
    }
    if (name === 'BR') return breakLine();
    const block = BLOCK_TAGS.has(name);
    if (block) breakLine();
    // A ticked box in an Evernote checklist.
    if (name === 'EN-TODO') line += el.getAttribute('checked') === 'true' ? '☑ ' : '☐ ';
    el.childNodes.forEach(walk);
    if (block) breakLine();
    // Table cells sit side by side on one line.
    if (name === 'TD' || name === 'TH') line += '  ';
  };
  doc.body.childNodes.forEach(walk);
  breakLine();
  return out;
}

// A line like "[Concept section]", "Warm up with:" or "Free roll" starts a
// block of that kind. Checked in this order, so "[Game around that concept]" is
// a game. English and Portuguese.
const SECTION_WORDS: Array<[BlockKind, RegExp]> = [
  ['game', /\b(game|spar\w*|positional|jogo|posicional)/i],
  ['gems', /\b(gems?|techniques?|moves|t[ée]cnicas?|golpes)\b/i],
  ['freeRoll', /\b(free ?roll\w*|rolling|rolls?|rola\w*|treino livre|livre)\b/i],
  ['warmup', /\b(warm[ -]?ups?|movements?|aquec\w*|movimentos?)\b/i],
  ['wrapup', /\b(wrap[ -]?ups?|cool[ -]?down|fechamento|encerramento)\b/i],
  ['concept', /\b(concepts?|focus|conceitos?|foco)\b/i],
];

/** The kind of block a line opens, if it reads as a section heading rather than notes. */
export function sectionKind(line: string): BlockKind | null {
  if (/\d/.test(line) || line.length > 60) return null;
  const found = SECTION_WORDS.find(([, re]) => re.test(line));
  if (!found) return null;
  const words = line.replace(/[[\]:]/g, ' ').trim().split(/\s+/).length;
  // "[Game around that concept/objective]", "Warm up with:"
  if (/^\[.*\]$/.test(line) || (line.endsWith(':') && words <= 4)) return found[0];
  // A bare line counts only when it's nothing but the heading: "Free roll", not "Just rolls today".
  const rest = line.replace(found[1], ' ').replace(/[^\p{L}\s]/gu, ' ').trim().toLowerCase();
  return rest.split(/\s+/).every((w) => !w || /^(section|seção|secao|with|com)$/.test(w)) ? found[0] : null;
}

/** "2x3 minutes", "3 x 5 min": rounds per side, then minutes. */
const ROUNDS = /\b(\d{1,2})\s*[x×]\s*(\d{1,2})\s*min/i;

/** A technique's name from the line above its GIF: "Move 1:" → "Move 1". */
const cleanName = (line: string) => line.replace(/[\s:–-]+$/, '').trim();

/**
 * The class a note becomes. `clips` lines up with note.gifs; a GIF that
 * could not be made into a clip leaves its technique card without one.
 *
 * When the note has section headings, each section becomes a block of its
 * kind; otherwise the text goes to a Concept block and the GIFs to Technique.
 */
export function noteToPlan(note: EnexNote, clips: Array<Clip | undefined>, now = new Date()): ClassPlan {
  // Split the note at its headings. Two headings in a row for the same kind
  // ("Warm up with:" then "[Movement section]") open one block.
  const sections: Array<{ kind: BlockKind | null; pieces: Array<string | number> }> = [{ kind: null, pieces: [] }];
  for (const p of note.pieces) {
    const kind = typeof p === 'string' ? sectionKind(p) : null;
    const last = sections[sections.length - 1];
    if (kind && !(kind === last.kind && !last.pieces.length)) sections.push({ kind, pieces: [] });
    else if (!kind) last.pieces.push(p);
  }
  const headed = sections.length > 1;

  const blocks: Block[] = [];
  for (const { kind, pieces } of sections) {
    const { lines, moves } = splitMoves(pieces, clips);
    if (!headed) {
      if (lines.length || !moves.length) blocks.push({ ...newBlock('concept'), notes: lines.join('\n') });
      if (moves.length) blocks.push({ ...newBlock('gems'), moves });
      break;
    }
    if (!kind && !lines.length && !moves.length) continue;
    blocks.push(sectionBlock(kind ?? 'concept', lines, moves));
  }

  const stamp = now.toISOString();
  return {
    id: uid(),
    title: note.title,
    date: note.date ?? todayISO(now),
    createdAt: stamp,
    updatedAt: stamp,
    blocks,
  };
}

/**
 * A section's GIFs as techniques, each named by the short line just above it
 * and holding the lines below it as notes. Lines before the first GIF are the
 * section's own text.
 */
function splitMoves(pieces: Array<string | number>, clips: Array<Clip | undefined>): { lines: string[]; moves: Move[] } {
  const lines: string[] = [];
  const moves: Move[] = [];
  let current: Move | null = null;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const next = pieces[i + 1];
    if (typeof p === 'string') {
      // A short line right above a GIF is that GIF's name.
      if (typeof next === 'number' && p.length <= NAME_MAX) continue;
      if (current) current.notes = current.notes ? `${current.notes}\n${p}` : p;
      else lines.push(p);
      continue;
    }
    const above = pieces[i - 1];
    let name = typeof above === 'string' && above.length <= NAME_MAX ? cleanName(above) : '';
    // A second GIF straight after the first shows more of the same move.
    if (!name && typeof above === 'number' && current?.name) name = `${current.name.replace(/ \(\d+\)$/, '')} (${countSame(moves, current.name) + 1})`;
    current = move(name);
    const clip = clips[p];
    if (clip) current.clip = clip;
    moves.push(current);
  }
  return { lines, moves };
}

function countSame(moves: Move[], name: string): number {
  const base = name.replace(/ \(\d+\)$/, '');
  return moves.filter((m) => m.name === base || m.name.startsWith(`${base} (`)).length;
}

/** The block a section becomes, its text put where that kind of block keeps it. */
function sectionBlock(kind: BlockKind, lines: string[], moves: Move[]): Block {
  const items = (xs: string[]) => xs.map((x) => item(x));
  const text = lines.join('\n');
  const extra = moves.length ? { moves } : {};
  switch (kind) {
    case 'warmup':
      return { ...newBlock('warmup'), drills: items(lines), ...extra };
    case 'concept': {
      // The first line is the focus; the rest is how it's explained.
      const [rule = '', ...rest] = lines;
      return { ...newBlock('concept'), rule, notes: rest.join('\n'), ...extra };
    }
    case 'game': {
      const game = newBlock('game');
      // "2x3 minutes" sets the rounds; a bare "Rounds:" above it goes too.
      const rounds = lines.findIndex((l) => ROUNDS.test(l));
      if (rounds >= 0) {
        const [, n, min] = ROUNDS.exec(lines[rounds])!;
        game.rounds = { ...game.rounds, roundsPerSide: Number(n), minutes: Number(min) };
      }
      const rest = lines.filter((l, i) => i !== rounds && !(rounds >= 0 && /^rounds?:?$|^rounds?\s*:$|^rodadas?:?$/i.test(l)));
      const [objective = '', ...goals] = rest;
      return { ...game, objective, goals: items(goals), ...extra };
    }
    case 'gems':
      return { ...newBlock('gems'), moves: moves.length ? moves : [move()], options: items(lines) };
    case 'freeRoll':
      return { ...newBlock('freeRoll'), notes: text, ...extra };
    case 'wrapup':
      return { ...newBlock('wrapup'), notes: text, ...extra };
  }
}
