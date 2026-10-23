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
import { move, newBlock, todayISO, uid, type Block, type ClassPlan, type Clip, type Move } from './plan.ts';

export interface EnexNote {
  title: string;
  /** YYYY-MM-DD, from when the note was made. */
  date?: string;
  /** The note's lines in order, with a number where each GIF sits (an index into gifs). */
  pieces: Array<string | number>;
  gifs: Uint8Array[];
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
    const end = text.indexOf('</note>', start);
    if (end < 0) return;
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
  const created = /^(\d{4})(\d{2})(\d{2})T/.exec(tag(xml, 'created') ?? '');
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
  const gifs: Uint8Array[] = [];
  const used = new Set<number>();
  const pieces: Array<string | number> = [];
  for (const p of noteLines(content)) {
    if (typeof p === 'string') {
      pieces.push(p);
      continue;
    }
    if (!p.gif) continue;
    // Match by hash; if the export left it out or it differs, take the next GIF in order.
    let i = files.findIndex((f, k) => !used.has(k) && f.hash === p.hash);
    if (i < 0) i = files.findIndex((_, k) => !used.has(k));
    if (i < 0) continue;
    used.add(i);
    pieces.push(gifs.length);
    gifs.push(files[i].bytes);
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

/**
 * The class a note becomes. `clips` lines up with note.gifs; a GIF that
 * could not be made into a clip leaves its technique card without one.
 */
export function noteToPlan(note: EnexNote, clips: Array<Clip | undefined>, now = new Date()): ClassPlan {
  const { pieces } = note;
  // The line just above each GIF names it, when it's short enough to be a name.
  const names = new Map<number, number>(); // piece index of a GIF → piece index of its name
  pieces.forEach((p, i) => {
    if (typeof p !== 'number' || i === 0) return;
    const above = pieces[i - 1];
    if (typeof above === 'string' && above.length <= NAME_MAX) names.set(i, i - 1);
  });
  const nameLines = new Set(names.values());

  const preamble: string[] = [];
  const moves: Move[] = [];
  let current: Move | null = null;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (typeof p === 'number') {
      const at = names.get(i);
      current = move(at === undefined ? '' : (pieces[at] as string));
      const clip = clips[p];
      if (clip) current.clip = clip;
      moves.push(current);
    } else if (nameLines.has(i)) {
      continue;
    } else if (current) {
      current.notes = current.notes ? `${current.notes}\n${p}` : p;
    } else {
      preamble.push(p);
    }
  }

  const blocks: Block[] = [];
  if (preamble.length || !moves.length) {
    const concept = newBlock('concept');
    concept.notes = preamble.join('\n');
    blocks.push(concept);
  }
  if (moves.length) blocks.push({ ...newBlock('gems'), moves });

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
