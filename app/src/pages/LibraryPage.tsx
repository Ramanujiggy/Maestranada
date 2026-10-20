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

const STRUCTURE = ['Warm-up', 'Concept', 'Positional game', 'Gems', 'Free roll'];

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
      const text = await file.text();
      const classFile = await import('../lib/classFile.ts');
      if (classFile.looksLikeClassFile(text)) {
        const plan = classFile.readClassFile(text);
        raw = plan ? [plan] : [];
      } else {
        const parsed = JSON.parse(text);
        raw = Array.isArray(parsed) ? parsed : [parsed];
      }
      list = raw.map(normalizePlan).filter((p): p is ClassPlan => p !== null);
    } catch {
      list = [];
      raw = [];
    }
    if (!list.length) {
      notify('That file is not a class file or a backup');
      return;
    }
    try {
      await restoreClipData(raw);
    } catch {
      notify('Not enough space on this device for the clips in that file');
      return;
    }
    const changed = api.importMany(list);
    notify(changed ? `Imported ${changed} class plan${changed === 1 ? '' : 's'}` : 'Those plans are already up to date here');
  };

  const exportAll = async () => {
    try {
      await downloadBackup(`maestranada-backup-${todayISO()}.json`, api.plans);
    } catch {
      notify('The backup could not be made. Try again.');
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo />
        </div>
        <div className="topbar-actions">
          {install.kind === 'prompt' && (
            <button type="button" className="btn btn-secondary" onClick={install.install}>
              <MonitorDown size={16} /> Install app
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onHelp}>
            <CircleHelp size={16} /> <span className="hide-sm">How it works</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> <span className="hide-sm">Import</span>
          </button>
          {api.plans.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => void exportAll()}>
              <Download size={16} /> <span className="hide-sm">Export all</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,text/html,.html,.htm"
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
        <div className="eyebrow-strong">
          Class prep
        </div>
        <h1 className="page-title" style={{ margin: '10px 0 8px' }}>
          Plan the class before you step on the mat.
        </h1>
        <p className="narrative">Movement first, one idea, a game to find it, then the gems.</p>
        <div className="structure-strip">
          {STRUCTURE.map((s, i) => (
            <span key={s} style={{ display: 'contents' }}>
              <span className="step">
                <b>{i + 1}</b>
                {s}
              </span>
              {i < STRUCTURE.length - 1 && <span className="sep">·</span>}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-primary btn-lg" onClick={create}>
            <Plus size={18} /> New class plan
          </button>
        </div>
      </section>

      <div className="library-head">
        <div>
          <div className="eyebrow">Your classes</div>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>
          {api.plans.length} plan{api.plans.length === 1 ? '' : 's'}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="card empty">
          <h2 className="card-title">No classes yet</h2>
          <p className="muted" style={{ margin: 0 }}>
            Start one and the structure is already laid out for you.
          </p>
          <button type="button" className="btn btn-primary" onClick={create}>
            <Plus size={16} /> New class plan
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
                  {p.title || 'Untitled class'}
                </a>
              </h2>
              <p className="plan-card-concept">{p.concept.rule || <span className="muted">No concept yet</span>}</p>
              <div className="plan-card-meta">
                {p.game.start && (
                  <span className="pill">
                    {p.game.start}
                    {p.game.objective ? ` → ${p.game.objective}` : ''}
                  </span>
                )}
                {p.gems.moves.filter((m) => m.name.trim()).length > 0 && (
                  <span className="pill">{p.gems.moves.filter((m) => m.name.trim()).length} gems</span>
                )}
              </div>
              <div className="plan-card-foot" onClick={(e) => e.stopPropagation()}>
                <a className="btn btn-secondary" href={hrefFor({ name: 'run', id: p.id })}>
                  <Play size={15} /> Teach
                </a>
                <div className="actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Duplicate"
                    title="Duplicate"
                    onClick={() => {
                      api.upsert(duplicatePlan(p));
                      notify('Plan duplicated');
                    }}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label="Delete"
                    title="Delete"
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
          <strong>Keep your plans safe on iPhone.</strong> Safari can clear a website's data when it goes unused for a
          week. Add Maestranada to your Home Screen (tap <Share size={13} /> Share, then Add to Home Screen) and it keeps
          your plans and works offline.
        </div>
      )}

      <footer className="library-foot">
        <span>Works offline</span>
        <span className="sep">·</span>
        <span>Your plans stay on this device</span>
        {api.plans.length > 0 && (
          <>
            <span className="sep">·</span>
            <button type="button" className="link" onClick={() => void exportAll()}>
              Back up all plans
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
          title="Delete this class?"
          body={`“${pendingDelete.title || 'Untitled class'}” will be removed from this device.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            api.remove(pendingDelete.id);
            setPendingDelete(null);
            notify('Plan deleted');
          }}
        />
      )}
    </div>
  );
}
