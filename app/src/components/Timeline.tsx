// The class at a glance: total time and how it splits across the five
// blocks. The colours walk from light ink to full ink because the class
// itself builds from solo movement to live rolling.

import { formatMinutes, timeline, totalMinutes, type ClassPlan, type SectionKey } from '../lib/plan.ts';

export const SECTION_COLORS: Record<SectionKey, string> = {
  warmup: 'var(--sec-1)',
  concept: 'var(--sec-2)',
  game: 'var(--sec-3)',
  gems: 'var(--sec-4)',
  freeRoll: 'var(--sec-5)',
};

export function Timeline({ plan, onJump }: { plan: ClassPlan; onJump?: (key: SectionKey) => void }) {
  const segments = timeline(plan);
  const total = totalMinutes(plan);
  return (
    <div className="card">
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Class length
      </div>
      <div className="timeline-total">{formatMinutes(total)}</div>
      <div className="timeline-bar" aria-hidden>
        {segments.map((s) => (
          <span key={s.key} style={{ flexGrow: Math.max(s.minutes, 0.001), background: SECTION_COLORS[s.key] }} />
        ))}
      </div>
      <div className="timeline-rows">
        {segments.map((s, i) => (
          <button type="button" key={s.key} className="timeline-row" onClick={() => onJump?.(s.key)}>
            <span className="timeline-dot" style={{ background: SECTION_COLORS[s.key] }} />
            <span>
              <span className="muted">{String(i + 1).padStart(2, '0')}</span>&nbsp;&nbsp;{s.label}
            </span>
            <span className="time">{formatMinutes(s.minutes)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
