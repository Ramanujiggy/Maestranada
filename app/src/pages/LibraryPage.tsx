// Home: every class plan, newest first, and the one action that matters —
// start a new class.

import { useRef, useState } from 'react';
import { Copy, Download, Play, Plus, Trash2, Upload } from 'lucide-react';
import { blankPlan, duplicatePlan, formatMinutes, normalizePlan, totalMinutes, type ClassPlan } from '../lib/plan.ts';
import { hrefFor, navigate } from '../lib/router.ts';
import type { PlansApi } from '../lib/usePlans.ts';
import { ConfirmDialog } from '../components/feedback.tsx';
import { formatDate } from '../components/PrintSheet.tsx';

const STRUCTURE = ['Warm-up', 'Concept', 'Positional game', 'Gems', 'Free roll'];

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LibraryPage({ api, notify }: { api: PlansApi; notify: (m: string) => void }) {
  const [pendingDelete, setPendingDelete] = useState<ClassPlan | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sorted = [...api.plans].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));

  const create = () => {
    const plan = blankPlan();
    api.upsert(plan);
    navigate({ name: 'edit', id: plan.id });
  };

  const onImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const list = (Array.isArray(parsed) ? parsed : [parsed]).map(normalizePlan).filter((p): p is ClassPlan => p !== null);
      const added = api.importMany(list);
      notify(added ? `Imported ${added} class plan${added === 1 ? '' : 's'}` : 'Those plans are already here');
    } catch {
      notify('That file is not a class plan export');
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">Maestranada</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> <span className="hide-sm">Import</span>
          </button>
          {api.plans.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => downloadJson('maestranada-plans.json', api.plans)}>
              <Download size={16} /> <span className="hide-sm">Export all</span>
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
        <div className="eyebrow" style={{ color: 'var(--copper)' }}>
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
        <div style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
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
          {sorted.map((p, i) => (
            <article
              key={p.id}
              className="card plan-card"
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              onClick={() => navigate({ name: 'edit', id: p.id })}
            >
              <div className="plan-card-head">
                <span className="sage" style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {formatDate(p.date)}
                </span>
                <span className="pill">{formatMinutes(totalMinutes(p))}</span>
              </div>
              <h2 className="card-title">{p.title || 'Untitled class'}</h2>
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
