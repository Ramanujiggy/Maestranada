// The class as a Word document (.docx): the same content as the printed
// sheet, with each technique clip embedded as its animated GIF. Word, Google
// Docs and Pages all open .docx, so the coach can edit it, email it, or drop
// it into a shared drive. This module is loaded only when someone exports,
// so the docx library never slows down opening the app.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx';
import {
  describeGameRounds,
  formatMinutes,
  freeRollSeconds,
  gameSeconds,
  totalMinutes,
  type ClassPlan,
  type ListItem,
} from './plan.ts';
import { getClip } from './clips.ts';
import { formatDate } from '../components/PrintSheet.tsx';
import { formatRest } from '../components/controls.tsx';

const INK = '13233B';
const MUTED = '5D6B80';
const RULE = 'C3CBD6';
/** Widest a clip is placed on the page, in pixels at 96 dpi (about 9 cm). */
const CLIP_WIDTH = 340;

export type ClipBytes = Map<string, Uint8Array>;

function sectionHeading(title: string, time: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
    tabStops: [{ type: TabStopType.RIGHT, position: 9700 }],
    children: [
      new TextRun({ text: title, bold: true, color: INK, size: 28 }),
      new TextRun({ text: `\t${time}`, color: MUTED, size: 22, font: 'Courier New' }),
    ],
  });
}

function sub(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 40 },
    children: [new TextRun({ text, bold: true, color: INK })],
  });
}

function body(text: string, opts: { label?: string; bold?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      ...(opts.label ? [new TextRun({ text: `${opts.label.toUpperCase()}  `, color: MUTED, size: 16, bold: true })] : []),
      new TextRun({ text, bold: opts.bold }),
    ],
  });
}

function bullets(items: ListItem[]): Paragraph[] {
  return items.filter((x) => x.text.trim()).map((x) => new Paragraph({ text: x.text, bullet: { level: 0 } }));
}

/** Builds the document from a plan and the GIF bytes of its clips. Pure, so it can be tested. */
export function buildClassDocument(plan: ClassPlan, clips: ClipBytes): Document {
  const { warmup, concept, game, gems, freeRoll } = plan;
  const title = plan.title || 'Untitled class';

  const gemParagraphs: Paragraph[] = [];
  gems.moves
    .filter((m) => m.name.trim() || m.notes.trim() || m.clip)
    .forEach((m, i) => {
      gemParagraphs.push(sub(`Move ${i + 1}: ${m.name || 'Untitled move'}`));
      const bytes = m.clip && clips.get(m.clip.id);
      if (m.clip && bytes) {
        const scale = Math.min(1, CLIP_WIDTH / m.clip.width);
        gemParagraphs.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new ImageRun({
                type: 'gif',
                data: bytes,
                transformation: { width: Math.round(m.clip.width * scale), height: Math.round(m.clip.height * scale) },
                altText: { name: m.name || `Move ${i + 1}`, description: `Technique clip: ${m.name}`, title: m.name || `Move ${i + 1}` },
              }),
            ],
          }),
        );
      }
      if (m.notes.trim()) gemParagraphs.push(body(m.notes));
    });

  return new Document({
    creator: 'Prancheta',
    title,
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22, color: INK } },
        heading2: { run: { font: 'Arial' } },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 60 },
            children: [new TextRun({ text: title, bold: true, size: 48, color: INK, font: 'Arial' })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 6 } },
            children: [
              new TextRun({ text: `${formatDate(plan.date)}  ·  ${formatMinutes(totalMinutes(plan))}`, color: MUTED, font: 'Courier New', size: 20 }),
            ],
          }),

          sectionHeading('Warm-up · Movement', formatMinutes(warmup.minutes)),
          ...bullets(warmup.drills),

          sectionHeading('Concept', formatMinutes(concept.minutes)),
          ...(concept.rule ? [body(concept.rule, { bold: true })] : []),
          ...(concept.notes ? [body(concept.notes)] : []),

          sectionHeading('Positional game', formatMinutes(gameSeconds(plan) / 60)),
          body(`${game.start || 'Start position'} → ${game.objective || 'objective'}`, { bold: true }),
          ...(game.goals.length ? [sub('Goals and movements'), ...bullets(game.goals)] : []),
          ...(game.details.length ? [sub('Details: beating the position'), ...bullets(game.details)] : []),
          ...(game.transition ? [body(game.transition, { label: 'Transition' })] : []),
          ...(game.submission ? [body(game.submission, { label: 'Submission' })] : []),
          body(`${describeGameRounds(game.rounds)} · rest ${formatRest(game.rounds.restSeconds)}`, { label: 'Rounds' }),

          sectionHeading('Gems', formatMinutes(gems.minutes)),
          ...gemParagraphs,
          ...(gems.options.length ? [sub('Options'), ...bullets(gems.options)] : []),

          sectionHeading('Free roll', formatMinutes(freeRollSeconds(plan) / 60)),
          body(`${freeRoll.rounds} × ${freeRoll.minutes} min · rest ${formatRest(freeRoll.restSeconds)}`),
          ...(freeRoll.notes ? [body(freeRoll.notes)] : []),

          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 360 },
            children: [new TextRun({ text: 'Made with Prancheta', color: MUTED, size: 16 })],
          }),
        ],
      },
    ],
  });
}

/** Loads the plan's clips and packs the .docx. */
export async function exportClassDocument(plan: ClassPlan): Promise<Blob> {
  const clips: ClipBytes = new Map();
  for (const m of plan.gems.moves) {
    if (!m.clip) continue;
    const blob = await getClip(m.clip.id).catch(() => undefined);
    if (blob) clips.set(m.clip.id, new Uint8Array(await blob.arrayBuffer()));
  }
  return Packer.toBlob(buildClassDocument(plan, clips));
}
