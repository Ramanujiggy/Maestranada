// The paper version of a plan — hidden on screen, shown only when printing.
// One page a coach can fold into a gi pocket: a box to tick per block, the
// times in a right-hand column, and a grid only where you write by hand.

import type { ReactNode } from 'react';
import {
  describeGameRounds,
  formatMinutes,
  freeRollSeconds,
  gameSeconds,
  totalMinutes,
  type ClassPlan,
  type Clip,
  type ListItem,
} from '../lib/plan.ts';
import { useClipStill } from '../lib/clips.ts';
import { formatRest } from './controls.tsx';
import { LogoMark } from './Tally.tsx';

function Bullets({ items }: { items: ListItem[] }) {
  const filled = items.filter((x) => x.text.trim());
  if (!filled.length) return null;
  return (
    <ul>
      {filled.map((x) => (
        <li key={x.id}>{x.text}</li>
      ))}
    </ul>
  );
}

function Block({ title, time, children }: { title: string; time: string; children: ReactNode }) {
  return (
    <section>
      <span className="ps-box" />
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      <span className="ps-time">{time}</span>
    </section>
  );
}

// Paper can't play a clip, so the printed sheet shows a still frame of it.
function PrintClip({ clip }: { clip: Clip }) {
  const url = useClipStill(clip);
  return url ? <img className="ps-clip" src={url} alt="" width={clip.width} height={clip.height} /> : null;
}

function Line({ k, v }: { k: string; v: string }) {
  if (!v.trim()) return null;
  return (
    <p>
      <span className="ps-k">{k}</span> {v}
    </p>
  );
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function PrintSheet({ plan }: { plan: ClassPlan }) {
  const { warmup, concept, game, gems, freeRoll } = plan;
  return (
    <div className="print-sheet">
      <div className="ps-head">
        <h1>
          <LogoMark height={26} />
          {plan.title || 'Untitled class'}
        </h1>
        <div className="ps-meta">
          {formatDate(plan.date)}
          <br />
          {formatMinutes(totalMinutes(plan))}
        </div>
      </div>

      <Block title="Warm-up · Movement" time={formatMinutes(warmup.minutes)}>
        <Bullets items={warmup.drills} />
      </Block>

      <Block title="Concept" time={formatMinutes(concept.minutes)}>
        {concept.rule && (
          <p>
            <strong>General rule:</strong> {concept.rule}
          </p>
        )}
        {concept.notes && <p>{concept.notes}</p>}
      </Block>

      <Block title="Positional game" time={formatMinutes(gameSeconds(plan) / 60)}>
        <p>
          <strong>
            {game.start || 'Start position'} → {game.objective || 'objective'}
          </strong>
        </p>
        {game.goals.length > 0 && <h3>Goals and movements</h3>}
        <Bullets items={game.goals} />
        {game.details.length > 0 && <h3>Details: beating the position</h3>}
        <Bullets items={game.details} />
        <Line k="Transition" v={game.transition} />
        <Line k="Submission" v={game.submission} />
        <Line k="Rounds" v={`${describeGameRounds(game.rounds)} · rest ${formatRest(game.rounds.restSeconds)}`} />
      </Block>

      <Block title="Gems" time={formatMinutes(gems.minutes)}>
        {gems.moves
          .filter((m) => m.name.trim() || m.notes.trim() || m.clip)
          .map((m, i) => (
            <div key={m.id}>
              <h3>
                Move {i + 1}: {m.name}
              </h3>
              {m.clip && <PrintClip clip={m.clip} />}
              {m.notes && <p>{m.notes}</p>}
            </div>
          ))}
        {gems.options.length > 0 && <h3>Options</h3>}
        <Bullets items={gems.options} />
      </Block>

      <Block title="Free roll" time={formatMinutes(freeRollSeconds(plan) / 60)}>
        <p>
          {freeRoll.rounds} × {freeRoll.minutes} min · rest {formatRest(freeRoll.restSeconds)}
        </p>
        {freeRoll.notes && <p>{freeRoll.notes}</p>}
      </Block>

      <div className="ps-notes">
        <span className="ps-k">Notes</span>
      </div>
      <div className="ps-foot">
        <span>maestranada</span>
        <span>{plan.title}</span>
      </div>
    </div>
  );
}
