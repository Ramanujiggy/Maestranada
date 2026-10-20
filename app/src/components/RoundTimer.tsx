// The mat timer: runs a schedule of rounds and rests, calls out what happens
// next, and sounds a tone at every change so the coach can watch the room
// instead of the screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { formatClock, type RoundSegment } from '../lib/plan.ts';
import { Tally } from './Tally.tsx';

let audio: AudioContext | null = null;

function tone(freq: number, ms: number, delay = 0) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    const start = ctx.currentTime + delay / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + ms / 1000 + 0.05);
  } catch {
    // No audio available; the timer still works silently.
  }
}

export function RoundTimer({ segments, title }: { segments: RoundSegment[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(segments[0]?.seconds ?? 0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const last = useRef<number | null>(null);

  const reset = useCallback(() => {
    setIndex(0);
    setRemaining(segments[0]?.seconds ?? 0);
    setRunning(false);
    setFinished(false);
  }, [segments]);

  // A new schedule (different section or edited rounds) starts fresh.
  useEffect(reset, [reset]);

  const advance = useCallback(() => {
    const next = index + 1;
    if (next >= segments.length) {
      setRunning(false);
      setFinished(true);
      setRemaining(0);
      tone(660, 260);
      tone(880, 260, 280);
      tone(1100, 500, 560);
      return;
    }
    setIndex(next);
    setRemaining(segments[next].seconds);
    if (segments[next].kind === 'round') {
      tone(880, 420);
    } else {
      tone(520, 300);
      tone(520, 300, 340);
    }
  }, [index, segments]);

  useEffect(() => {
    if (!running) {
      last.current = null;
      return;
    }
    const tick = () => {
      const now = performance.now();
      const dt = last.current === null ? 0 : (now - last.current) / 1000;
      last.current = now;
      setRemaining((r) => r - dt);
    };
    const id = setInterval(tick, 100);
    tick();
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && remaining <= 0) advance();
  }, [remaining, running, advance]);

  // Three short pips over the last three seconds of every segment.
  const whole = Math.ceil(remaining);
  useEffect(() => {
    if (running && whole > 0 && whole <= 3) tone(440, 120);
  }, [whole, running]);

  if (segments.length === 0) {
    return <p className="muted">No rounds set for this block.</p>;
  }

  const seg = segments[index];
  // Tally strokes count rounds only; rests are the gaps between them.
  const rounds = segments.filter((s) => s.kind === 'round').length;
  const roundsDone = finished ? rounds : segments.slice(0, index).filter((s) => s.kind === 'round').length;
  const finishing = !finished && seg.kind === 'round' && remaining <= 10;

  const toggle = () => {
    if (finished) {
      reset();
      return;
    }
    if (!running && index === 0 && remaining === seg.seconds) tone(880, 420);
    setRunning((r) => !r);
  };

  return (
    <div className={`timer ${seg.kind === 'rest' && !finished ? 'rest' : ''} ${finishing ? 'finishing' : ''}`}>
      <div className="eyebrow">{title}</div>
      <div className="timer-face">
        <span className="sub-label">{finished ? 'Done' : seg.label}</span>
        <span className="timer-clock" aria-live="off">
          {formatClock(finished ? 0 : remaining)}
        </span>
      </div>
      <Tally done={roundsDone} of={rounds} running={!finished && seg.kind === 'round'} struck={finished} />
      <div className="timer-cue">{finished ? 'Block complete' : seg.cue}</div>
      <div className="timer-controls">
        <button type="button" className="icon-btn" aria-label="Restart" onClick={reset}>
          <RotateCcw size={18} />
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={toggle} style={{ minWidth: 132 }}>
          {running ? <Pause size={18} /> : <Play size={18} />}
          {finished ? 'Again' : running ? 'Pause' : index === 0 && remaining === seg.seconds ? 'Start' : 'Resume'}
        </button>
        <button type="button" className="icon-btn" aria-label="Skip to next" onClick={advance} disabled={finished}>
          <SkipForward size={18} />
        </button>
      </div>
      <div className="timer-queue">
        {segments.map((s, i) => (
          <div key={i} className={i === index && !finished ? 'current' : i < index || finished ? 'past' : ''}>
            <span>
              {s.label}
              {s.kind === 'round' ? ` · ${s.cue}` : ''}
            </span>
            <span className="t">{formatClock(s.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
