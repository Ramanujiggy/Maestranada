// The class plan editor. Five numbered cards, one per block of the class,
// in the order they are taught. Every change saves as you type.

import { useState, type ReactNode } from 'react';
import { ArrowLeft, Copy, Download, FileText, Play, Plus, Printer, Send, Trash2, X } from 'lucide-react';
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
    <section className="card" id={`section-${id}`} style={{ scrollMarginTop: 20 }}>
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

export function EditorPage({ plan, api, notify }: { plan: ClassPlan; api: PlansApi; notify: (m: string) => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingMove, setPendingMove] = useState<string | null>(null);
  const set = (next: ClassPlan) => api.upsert(next);
  const { warmup, concept, game, gems, freeRoll } = plan;
  const rounds = game.rounds;
  const [exporting, setExporting] = useState<'doc' | 'file' | null>(null);

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

  const jump = (key: SectionKey) =>
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const unusedSuggestions = movementSuggestions().filter(
    (s) => !warmup.drills.some((d) => d.text.trim().toLowerCase() === s.toLowerCase()),
  );

  const minutesStepper = (value: number, onChange: (v: number) => void) => (
    <Stepper label={t('time')} value={value} onChange={onChange} min={0} max={60} format={(v) => t('minutes', { n: v })} />
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
              title={t('sec.warmup')}
              hint={t('hint.warmup')}
              aside={minutesStepper(warmup.minutes, (minutes) => set({ ...plan, warmup: { ...warmup, minutes } }))}
            >
              <EditableList
                items={warmup.drills}
                onChange={(drills) => set({ ...plan, warmup: { ...warmup, drills } })}
                placeholder={t('addDrill')}
                emptyText={t('noDrills')}
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
              title={t('sec.concept')}
              hint={t('hint.concept')}
              aside={minutesStepper(concept.minutes, (minutes) => set({ ...plan, concept: { ...concept, minutes } }))}
            >
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
            </Section>

            <Section
              id="game"
              index={3}
              title={t('sec.game')}
              hint={t('hint.game')}
              aside={<span className="pill">{formatMinutes(gameSeconds(plan) / 60)}</span>}
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

              <div className="grid-2">
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
              id="gems"
              index={4}
              title={t('sec.gems')}
              hint={t('hint.gems')}
              aside={minutesStepper(gems.minutes, (minutes) => set({ ...plan, gems: { ...gems, minutes } }))}
            >
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
              <SubPanel title={t('options')} hint={t('optionsHint')}>
                <EditableList
                  items={gems.options}
                  onChange={(options) => set({ ...plan, gems: { ...gems, options } })}
                  placeholder={t('optionsPh')}
                />
              </SubPanel>
            </Section>

            <Section
              id="freeRoll"
              index={5}
              title={t('sec.freeRoll')}
              hint={t('hint.freeRoll')}
              aside={<span className="pill">{formatMinutes(freeRollSeconds(plan) / 60)}</span>}
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
