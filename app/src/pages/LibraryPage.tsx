// Home: every class plan, newest first, and the one action that matters —
// start a new class.

import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Copy, Download, MoreHorizontal, MonitorDown, Play, Trash2, Upload } from 'lucide-react';
import {
  allMoves,
  blankPlan,
  duplicatePlan,
  firstOf,
  formatMinutes,
  nextClass,
  normalizePlan,
  storedPlan,
  todayISO,
  totalMinutes,
  type ClassPlan,
  type FormatKey,
} from '../lib/plan.ts';
import { hrefFor, navigate } from '../lib/router.ts';
import type { PlansApi } from '../lib/usePlans.ts';
import { ConfirmDialog } from '../components/feedback.tsx';
import { formatDate } from '../components/PrintSheet.tsx';
import { TemplatePicker } from '../components/TemplatePicker.tsx';
import { AiPlanner } from '../components/AiPlanner.tsx';
import { planFromJson, readAiReply } from '../lib/aiClass.ts';
import { ClipboardIcon, Logo } from '../components/Marks.tsx';
import type { Template } from '../lib/samples.ts';
import { canInstall, isApple, isStandalone, type InstallState } from '../lib/pwa.ts';
import { restoreClipData, withClipData } from '../lib/clips.ts';
import { saveFile } from '../lib/files.ts';
import { t, type Key } from '../lib/i18n.ts';
import { LangSwitch } from '../components/LangSwitch.tsx';

const STRUCTURE: Key[] = ['stripWarmup', 'sec.concept', 'sec.game', 'sec.gems', 'sec.freeRoll'];

/** What a class is about, on its card: the concept, the game, how many moves. */
function PlanCardBody({ plan }: { plan: ClassPlan }) {
  const rule = firstOf(plan, 'concept')?.rule;
  const game = plan.blocks.find((b) => b.kind === 'game' && b.start.trim());
  const moves = allMoves(plan).filter((m) => m.name.trim()).length;
  return (
    <>
      <p className="plan-card-concept">{rule || <span className="muted">{t('noConcept')}</span>}</p>
      <div className="plan-card-meta">
        {game?.kind === 'game' && (
          <span className="pill">
            {game.start}
            {game.objective ? ` → ${game.objective}` : ''}
          </span>
        )}
        {moves > 0 && <span className="pill">{t('gemCount', { n: moves })}</span>}
      </div>
    </>
  );
}

/** On a phone the top bar's rarer actions fold into one menu, so the bar
 *  keeps the language switch and the logo room to breathe. */
function MoreMenu({ items }: { items: { icon: JSX.Element; label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className="more-menu show-sm" ref={ref}>
      <button type="button" className="icon-btn" aria-label={t('more')} aria-expanded={open} onClick={() => setOpen(!open)}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="more-list" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon} {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Writes plans to a backup file, with their technique clips inside so nothing is lost. */
export async function downloadBackup(filename: string, plans: ClassPlan | ClassPlan[]) {
  const list = Array.isArray(plans) ? plans : [plans];
  const withClips = (await withClipData(list)).map(storedPlan);
  const data = Array.isArray(plans) ? withClips : withClips[0];
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await saveFile(blob, filename);
}

export function LibraryPage({
  api,
  notify,
  install,
  onHelp,
  onInstall,
  pickerOpen,
  setPickerOpen,
}: {
  api: PlansApi;
  notify: (m: string) => void;
  install: InstallState;
  onHelp: () => void;
  onInstall: () => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<ClassPlan | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sorted = [...api.plans].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  const next = nextClass(api.plans);
  const today = todayISO();

  const open = (plan: ClassPlan) => {
    api.upsert(plan);
    setPickerOpen(false);
    setAiOpen(false);
    navigate({ name: 'edit', id: plan.id });
  };
  const create = () => setPickerOpen(true);

  const onImport = async (file: File) => {
    let raw: unknown[];
    let list: ClassPlan[];
    try {
      const text = await file.text();
      const classFile = await import('../lib/classFile.ts');
      if (classFile.looksLikeClassFile(text)) {
        const plan = classFile.readClassFile(text);
        raw = plan ? [plan] : [];
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
        // A backup's plans carry createdAt. Anything else is class JSON an AI
        // (or a person) wrote, which becomes a new class.
        const backup = Array.isArray(parsed) || (parsed && typeof parsed === 'object' && 'createdAt' in parsed);
        if (!backup) {
          const result = parsed ? planFromJson(parsed) : readAiReply(text);
          if ('plan' in result) {
            open(result.plan);
            notify(result.skipped ? t('aiBuiltSkipped', { n: result.skipped }) : t('aiBuilt'));
            return;
          }
        }
        raw = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      }
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
          {canInstall(install) && (
            <button
              type="button"
              className="btn btn-secondary"
              aria-label={t('installApp')}
              onClick={install.kind === 'prompt' ? () => void install.install() : onInstall}
            >
              <MonitorDown size={16} /> <span className="hide-sm">{t('installApp')}</span>
            </button>
          )}
          <button type="button" className="btn btn-ghost hide-sm" onClick={onHelp}>
            <CircleHelp size={16} /> {t('howItWorks')}
          </button>
          <button type="button" className="btn btn-ghost hide-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> {t('import')}
          </button>
          {api.plans.length > 0 && (
            <button type="button" className="btn btn-ghost hide-sm" onClick={() => void exportAll()}>
              <Download size={16} /> {t('exportAll')}
            </button>
          )}
          <MoreMenu
            items={[
              { icon: <CircleHelp size={16} />, label: t('howItWorks'), onClick: onHelp },
              { icon: <Upload size={16} />, label: t('import'), onClick: () => fileRef.current?.click() },
              ...(api.plans.length > 0
                ? [{ icon: <Download size={16} />, label: t('exportAll'), onClick: () => void exportAll() }]
                : []),
            ]}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,text/html,.html,.htm,text/plain,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <section className={`hero-card${sorted.length ? ' has-plans' : ''}`}>
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
        <p className="section-hint" style={{ margin: '8px 0 0' }}>
          {t('structureNote')}
        </p>
        <div style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-primary btn-lg" onClick={create}>
            <ClipboardIcon size={18} /> {t('newClassPlan')}
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
          {isStandalone() && isApple() && (
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              {t('emptyImportApple')}
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={create}>
            <ClipboardIcon size={16} /> {t('newClassPlan')}
          </button>
        </div>
      ) : (
        <div className="plan-grid">
          {sorted.map((p) => (
            <article
              key={p.id}
              className={`card plan-card${p === next ? ' is-next' : ''}`}
              onClick={() => navigate({ name: 'edit', id: p.id })}
            >
              <div className="plan-card-head">
                <span className="plan-date">
                  {p === next && <span className="next-tag">{p.date === today ? t('today') : t('nextUp')}</span>}
                  {formatDate(p.date)}
                </span>
                <span className="plan-length">{formatMinutes(totalMinutes(p))}</span>
              </div>
              <h2 className="card-title">
                <a href={hrefFor({ name: 'edit', id: p.id })} onClick={(e) => e.stopPropagation()}>
                  {p.title || t('untitledClass')}
                </a>
              </h2>
              <PlanCardBody plan={p} />
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

      {(install.kind === 'ios' || install.kind === 'ios-inapp') && (
        <div className="subpanel ios-keep">
          <strong>{t('iosKeepTitle')}</strong> {t('iosKeep')}{' '}
          <button type="button" className="link" onClick={onInstall}>
            {t('installShowMe')}
          </button>
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

      {/* On a phone the two things a coach does here sit under the thumb. */}
      {next && (
        <div className="thumb-bar">
          <button type="button" className="btn btn-secondary btn-lg" onClick={create}>
            <ClipboardIcon size={17} /> {t('newClassPlan')}
          </button>
          <a className="btn btn-primary btn-lg" href={hrefFor({ name: 'run', id: next.id })}>
            <Play size={17} />
            <span className="thumb-bar-label">
              {t('teach')}
              <small>{next.title || t('untitledClass')}</small>
            </span>
          </a>
        </div>
      )}

      {pickerOpen && (
        <TemplatePicker
          onClose={() => setPickerOpen(false)}
          onBlank={(format: FormatKey) => open(blankPlan(new Date(), format))}
          onTemplate={(t: Template) => open(t.build())}
          onAi={() => {
            setPickerOpen(false);
            setAiOpen(true);
          }}
        />
      )}

      {aiOpen && (
        <AiPlanner
          onClose={() => setAiOpen(false)}
          onBack={() => {
            setAiOpen(false);
            setPickerOpen(true);
          }}
          onPlan={(plan, skipped) => {
            open(plan);
            notify(skipped ? t('aiBuiltSkipped', { n: skipped }) : t('aiBuilt'));
          }}
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
