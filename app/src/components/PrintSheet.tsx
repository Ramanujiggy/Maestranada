// The paper version of a plan — hidden on screen, shown only when printing.
// One page a coach can fold into a gi pocket.

import {
  describeGameRounds,
  formatMinutes,
  freeRollSeconds,
  gameSeconds,
  totalMinutes,
  type ClassPlan,
  type ListItem,
} from '../lib/plan.ts';
import { formatRest } from './controls.tsx';

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
      <h1>{plan.title || 'Untitled class'}</h1>
      <div className="ps-meta">
        {formatDate(plan.date)} · {formatMinutes(totalMinutes(plan))}
      </div>

      <section>
        <h2>
          <span>1 · Warm-up · Movement</span>
          <span>{formatMinutes(warmup.minutes)}</span>
        </h2>
        <Bullets items={warmup.drills} />
      </section>

      <section>
        <h2>
          <span>2 · Concept</span>
          <span>{formatMinutes(concept.minutes)}</span>
        </h2>
        {concept.rule && (
          <p>
            <strong>General rule:</strong> {concept.rule}
          </p>
        )}
        {concept.notes && <p>{concept.notes}</p>}
      </section>

      <section>
        <h2>
          <span>3 · Positional game</span>
          <span>{formatMinutes(gameSeconds(plan) / 60)}</span>
        </h2>
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
      </section>

      <section>
        <h2>
          <span>4 · Gems</span>
          <span>{formatMinutes(gems.minutes)}</span>
        </h2>
        {gems.moves
          .filter((m) => m.name.trim() || m.notes.trim())
          .map((m, i) => (
            <div key={m.id}>
              <h3>
                Move {i + 1}: {m.name}
              </h3>
              {m.notes && <p>{m.notes}</p>}
            </div>
          ))}
        {gems.options.length > 0 && <h3>Options</h3>}
        <Bullets items={gems.options} />
      </section>

      <section>
        <h2>
          <span>5 · Free roll</span>
          <span>{formatMinutes(freeRollSeconds(plan) / 60)}</span>
        </h2>
        <p>
          {freeRoll.rounds} × {freeRoll.minutes} min · rest {formatRest(freeRoll.restSeconds)}
        </p>
        {freeRoll.notes && <p>{freeRoll.notes}</p>}
      </section>
    </div>
  );
}
