// Teach mode: the plan as a coach uses it on the mat. One block at a time in
// large type, with the round timer beside the blocks that are timed. The
// positional game's details stay folded until the coach chooses to show
// them, because the class feels the game before it hears the details.

import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, X } from 'lucide-react';
import {
  sectionLabel,
  describeGameRounds,
  freeRollSchedule,
  gameSchedule,
  type ClassPlan,
  type ListItem,
  type RoundSegment,
  type SectionKey,
} from '../lib/plan.ts';
import { navigate } from '../lib/router.ts';
import { RoundTimer } from '../components/RoundTimer.tsx';
import { ClipView } from '../components/ClipField.tsx';
import { t, type Key } from '../lib/i18n.ts';

const ORDER: SectionKey[] = ['warmup', 'concept', 'game', 'gems', 'freeRoll'];
const TIMED = ['warmup', 'game', 'freeRoll'] as const;
const TIMER_TITLES: Record<(typeof TIMED)[number], Key> = { warmup: 'sec.warmupShort', game: 'timerGame', freeRoll: 'sec.freeRoll' };

/** Keeps the screen on while the class is being taught, so the timer stays
 *  visible and audible. The lock drops when the page hides, so it is taken
 *  again each time the page comes back. */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
    if (!wl) return;
    let sentinel: Sentinel | null = null;
    let live = true;
    const take = () => {
      if (document.visibilityState !== 'visible') return;
      wl.request('screen')
        .then((s) => {
          if (live) sentinel = s;
          else void s.release();
        })
        .catch(() => {});
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', take);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

function BigList({ items }: { items: ListItem[] }) {
  const filled = items.filter((x) => x.text.trim());
  if (!filled.length) return null;
  return (
    <ul className="run-list">
      {filled.map((x) => (
        <li key={x.id}>{x.text}</li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="muted">{t('nothingPlanned')}</p>;
}

export function RunPage({ plan }: { plan: ClassPlan }) {
  const [step, setStep] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const key = ORDER[step];
  useWakeLock();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') setStep((s) => Math.min(ORDER.length - 1, s + 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
      if (e.key === 'Escape') navigate({ name: 'edit', id: plan.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [plan.id]);

  useEffect(() => window.scrollTo({ top: 0 }), [step]);

  // Swipe left or right between blocks, as well as the buttons. Only a
  // mostly horizontal flick counts, so scrolling a long list never moves on.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || (e.target as HTMLElement).closest('input, textarea, .timer-queue')) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setStep((s) => (dx < 0 ? Math.min(ORDER.length - 1, s + 1) : Math.max(0, s - 1)));
  };

  const schedules = useMemo<Partial<Record<SectionKey, RoundSegment[]>>>(
    () => ({
      warmup:
        plan.warmup.minutes > 0
          ? [{ kind: 'round', label: t('sec.warmupShort'), cue: t('cueKeepMoving'), seconds: plan.warmup.minutes * 60 }]
          : [],
      game: gameSchedule(plan),
      freeRoll: freeRollSchedule(plan),
    }),
    [plan],
  );
  const schedule = schedules[key];

  const { warmup, concept, game, gems, freeRoll } = plan;

  let body;
  switch (key) {
    case 'warmup':
      body = warmup.drills.some((d) => d.text.trim()) ? <BigList items={warmup.drills} /> : <Empty />;
      break;
    case 'concept':
      body = (
        <>
          <div className="eyebrow-strong" style={{ marginBottom: 8 }}>
            {t('generalRule')}
          </div>
          <p className="run-big run-lead" style={{ fontSize: 'clamp(26px, 3.6vw, 36px)' }}>
            {concept.rule || <span className="muted">{t('noRule')}</span>}
          </p>
          {concept.notes && <p className="run-big muted">{concept.notes}</p>}
        </>
      );
      break;
    case 'game':
      body = (
        <>
          <div className="run-block">
            <div className="eyebrow-strong" style={{ marginBottom: 12 }}>
              {t('goalsAndMovements')}
            </div>
            {game.goals.length ? <BigList items={game.goals} /> : <Empty />}
          </div>
          <div className="run-block">
            <span className="pill">{describeGameRounds(game.rounds)}</span>
          </div>
          <div className="run-block run-reveal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div className="eyebrow-strong">{t('details')}</div>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDetails((v) => !v)}>
                {showDetails ? <EyeOff size={15} /> : <Eye size={15} />}
                {showDetails ? t('hide') : t('showDetails')}
              </button>
            </div>
            {showDetails ? (
              <div style={{ marginTop: 16 }}>
                <BigList items={game.details} />
                {game.transition && (
                  <p className="run-big">
                    <span className="sub-label">{t('transition')}</span>
                    <br />
                    {game.transition}
                  </p>
                )}
                {game.submission && (
                  <p className="run-big" style={{ marginBottom: 0 }}>
                    <span className="sub-label">{t('submission')}</span>
                    <br />
                    {game.submission}
                  </p>
                )}
              </div>
            ) : (
              <p className="section-hint" style={{ marginTop: 8 }}>
                {t('detailsLater')}
              </p>
            )}
          </div>
        </>
      );
      break;
    case 'gems': {
      const moves = gems.moves.filter((m) => m.name.trim() || m.notes.trim() || m.clip);
      body = (
        <>
          {moves.length === 0 && gems.options.length === 0 && <Empty />}
          {moves.map((m, i) => (
            <div className="run-block" key={m.id}>
              <div className="eyebrow-strong" style={{ marginBottom: 6 }}>
                {t('moveN', { n: i + 1 })}
              </div>
              <p className="run-big run-lead" style={{ fontSize: 'clamp(24px, 3.2vw, 32px)', marginBottom: 6 }}>
                {m.name || t('untitledMove')}
              </p>
              {m.clip && <ClipView clip={m.clip} label={m.name || t('moveN', { n: i + 1 })} />}
              {m.notes && <p className="run-big muted">{m.notes}</p>}
            </div>
          ))}
          {gems.options.length > 0 && (
            <div className="run-block">
              <div className="eyebrow-strong" style={{ marginBottom: 12 }}>
                {t('options')}
              </div>
              <BigList items={gems.options} />
            </div>
          )}
        </>
      );
      break;
    }
    case 'freeRoll':
      body = freeRoll.notes ? <p className="run-big">{freeRoll.notes}</p> : <p className="run-big muted">{t('rollItOut')}</p>;
      break;
  }

  const heading =
    key === 'game'
      ? `${game.start || sectionLabel('game')}${game.objective ? ` → ${game.objective}` : ''}`
      : key === 'warmup'
        ? t('sec.movement')
        : sectionLabel(key);

  return (
    <div className="shell run" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="topbar" style={{ marginBottom: 18 }}>
        <span className="run-head-title">{plan.title || t('untitledClass')}</span>
        <button type="button" className="btn btn-ghost" onClick={() => navigate({ name: 'edit', id: plan.id })}>
          <X size={17} /> {t('exit')}
        </button>
      </header>

      <nav className="run-progress" aria-label={t('classBlocks')}>
        {ORDER.map((k, i) => (
          <button
            type="button"
            key={k}
            className={i === step ? 'active' : i < step ? 'done' : ''}
            onClick={() => setStep(i)}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="bar" />
            <span className="label">
              {i + 1} · {sectionLabel(k)}
            </span>
          </button>
        ))}
      </nav>

      <div className={`run-stage ${schedule ? '' : 'solo'}`}>
        <div key={key}>
          <div className="eyebrow">
            {String(step + 1).padStart(2, '0')} · {sectionLabel(key)}
          </div>
          <h1 className="run-title">{heading}</h1>
          {body}
        </div>
        {/* Every timer stays mounted, so stepping to another block mid-round
            never loses the clock; only the current block's timer shows. */}
        {TIMED.map((k) =>
          schedules[k] ? (
            <div className="card run-timer" key={k} hidden={k !== key}>
              <RoundTimer segments={schedules[k]!} title={t(TIMER_TITLES[k])} />
            </div>
          ) : null,
        )}
      </div>

      <div className="run-nav">
        <button type="button" className="btn btn-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft size={16} /> {step > 0 ? sectionLabel(ORDER[step - 1]) : t('back')}
        </button>
        {step < ORDER.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {sectionLabel(ORDER[step + 1])} <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'edit', id: plan.id })}>
            {t('finishClass')}
          </button>
        )}
      </div>
    </div>
  );
}
