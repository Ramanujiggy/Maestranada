// Home: every class plan, newest first, and the one action that matters —
// start a new class.

import { useRef, useState } from 'react';
import { CircleHelp, Copy, Download, MonitorDown, Play, Plus, Share, Trash2, Upload } from 'lucide-react';
import { blankPlan, duplicatePlan, formatMinutes, normalizePlan, todayISO, totalMinutes, type ClassPlan } from '../lib/plan.ts';
import { hrefFor, navigate } from '../lib/router.ts';
import type { PlansApi } from '../lib/usePlans.ts';
import { ConfirmDialog } from '../components/feedback.tsx';
import { formatDate } from '../components/PrintSheet.tsx';
import { TemplatePicker } from '../components/TemplatePicker.tsx';
import { Logo } from '../components/Tally.tsx';
import type { Template } from '../lib/samples.ts';
import type { InstallState } from '../lib/pwa.ts';
import { restoreClipData, withClipData } from '../lib/clips.ts';
import { saveFile } from '../lib/files.ts';
import { t, type Key } from '../lib/i18n.ts';
import { LangSwitch } from '../components/LangSwitch.tsx';

const STRUCTURE: Key[] = ['stripWarmup', 'sec.concept', 'sec.game', 'sec.gems', 'sec.freeRoll'];

/** Writes plans to a backup file, with their technique clips inside so nothing is lost. */
export async function downloadBackup(filename: string, plans: ClassPlan | ClassPlan[]) {
  const list = Array.isArray(plans) ? plans : [plans];
  const withClips = await withClipData(list);
  const data = Array.isArray(plans) ? withClips : withClips[0];
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await saveFile(blob, filename);
}

export function LibraryPage({
  api,
  notify,
  install,
  onHelp,
  pickerOpen,
  setPickerOpen,
}: {
  api: PlansApi;
  notify: (m: string) => void;
  install: InstallState;
  onHelp: () => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<ClassPlan | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sorted = [...api.plans].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));

  const open = (plan: ClassPlan) => {
    api.upsert(plan);
    setPickerOpen(false);
    navigate({ name: 'edit', id: plan.id });
  };
  const create = () => setPickerOpen(true);

  const onImport = async (file: File) => {
    let raw: unknown[];
    let list: ClassPlan[];
    try {
      const parsed = JSON.parse(await file.text());
      raw = Array.isArray(parsed) ? parsed : [parsed];
      list = raw.map(normalizePlan).filter((p): p is ClassPlan => p !== null);
    } catch {
      list = [];
      raw = [];
    }
    if (!list.length) {
      notify(t('importBad'));
      return;
    }
    try {
      await restoreClipData(raw);
    } catch {
      notify(t('importNoSpace'));
      return;
    }
    const changed = api.importMany(list);
    notify(changed ? (changed === 1 ? t('importedOne') : t('importedMany', { n: changed })) : t('importNothing'));
  };

  const exportAll = async () => {
    try {
      await downloadBackup(`prancheta-backup-${todayISO()}.json`, api.plans);
    } catch {
      notify(t('backupFailed'));
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo />
        </div>
        <div className="topbar-actions">
          <LangSwitch />
          {install.kind === 'prompt' && (
            <button type="button" className="btn btn-secondary" onClick={install.install}>
              <MonitorDown size={16} /> {t('installApp')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onHelp}>
            <CircleHelp size={16} /> <span className="hide-sm">{t('howItWorks')}</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> <span className="hide-sm">{t('import')}</span>
          </button>
          {api.plans.length > 0 && (
            <button type="button" className="btn btn-ghost hide-xs" onClick={() => void exportAll()}>
              <Download size={16} /> <span className="hide-sm">{t('exportAll')}</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <section className="hero-card">
        <div className="eyebrow-strong">{t('classPrep')}</div>
        <h1 className="page-title" style={{ margin: '10px 0 8px' }}>
          {t('libraryTitle')}
        </h1>
        <p className="narrative">{t('libraryLead')}</p>
        <div className="structure-strip">
          {STRUCTURE.map((s, i) => (
            <span key={s} style={{ display: 'contents' }}>
              <span className="step">
                <b>{i + 1}</b>
                {t(s)}
              </span>
              {i < STRUCTURE.length - 1 && <span className="sep">·</span>}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-primary btn-lg" onClick={create}>
            <Plus size={18} /> {t('newClassPlan')}
          </button>
        </div>
      </section>

      <div className="library-head">
        <div>
          <div className="eyebrow">{t('yourClasses')}</div>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>
          {api.plans.length === 1 ? t('planCountOne') : t('planCountMany', { n: api.plans.length })}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="card empty">
          <h2 className="card-title">{t('noClasses')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t('noClassesBody')}
          </p>
          <button type="button" className="btn btn-primary" onClick={create}>
            <Plus size={16} /> {t('newClassPlan')}
          </button>
        </div>
      ) : (
        <div className="plan-grid">
          {sorted.map((p) => (
            <article
              key={p.id}
              className="card plan-card"
              onClick={() => navigate({ name: 'edit', id: p.id })}
            >
              <div className="plan-card-head">
                <span className="plan-date">{formatDate(p.date)}</span>
                <span className="plan-length">{formatMinutes(totalMinutes(p))}</span>
              </div>
              <h2 className="card-title">
                <a href={hrefFor({ name: 'edit', id: p.id })} onClick={(e) => e.stopPropagation()}>
                  {p.title || t('untitledClass')}
                </a>
              </h2>
              <p className="plan-card-concept">{p.concept.rule || <span className="muted">{t('noConcept')}</span>}</p>
              <div className="plan-card-meta">
                {p.game.start && (
                  <span className="pill">
                    {p.game.start}
                    {p.game.objective ? ` → ${p.game.objective}` : ''}
                  </span>
                )}
                {p.gems.moves.filter((m) => m.name.trim()).length > 0 && (
                  <span className="pill">{t('gemCount', { n: p.gems.moves.filter((m) => m.name.trim()).length })}</span>
                )}
              </div>
              <div className="plan-card-foot" onClick={(e) => e.stopPropagation()}>
                <a className="btn btn-secondary" href={hrefFor({ name: 'run', id: p.id })}>
                  <Play size={15} /> {t('teach')}
                </a>
                <div className="actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('duplicate')}
                    title={t('duplicate')}
                    onClick={() => {
                      api.upsert(duplicatePlan(p));
                      notify(t('planDuplicated'));
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={t('delete')}
                    title={t('delete')}
                    onClick={() => setPendingDelete(p)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {install.kind === 'ios' && (
        <div className="subpanel ios-keep">
          <strong>{t('iosKeepTitle')}</strong> {t('iosKeepBefore')} <Share size={13} /> {t('iosKeepAfter')}
        </div>
      )}

      <footer className="library-foot">
        <span>{t('worksOffline')}</span>
        <span className="sep">·</span>
        <span>{t('plansStayHere')}</span>
        {api.plans.length > 0 && (
          <>
            <span className="sep">·</span>
            <button type="button" className="link" onClick={() => void exportAll()}>
              {t('backUpAll')}
            </button>
          </>
        )}
      </footer>

      {pickerOpen && (
        <TemplatePicker
          onClose={() => setPickerOpen(false)}
          onBlank={() => open(blankPlan())}
          onTemplate={(t: Template) => open(t.build())}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={t('deleteClassTitle')}
          body={t('deleteClassBody', { title: pendingDelete.title || t('untitledClass') })}
          confirmLabel={t('delete')}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            api.remove(pendingDelete.id);
            setPendingDelete(null);
            notify(t('planDeleted'));
          }}
        />
      )}
    </div>
  );
}
