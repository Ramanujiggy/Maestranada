import { GIFEncoder } from 'gifenc';
import { GifReader } from 'omggif';
import { md5 } from './md5.ts';
import { countNotes, looksLikeEnex, noteLines, noteToPlan, readEnex } from './evernote.ts';
import { frameSeconds } from './gifClip.ts';

const bytes = (s: string) => new TextEncoder().encode(s);

/** A tiny animated GIF, one colour per frame. */
function gif(frames: number, shade = 0): Uint8Array {
  const enc = GIFEncoder();
  for (let i = 0; i < frames; i++) {
    enc.writeFrame(new Uint8Array(4).fill(0), 2, 2, { palette: [[shade, i * 40, 0], [0, 0, 0]], delay: 100 });
  }
  enc.finish();
  return enc.bytes();
}

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

function resource(b: Uint8Array, mime = 'image/gif') {
  return `<resource><data encoding="base64">\n${b64(b).replace(/(.{60})/g, '$1\n')}\n</data><mime>${mime}</mime><width>2</width><height>2</height></resource>`;
}

function enex(notes: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="20261023T120000Z" application="Evernote" version="10.0">
${notes.join('\n')}
</en-export>`;
}

function note(title: string, body: string, resources: string, created = '20240314T190000Z') {
  return `<note><title>${title}</title><created>${created}</created><content><![CDATA[<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>${body}</en-note>]]></content>${resources}</note>`;
}

describe('md5', () => {
  it('matches the standard test vectors', () => {
    expect(md5(bytes(''))).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5(bytes('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5(bytes('The quick brown fox jumps over the lazy dog'))).toBe('9e107d9d372bb6826bd81d3542a419d6');
    expect(md5(bytes('1234567890'.repeat(8)))).toBe('57edf4a22be3c955ac49da2e2107b67a');
  });
});

describe('noteLines', () => {
  it('reads divs, line breaks, lists and pictures in order', () => {
    const lines = noteLines(
      '<en-note><div>Leg drag to the back</div><div><br/></div><ul><li>Pin the knee</li><li>Hip to hip</li></ul><en-media type="image/gif" hash="ABC"/><div>a &amp; b<br/>c</div><en-media type="image/png" hash="def"/></en-note>',
    );
    expect(lines).toEqual([
      'Leg drag to the back',
      'Pin the knee',
      'Hip to hip',
      { gif: true, hash: 'abc' },
      'a & b',
      'c',
      { gif: false, hash: 'def' },
    ]);
  });
});

describe('readEnex and noteToPlan', () => {
  const g1 = gif(3, 10);
  const g2 = gif(4, 200);
  const legDrag = note(
    'Leg drag &amp; back take',
    `<div>Warm up: shrimps, leg drag entries</div>
     <div>Focus: chest to chest before the back</div>
     <div>Leg drag pass</div><en-media type="image/gif" hash="${md5(g1)}"/>
     <div>Pin the hip, knee on the mat</div><div>Head on the far side</div>
     <div>Back take when they turn away</div><div><en-media type="image/gif" hash="${md5(g2)}"/></div>
     <div>Seat belt first, then hooks</div>`,
    // Out of order on purpose: the hash decides.
    resource(g2) + resource(bytes('not a gif'), 'image/png') + resource(g1),
  );
  const plain = note('Open mat', '<div>Just rolls today</div>', '', '20250102T080000Z');
  const file = enex([legDrag, plain]);

  it('spots an export and counts its notes', () => {
    expect(looksLikeEnex(file)).toBe(true);
    expect(looksLikeEnex('{"prancheta":1}')).toBe(false);
    expect(countNotes(file)).toBe(2);
  });

  it('reads each note with its GIFs matched by hash', () => {
    const [a, b] = [...readEnex(file)];
    expect(a.title).toBe('Leg drag & back take');
    expect(a.date).toBe('2024-03-14');
    expect(a.gifs).toEqual([g1, g2]);
    expect(a.pieces).toContain(0);
    expect(b).toMatchObject({ title: 'Open mat', date: '2025-01-02', gifs: [] });
  });

  it('makes each GIF a technique named by the line above it, with the lines below as notes', () => {
    const [a] = [...readEnex(file)];
    const plan = noteToPlan(a, [
      { id: 'c1', width: 2, height: 2 },
      { id: 'c2', width: 2, height: 2 },
    ]);
    expect(plan.title).toBe('Leg drag & back take');
    expect(plan.date).toBe('2024-03-14');
    expect(plan.blocks.map((b) => b.kind)).toEqual(['concept', 'gems']);
    const concept = plan.blocks[0];
    expect(concept.kind === 'concept' && concept.notes).toBe('Warm up: shrimps, leg drag entries\nFocus: chest to chest before the back');
    expect(plan.blocks[1].moves).toMatchObject([
      { name: 'Leg drag pass', notes: 'Pin the hip, knee on the mat\nHead on the far side', clip: { id: 'c1' } },
      { name: 'Back take when they turn away', notes: 'Seat belt first, then hooks', clip: { id: 'c2' } },
    ]);
  });

  it('keeps a technique card when its GIF could not be made into a clip', () => {
    const [a] = [...readEnex(file)];
    const plan = noteToPlan(a, [undefined, { id: 'c2', width: 2, height: 2 }]);
    expect(plan.blocks[1].moves?.[0]).toMatchObject({ name: 'Leg drag pass' });
    expect(plan.blocks[1].moves?.[0].clip).toBeUndefined();
  });

  it('puts a note with no GIFs into a Concept block', () => {
    const [, b] = [...readEnex(file)];
    const plan = noteToPlan(b, []);
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0]).toMatchObject({ kind: 'concept', notes: 'Just rolls today' });
  });

  it('brings in GIFs the text never shows, and leaves a long line in the notes rather than as a name', () => {
    const long = 'This is a long sentence about the position that is clearly a note, not the name of a move';
    const n = note('X', `<div>${long}</div><en-media type="image/gif" hash="${md5(g1)}"/>`, resource(g1) + resource(g2));
    const [x] = [...readEnex(enex([n]))];
    expect(x.gifs).toEqual([g1, g2]);
    const plan = noteToPlan(x, []);
    expect(plan.blocks[0]).toMatchObject({ kind: 'concept', notes: long });
    expect(plan.blocks[1].moves?.map((m) => m.name)).toEqual(['', '']);
  });

  it('decodes the test GIFs frame by frame', () => {
    const r = new GifReader(g2);
    expect(r.numFrames()).toBe(4);
    expect(frameSeconds(r.frameInfo(0).delay)).toBe(0.1);
    expect(frameSeconds(0)).toBe(0.1);
  });
});
