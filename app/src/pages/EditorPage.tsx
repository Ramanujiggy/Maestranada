// The class plan editor. Five numbered cards, one per block of the class,
// in the order they are taught. Every change saves as you type.

import { useState, type ReactNode } from 'react';
import { ArrowLeft, Copy, Download, Play, Plus, Printer, Trash2, X } from 'lucide-react';
import {
  MOVEMENT_SUGGESTIONS,
  describeGameRounds,
  duplicatePlan,
  formatMinutes,
  freeRollSeconds,
  gameRoundCount,
  gameSeconds,
  item,
  move,
  type ClassPlan,
  type SectionKey,
} from '../lib/plan.ts';
import { navigate } from '../lib/router.ts';
import type { PlansApi } from '../lib/usePlans.ts';
import { Field, Stepper, TextArea, TextInput, Toggle, formatRest } from '../components/controls.tsx';
import { EditableList } from '../components/EditableList.tsx';
import { Timeline } from '../components/Timeline.tsx';
import { PrintSheet } from '../components/PrintSheet.tsx';
import { ConfirmDialog } from '../components/feedback.tsx';
import { downloadJson } from './LibraryPage.tsx';

function Section({
  id,
  index,
  title,
  hint,
  aside,
  children,
}: {
  id: SectionKey;
  index: number;
  title: string;
  hint: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card" id={`section-${id}`} style={{ animationDelay: `${index * 50}ms`, scrollMarginTop: 20 }}>
      <div className="section-head">
        <div className="section-head-text">
          <span className="section-index">{String(index).padStart(2, '0')}</span>
          <div>
            <h2 className="card-title">{title}</h2>
            <p className="section-hint">{hint}</p>
          </div>
        </div>
        {aside}
      </div>
      <div className="section-stack">{children}</div>
    </section>
  );
}

function SubPanel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="subpanel">
      <div className="eyebrow" style={{ color: 'var(--copper)' }}>
        {title}
      </div>
      {hint && (
        <p className="section-hint" style={{ margin: '4px 0 12px' }}>
          {hint}
        </p>
      )}
      {!hint && <div style={{ height: 10 }} />}
      {children}
    </div>
  );
}

export function EditorPage({
  plan,
  api,
  notify,
  canCreate,
}: {
  plan: ClassPlan;
  api: PlansApi;
  notify: (m: string) => void;
  canCreate: () => boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (next: ClassPlan) => api.upsert(next);
  const { warmup, concept, game, gems, freeRoll } = plan;
  const rounds = game.rounds;

  const jump = (key: SectionKey) =>
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const unusedSuggestions = MOVEMENT_SUGGESTIONS.filter(
    (s) => !warmup.drills.some((d) => d.text.trim().toLowerCase() === s.toLowerCase()),
  );

  const minutesStepper = (value: number, onChange: (v: number) => void) => (
    <Stepper label="Time" value={value} onChange={onChange} min={0} max={60} format={(v) => `${v} min`} />
  );

  return (
    <>
      <div className="shell no-print">
        <header className="topbar">
          <button type="button" className="btn btn-ghost" onClick={() => navigate({ name: 'library' })}>
            <ArrowLeft size={17} /> Classes
          </button>
          <div className="topbar-actions">
            <span className="save-state hide-sm">
              <span className="save-dot" /> Saved on this device
            </span>
            <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'run', id: plan.id })}>
              <Play size={16} /> Teach
            </button>
          </div>
        </header>

        <div className="desk">
          <div className="desk-main">
            <div className="card" style={{ padding: 22 }}>
              <div className="title-grid">
                <Field label="Class title">
                  {(id) => (
                    <TextInput
                      id={id}
                      className="title-input"
                      value={plan.title}
                      placeholder="e.g. Leg drag to the back"
                      onChange={(title) => set({ ...plan, title })}
                    />
                  )}
                </Field>
                <Field label="Date">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      className="input"
                      style={{ height: 54, minWidth: 0 }}
                      value={plan.date}
                      onChange={(e) => set({ ...plan, date: e.target.value })}
                    />
                  )}
                </Field>
              </div>
            </div>

            <Section
              id="warmup"
              index={1}
              title="Warm-up · Movement"
              hint="Solo movement to wake the body up."
              aside={minutesStepper(warmup.minutes, (minutes) => set({ ...plan, warmup: { ...warmup, minutes } }))}
            >
              <EditableList
                items={warmup.drills}
                onChange={(drills) => set({ ...plan, warmup: { ...warmup, drills } })}
                placeholder="Add a movement drill"
                emptyText="No drills yet. Tap a suggestion or type your own."
              />
              {unusedSuggestions.length > 0 && (
                <div className="chips">
                  {unusedSuggestions.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className="chip"
                      onClick={() => set({ ...plan, warmup: { ...warmup, drills: [...warmup.drills, item(s)] } })}
                    >
                      <Plus size={12} /> {s}
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section
              id="concept"
              index={2}
              title="Concept"
              hint="The one general rule the whole class is about."
              aside={minutesStepper(concept.minutes, (minutes) => set({ ...plan, concept: { ...concept, minutes } }))}
            >
              <Field label="General rule">
                {(id) => (
                  <TextInput
                    id={id}
                    value={concept.rule}
                    placeholder="e.g. Offensive opportunities from the leg drag"
                    onChange={(rule) => set({ ...plan, concept: { ...concept, rule } })}
                  />
                )}
              </Field>
              <Field label="How you'll explain it">
                {(id) => (
                  <TextArea
                    id={id}
                    value={concept.notes}
                    placeholder="A sentence or two you'll say to the room"
                    onChange={(notes) => set({ ...plan, concept: { ...concept, notes } })}
                  />
                )}
              </Field>
            </Section>

            <Section
              id="game"
              index={3}
              title="Positional game"
              hint="A spar around the concept. Goals first, details once they've felt it."
              aside={<span className="pill">{formatMinutes(gameSeconds(plan) / 60)}</span>}
            >
              <div className="grid-2">
                <Field label="Start position">
                  {(id) => (
                    <TextInput
                      id={id}
                      value={game.start}
                      placeholder="e.g. Leg drag"
                      onChange={(start) => set({ ...plan, game: { ...game, start } })}
                    />
                  )}
                </Field>
                <Field label="Objective">
                  {(id) => (
                    <TextInput
                      id={id}
                      value={game.objective}
                      placeholder="e.g. Take the back"
                      onChange={(objective) => set({ ...plan, game: { ...game, objective } })}
                    />
                  )}
                </Field>
              </div>

              <SubPanel
                title="General goals"
                hint="The goals and the movements toward them. No specific technique or details yet."
              >
                <EditableList
                  items={game.goals}
                  onChange={(goals) => set({ ...plan, game: { ...game, goals } })}
                  placeholder="e.g. Top: keep the hips pinned, move toward the back"
                />
              </SubPanel>

              <SubPanel
                title="Details: beating the position"
                hint="General guidelines you go over after the first rounds."
              >
                <EditableList
                  items={game.details}
                  onChange={(details) => set({ ...plan, game: { ...game, details } })}
                  placeholder="e.g. Chest to the far hip"
                />
              </SubPanel>

              <div className="grid-2">
                <Field label="Transition to the next position">
                  {(id) => (
                    <TextInput
                      id={id}
                      value={game.transition}
                      placeholder="e.g. Leg drag → back take"
                      onChange={(transition) => set({ ...plan, game: { ...game, transition } })}
                    />
                  )}
                </Field>
                <Field label="Submission option">
                  {(id) => (
                    <TextInput
                      id={id}
                      value={game.submission}
                      placeholder="e.g. Rear naked choke"
                      onChange={(submission) => set({ ...plan, game: { ...game, submission } })}
                    />
                  )}
                </Field>
              </div>

              <SubPanel title="Rounds">
                <div className="stepper-row">
                  <Stepper
                    label={rounds.switchPositions ? 'Rounds per side' : 'Rounds'}
                    value={rounds.roundsPerSide}
                    min={1}
                    max={12}
                    onChange={(roundsPerSide) => set({ ...plan, game: { ...game, rounds: { ...rounds, roundsPerSide } } })}
                  />
                  <Stepper
                    label="Length"
                    value={rounds.minutes}
                    min={1}
                    max={15}
                    format={(v) => `${v} min`}
                    onChange={(minutes) => set({ ...plan, game: { ...game, rounds: { ...rounds, minutes } } })}
                  />
                  <Stepper
                    label="Rest"
                    value={rounds.restSeconds}
                    min={0}
                    max={180}
                    step={15}
                    format={formatRest}
                    onChange={(restSeconds) => set({ ...plan, game: { ...game, rounds: { ...rounds, restSeconds } } })}
                  />
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14 }}>
                  <Toggle
                    label="Switch partners"
                    checked={rounds.switchPartners}
                    onChange={(switchPartners) => set({ ...plan, game: { ...game, rounds: { ...rounds, switchPartners } } })}
                  />
                  <Toggle
                    label="Then switch positions"
                    checked={rounds.switchPositions}
                    onChange={(switchPositions) => set({ ...plan, game: { ...game, rounds: { ...rounds, switchPositions } } })}
                  />
                </div>
                <p className="section-hint" style={{ marginTop: 12 }}>
                  {describeGameRounds(rounds)} · {gameRoundCount(rounds)} rounds in all
                </p>
              </SubPanel>
            </Section>

            <Section
              id="gems"
              index={4}
              title="Gems"
              hint="The specific moves that win the game, and the options off them."
              aside={minutesStepper(gems.minutes, (minutes) => set({ ...plan, gems: { ...gems, minutes } }))}
            >
              {gems.moves.map((m, i) => (
                <div className="move-card" key={m.id}>
                  <div className="move-head">
                    <span className="move-num">Move {i + 1}</span>
                    <TextInput
                      value={m.name}
                      placeholder="Name the move"
                      onChange={(name) =>
                        set({ ...plan, gems: { ...gems, moves: gems.moves.map((x) => (x.id === m.id ? { ...x, name } : x)) } })
                      }
                    />
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={`Remove move ${i + 1}`}
                      onClick={() => set({ ...plan, gems: { ...gems, moves: gems.moves.filter((x) => x.id !== m.id) } })}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <TextArea
                    value={m.notes}
                    rows={2}
                    placeholder="Key details, cues, common mistakes"
                    onChange={(notes) =>
                      set({ ...plan, gems: { ...gems, moves: gems.moves.map((x) => (x.id === m.id ? { ...x, notes } : x)) } })
                    }
                  />
                </div>
              ))}
              <div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => set({ ...plan, gems: { ...gems, moves: [...gems.moves, move()] } })}
                >
                  <Plus size={15} /> Add move
                </button>
              </div>
              <SubPanel title="Options" hint="Where to go when the move is stopped.">
                <EditableList
                  items={gems.options}
                  onChange={(options) => set({ ...plan, gems: { ...gems, options } })}
                  placeholder="e.g. Switch to the opposite leg drag"
                />
              </SubPanel>
            </Section>

            <Section
              id="freeRoll"
              index={5}
              title="Free roll"
              hint="Live rounds to try it all out."
              aside={<span className="pill">{formatMinutes(freeRollSeconds(plan) / 60)}</span>}
            >
              <div className="stepper-row">
                <Stepper
                  label="Rounds"
                  value={freeRoll.rounds}
                  min={0}
                  max={12}
                  onChange={(r) => set({ ...plan, freeRoll: { ...freeRoll, rounds: r } })}
                />
                <Stepper
                  label="Length"
                  value={freeRoll.minutes}
                  min={1}
                  max={15}
                  format={(v) => `${v} min`}
                  onChange={(minutes) => set({ ...plan, freeRoll: { ...freeRoll, minutes } })}
                />
                <Stepper
                  label="Rest"
                  value={freeRoll.restSeconds}
                  min={0}
                  max={180}
                  step={15}
                  format={formatRest}
                  onChange={(restSeconds) => set({ ...plan, freeRoll: { ...freeRoll, restSeconds } })}
                />
              </div>
              <Field label="Notes">
                {(id) => (
                  <TextArea
                    id={id}
                    value={freeRoll.notes}
                    rows={2}
                    placeholder="e.g. Start from the leg drag if you want to work it"
                    onChange={(notes) => set({ ...plan, freeRoll: { ...freeRoll, notes } })}
                  />
                )}
              </Field>
            </Section>
          </div>

          <aside className="desk-margin">
            <Timeline plan={plan} onJump={jump} />
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate({ name: 'run', id: plan.id })}>
                <Play size={17} /> Teach this class
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print class sheet
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => downloadJson(`${(plan.title || 'class').replace(/[^\w-]+/g, '-').toLowerCase()}.json`, plan)}
                >
                  <Download size={16} /> Export
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    if (!canCreate()) return;
                    const copy = duplicatePlan(plan);
                    api.upsert(copy);
                    navigate({ name: 'edit', id: copy.id });
                    notify('Plan duplicated');
                  }}
                >
                  <Copy size={16} /> Duplicate
                </button>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Delete class
              </button>
            </div>
          </aside>
        </div>
      </div>

      <PrintSheet plan={plan} />

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this class?"
          body={`“${plan.title || 'Untitled class'}” will be removed from this device.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            api.remove(plan.id);
            navigate({ name: 'library' });
            notify('Plan deleted');
          }}
        />
      )}
    </>
  );
}
