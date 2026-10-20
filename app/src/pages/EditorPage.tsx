// The class plan editor. Five numbered cards, one per block of the class,
// in the order they are taught. One block is open at a time; the rest fold
// to a line that says what's in them. Every change saves as you type.

import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Copy, Download, FileText, Play, Plus, Printer, Send, Trash2, X } from 'lucide-react';
import {
  movementSuggestions,
  describeGameRounds,
  duplicatePlan,
  formatMinutes,
  freeRollSeconds,
  gameRoundCount,
  gameSeconds,
  item,
  move,
  sectionLabel,
  sectionSummary,
  SECTION_ORDER,
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
import { downloadBackup } from './LibraryPage.tsx';
import { ClipField } from '../components/ClipField.tsx';
import { fileSlug, saveFile } from '../lib/files.ts';
import { t } from '../lib/i18n.ts';

function Section({
  id,
  index,
  title,
  hint,
  time,
  open,
  onToggle,
  plan,
  next,
  onNext,
  children,
}: {
  id: SectionKey;
  index: number;
  title: string;
  hint: string;
  time: string;
  open: boolean;
  onToggle: () => void;
  plan: ClassPlan;
  next?: SectionKey;
  onNext?: () => void;
  children: ReactNode;
}) {
  const summary = sectionSummary(plan, id);
  return (
    <section className={`card section${open ? ' open' : ''}`} id={`section-${id}`}>
      <button
        type="button"
        className="section-toggle"
        aria-expanded={open}
        aria-controls={`section-body-${id}`}
        onClick={onToggle}
      >
        <span className="section-index">
          <span className={`section-box${summary.filled ? ' filled' : ''}`} aria-hidden />
          {String(index).padStart(2, '0')}
        </span>
        <span className="section-toggle-text">
          <span className="card-title">{title}</span>
          {!open && <span className={`section-summary${summary.filled ? '' : ' is-empty'}`}>{summary.text}</span>}
        </span>
        <span className="section-time">{time}</span>
        <ChevronDown size={18} className="section-chevron" aria-hidden />
      </button>
      {open && (
        <div className="section-stack" id={`section-body-${id}`}>
          <p className="section-hint section-lead">{hint}</p>
          {children}
          {next && onNext && (
            <div className="section-next">
              <button type="button" className="btn btn-secondary" onClick={onNext}>
                {t('nextSection', { name: sectionLabel(next) })} <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** The parts of a block a coach can leave out. Folded into "+ Label" chips until used. */
function Extras({ items }: { items: { key: string; label: string; onReveal: () => void }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="extras">
      <span className="extras-label">{t('addIfYouWant')}</span>
      <div className="chips">
        {items.map((x) => (
          <button type="button" key={x.key} className="chip" onClick={x.onReveal}>
            <Plus size={12} /> {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubPanel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="subpanel">
      <div className="eyebrow-strong">
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

/** The first block that still has nothing in it, so a new class opens where the work is.
    A class that's all planned opens folded, as an overview. */
function firstOpen(plan: ClassPlan): SectionKey | null {
  return SECTION_ORDER.find((k) => !sectionSummary(plan, k).filled) ?? null;
}

export function EditorPage({ plan, api, notify }: { plan: ClassPlan; api: PlansApi; notify: (m: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingMove, setPendingMove] = useState<string | null>(null);
  const set = (next: ClassPlan) => api.upsert(next);
  const { warmup, concept, game, gems, freeRoll } = plan;
  const rounds = game.rounds;
  const [exporting, setExporting] = useState<'doc' | 'file' | null>(null);
  const [open, setOpen] = useState<SectionKey | null>(() => firstOpen(plan));
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const exportDocument = async () => {
    setExporting('doc');
    try {
      const { exportClassDocument } = await import('../lib/exportDoc.ts');
      await saveFile(await exportClassDocument(plan), `${fileSlug(plan.title)}.docx`);
    } catch {
      notify(t('docFailed'));
    } finally {
      setExporting(null);
    }
  };

  const sendClassFile = async () => {
    setExporting('file');
    try {
      const { exportClassFile } = await import('../lib/classFile.ts');
      await saveFile(await exportClassFile(plan), `${fileSlug(plan.title)}.html`);
    } catch {
      notify(t('classFileFailed'));
    } finally {
      setExporting(null);
    }
  };

  // Opening one block folds the others. If the fold moved it off screen, or it
  // opened low on the page, bring its top into view.
  const openSection = (key: SectionKey, always = false) => {
    setOpen(key);
    requestAnimationFrame(() => {
      const el = document.getElementById(`section-${key}`);
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (always || top < 0 || top > window.innerHeight * 0.45) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const toggle = (key: SectionKey) => (open === key ? setOpen(null) : openSection(key));
  const jump = (key: SectionKey) => openSection(key, true);
  const nextOf = (key: SectionKey) => SECTION_ORDER[SECTION_ORDER.indexOf(key) + 1];
  const sectionProps = (key: SectionKey) => {
    const next = nextOf(key);
    return { id: key, plan, open: open === key, onToggle: () => toggle(key), next, onNext: next ? () => openSection(next, true) : undefined };
  };

  const isShown = (key: string, has: boolean) => has || !!shown[key];
  const reveal = (key: string) => {
    setShown((s) => ({ ...s, [key]: true }));
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`#extra-${key} input, #extra-${key} textarea`)?.focus());
  };
  const extra = (key: string, label: string, has: boolean) =>
    isShown(key, has) ? [] : [{ key, label, onReveal: () => reveal(key) }];

  const unusedSuggestions = movementSuggestions().filter(
    (s) => !warmup.drills.some((d) => d.text.trim().toLowerCase() === s.toLowerCase()),
  );

  const minutesStepper = (value: number, onChange: (v: number) => void) => (
    <div className="time-row">
      <Stepper label={t('time')} value={value} onChange={onChange} min={0} max={60} format={(v) => t('minutes', { n: v })} />
    </div>
  );

  return (
    <>
      <div className="shell no-print">
        <header className="topbar">
          <button type="button" className="btn btn-ghost" onClick={() => navigate({ name: 'library' })}>
            <ArrowLeft size={17} /> {t('classes')}
          </button>
          <div className="topbar-actions">
            <span className="save-state hide-sm">
              <span className="save-dot" /> {t('savedHere')}
            </span>
            <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'run', id: plan.id })}>
              <Play size={16} /> {t('teach')}
            </button>
          </div>
        </header>

        <div className="desk">
          <div className="desk-main">
            <div className="card" style={{ padding: 22 }}>
              <div className="title-grid">
                <Field label={t('classTitle')}>
                  {(id) => (
                    <TextInput
                      id={id}
                      className="title-input"
                      value={plan.title}
                      placeholder={t('classTitlePh')}
                      onChange={(title) => set({ ...plan, title })}
                    />
                  )}
                </Field>
                <Field label={t('date')}>
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      className="input"
                      value={plan.date}
                      onChange={(e) => set({ ...plan, date: e.target.value })}
                    />
                  )}
                </Field>
              </div>
            </div>

            <Section
              {...sectionProps('warmup')}
              index={1}
              title={t('sec.warmup')}
              hint={t('hint.warmup')}
              time={formatMinutes(warmup.minutes)}
            >
              {minutesStepper(warmup.minutes, (minutes) => set({ ...plan, warmup: { ...warmup, minutes } }))}
              <EditableList
                items={warmup.drills}
                onChange={(drills) => set({ ...plan, warmup: { ...warmup, drills } })}
                placeholder={t('addDrill')}
              />
              {unusedSuggestions.length > 0 && (
                <div className="extras">
                  <span className="extras-label">{t('tapToAdd')}</span>
                  <div className="chips chips-scroll">
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
                </div>
              )}
            </Section>

            <Section
              {...sectionProps('concept')}
              index={2}
              title={t('sec.concept')}
              hint={t('hint.concept')}
              time={formatMinutes(concept.minutes)}
            >
              {minutesStepper(concept.minutes, (minutes) => set({ ...plan, concept: { ...concept, minutes } }))}
              <Field label={t('generalRule')}>
                {(id) => (
                  <TextInput
                    id={id}
                    value={concept.rule}
                    placeholder={t('rulePh')}
                    onChange={(rule) => set({ ...plan, concept: { ...concept, rule } })}
                  />
                )}
              </Field>
              {isShown('explain', !!concept.notes.trim()) && (
                <div id="extra-explain">
                  <Field label={t('explainLabel')}>
                    {(id) => (
                      <TextArea
                        id={id}
                        value={concept.notes}
                        placeholder={t('explainPh')}
                        onChange={(notes) => set({ ...plan, concept: { ...concept, notes } })}
                      />
                    )}
                  </Field>
                </div>
              )}
              <Extras items={extra('explain', t('explainLabel'), !!concept.notes.trim())} />
            </Section>

            <Section
              {...sectionProps('game')}
              index={3}
              title={t('sec.game')}
              hint={t('hint.game')}
              time={formatMinutes(gameSeconds(plan) / 60)}
            >
              <div className="grid-2">
                <Field label={t('startPosition')}>
                  {(id) => (
                    <TextInput
                      id={id}
                      value={game.start}
                      placeholder={t('startPh')}
                      onChange={(start) => set({ ...plan, game: { ...game, start } })}
                    />
                  )}
                </Field>
                <Field label={t('objective')}>
                  {(id) => (
                    <TextInput
                      id={id}
                      value={game.objective}
                      placeholder={t('objectivePh')}
                      onChange={(objective) => set({ ...plan, game: { ...game, objective } })}
                    />
                  )}
                </Field>
              </div>

              <SubPanel
                title={t('goalsTitle')}
                hint={t('goalsHint')}
              >
                <EditableList
                  items={game.goals}
                  onChange={(goals) => set({ ...plan, game: { ...game, goals } })}
                  placeholder={t('goalsPh')}
                />
              </SubPanel>

              {isShown('details', game.details.length > 0) && (
                <div id="extra-details">
                  <SubPanel
                    title={t('details')}
                    hint={t('detailsHint')}
                  >
                    <EditableList
                      items={game.details}
                      onChange={(details) => set({ ...plan, game: { ...game, details } })}
                      placeholder={t('detailsPh')}
                    />
                  </SubPanel>
                </div>
              )}

              {(isShown('transition', !!game.transition.trim()) || isShown('submission', !!game.submission.trim())) && (
                <div className="grid-2">
                  {isShown('transition', !!game.transition.trim()) && (
                    <div id="extra-transition">
                      <Field label={t('transitionLabel')}>
                        {(id) => (
                          <TextInput
                            id={id}
                            value={game.transition}
                            placeholder={t('transitionPh')}
                            onChange={(transition) => set({ ...plan, game: { ...game, transition } })}
                          />
                        )}
                      </Field>
                    </div>
                  )}
                  {isShown('submission', !!game.submission.trim()) && (
                    <div id="extra-submission">
                      <Field label={t('submissionLabel')}>
                        {(id) => (
                          <TextInput
                            id={id}
                            value={game.submission}
                            placeholder={t('submissionPh')}
                            onChange={(submission) => set({ ...plan, game: { ...game, submission } })}
                          />
                        )}
                      </Field>
                    </div>
                  )}
                </div>
              )}

              <Extras
                items={[
                  ...extra('details', t('detailsChip'), game.details.length > 0),
                  ...extra('transition', t('transition'), !!game.transition.trim()),
                  ...extra('submission', t('submission'), !!game.submission.trim()),
                ]}
              />

              <SubPanel title={t('rounds')}>
                <div className="stepper-row">
                  <Stepper
                    label={rounds.switchPositions ? t('roundsPerSide') : t('rounds')}
                    value={rounds.roundsPerSide}
                    min={1}
                    max={12}
                    onChange={(roundsPerSide) => set({ ...plan, game: { ...game, rounds: { ...rounds, roundsPerSide } } })}
                  />
                  <Stepper
                    label={t('length')}
                    value={rounds.minutes}
                    min={1}
                    max={15}
                    format={(v) => t('minutes', { n: v })}
                    onChange={(minutes) => set({ ...plan, game: { ...game, rounds: { ...rounds, minutes } } })}
                  />
                  <Stepper
                    label={t('rest')}
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
                    label={t('switchPartners')}
                    checked={rounds.switchPartners}
                    onChange={(switchPartners) => set({ ...plan, game: { ...game, rounds: { ...rounds, switchPartners } } })}
                  />
                  <Toggle
                    label={t('thenSwitchPositions')}
                    checked={rounds.switchPositions}
                    onChange={(switchPositions) => set({ ...plan, game: { ...game, rounds: { ...rounds, switchPositions } } })}
                  />
                </div>
                <p className="section-hint" style={{ marginTop: 12 }}>
                  {describeGameRounds(rounds)} · {t('roundsInAll', { n: gameRoundCount(rounds) })}
                </p>
              </SubPanel>
            </Section>

            <Section
              {...sectionProps('gems')}
              index={4}
              title={t('sec.gems')}
              hint={t('hint.gems')}
              time={formatMinutes(gems.minutes)}
            >
              {minutesStepper(gems.minutes, (minutes) => set({ ...plan, gems: { ...gems, minutes } }))}
              {gems.moves.map((m, i) => (
                <div className="move-card" key={m.id}>
                  <div className="move-head">
                    <span className="move-num">{t('moveN', { n: i + 1 })}</span>
                    <TextInput
                      value={m.name}
                      placeholder={t('moveNamePh')}
                      onChange={(name) =>
                        set({ ...plan, gems: { ...gems, moves: gems.moves.map((x) => (x.id === m.id ? { ...x, name } : x)) } })
                      }
                    />
                    <button
                      type="button"
                      className="icon-btn danger"
                      aria-label={t('removeMoveN', { n: i + 1 })}
                      onClick={() =>
                        m.name.trim() || m.notes.trim() || m.clip
                          ? setPendingMove(m.id)
                          : set({ ...plan, gems: { ...gems, moves: gems.moves.filter((x) => x.id !== m.id) } })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <TextArea
                    value={m.notes}
                    rows={2}
                    placeholder={t('moveNotesPh')}
                    onChange={(notes) =>
                      set({ ...plan, gems: { ...gems, moves: gems.moves.map((x) => (x.id === m.id ? { ...x, notes } : x)) } })
                    }
                  />
                  <ClipField
                    clip={m.clip}
                    notify={notify}
                    onChange={(clip) =>
                      set({ ...plan, gems: { ...gems, moves: gems.moves.map((x) => (x.id === m.id ? { ...x, clip } : x)) } })
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
                  <Plus size={15} /> {t('addMove')}
                </button>
              </div>
              {isShown('options', gems.options.length > 0) && (
                <div id="extra-options">
                  <SubPanel title={t('options')} hint={t('optionsHint')}>
                    <EditableList
                      items={gems.options}
                      onChange={(options) => set({ ...plan, gems: { ...gems, options } })}
                      placeholder={t('optionsPh')}
                    />
                  </SubPanel>
                </div>
              )}
              <Extras items={extra('options', t('optionsChip'), gems.options.length > 0)} />
            </Section>

            <Section
              {...sectionProps('freeRoll')}
              index={5}
              title={t('sec.freeRoll')}
              hint={t('hint.freeRoll')}
              time={formatMinutes(freeRollSeconds(plan) / 60)}
            >
              <div className="stepper-row">
                <Stepper
                  label={t('rounds')}
                  value={freeRoll.rounds}
                  min={0}
                  max={12}
                  onChange={(r) => set({ ...plan, freeRoll: { ...freeRoll, rounds: r } })}
                />
                <Stepper
                  label={t('length')}
                  value={freeRoll.minutes}
                  min={1}
                  max={15}
                  format={(v) => t('minutes', { n: v })}
                  onChange={(minutes) => set({ ...plan, freeRoll: { ...freeRoll, minutes } })}
                />
                <Stepper
                  label={t('rest')}
                  value={freeRoll.restSeconds}
                  min={0}
                  max={180}
                  step={15}
                  format={formatRest}
                  onChange={(restSeconds) => set({ ...plan, freeRoll: { ...freeRoll, restSeconds } })}
                />
              </div>
              {isShown('rollNotes', !!freeRoll.notes.trim()) && (
                <div id="extra-rollNotes">
                  <Field label={t('notes')}>
                    {(id) => (
                      <TextArea
                        id={id}
                        value={freeRoll.notes}
                        rows={2}
                        placeholder={t('freeRollNotesPh')}
                        onChange={(notes) => set({ ...plan, freeRoll: { ...freeRoll, notes } })}
                      />
                    )}
                  </Field>
                </div>
              )}
              <Extras items={extra('rollNotes', t('notes'), !!freeRoll.notes.trim())} />
            </Section>
          </div>

          <aside className="desk-margin">
            <Timeline plan={plan} onJump={jump} />
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate({ name: 'run', id: plan.id })}>
                <Play size={17} /> {t('teachThisClass')}
              </button>
<button
                type="button"
                className="btn btn-secondary"
                onClick={sendClassFile}
                disabled={exporting !== null}
                title={t('classFileTitle')}
              >
                <Send size={16} /> {exporting === 'file' ? t('makingClassFile') : t('sendClassFile')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={exportDocument} disabled={exporting !== null}>
                <FileText size={16} /> {exporting === 'doc' ? t('makingDoc') : t('exportDoc')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> {t('printSheet')}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  title={t('backupTitle')}
                  onClick={() => downloadBackup(`${fileSlug(plan.title)}.json`, plan).catch(() => notify(t('backupFailed')))}
                >
                  <Download size={16} /> {t('backup')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const copy = duplicatePlan(plan);
                    api.upsert(copy);
                    navigate({ name: 'edit', id: copy.id });
                    notify(t('planDuplicated'));
                  }}
                >
                  <Copy size={16} /> {t('duplicate')}
                </button>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> {t('deleteClass')}
              </button>
            </div>
          </aside>
        </div>
      </div>

      <PrintSheet plan={plan} />

      {confirmDelete && (
        <ConfirmDialog
          title={t('deleteClassTitle')}
          body={t('deleteClassBody', { title: plan.title || t('untitledClass') })}
          confirmLabel={t('delete')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            api.remove(plan.id);
            navigate({ name: 'library' });
            notify(t('planDeleted'));
          }}
        />
      )}
      {pendingMove && (
        <ConfirmDialog
          title={t('removeMoveTitle')}
          body={t('removeMoveBody')}
          confirmLabel={t('removeMove')}
          onCancel={() => setPendingMove(null)}
          onConfirm={() => {
            set({ ...plan, gems: { ...gems, moves: gems.moves.filter((x) => x.id !== pendingMove) } });
            setPendingMove(null);
          }}
        />
      )}
    </>
  );
}
