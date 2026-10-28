// The sheet shown while an Evernote export comes in: which note, which clip,
// and a Stop that keeps every class already brought in. Also the short how-to
// for getting an .enex file out of Evernote.

import { useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import type { EnexProgress } from '../lib/enexImport.ts';
import { t } from '../lib/i18n.ts';

export function EvernoteImport({ progress, onStop }: { progress: EnexProgress | null; onStop: () => void }) {
  const done = progress ? (progress.note - 1 + (progress.clips ? (progress.clip - 1) / progress.clips : 0)) / progress.notes : 0;
  return (
    <div className="backdrop">
      <div className="card dialog" role="dialog" aria-modal="true" aria-label={t('enTitle')}>
        <h2 className="card-title">{t('enTitle')}</h2>
        <p className="muted" style={{ margin: '10px 0 16px' }}>
          {t('enBody')}
        </p>
        {progress && (
          <p className="enex-now">
            <strong>{t('enNote', { i: progress.note, n: progress.notes })}</strong>
            {progress.title && <span> · {progress.title}</span>}
          </p>
        )}
        <div className="clip-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done * 100)}>
          <span style={{ width: `${Math.round(done * 100)}%` }} />
          <em>{progress?.clips ? t('enClip', { i: progress.clip, n: progress.clips }) : t('enReading')}</em>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onStop}>
            {t('enStop')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** How to get class notes out of Evernote and into Prancheta, opened from the Library footer. */
export function EvernoteHelp({ onOpenFile, onClose }: { onOpenFile: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card sheet" role="dialog" aria-modal="true" aria-label={t('enHelpTitle')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="page-title" style={{ fontSize: 30, margin: 0 }}>
            {t('enHelpTitle')}
          </h2>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {t('enHelpLead')}
        </p>
        <ol className="ai-steps">
          {(['enHelp1', 'enHelp2', 'enHelp3'] as const).map((key, i) => (
            <li key={key}>
              <span className="ai-step-n">{i + 1}</span>
              <p className="ai-step-body" style={{ margin: 0, alignSelf: 'center' }}>
                {t(key)}
              </p>
            </li>
          ))}
        </ol>
        <p className="section-hint" style={{ margin: '16px 0 0' }}>
          {t('enHelpNote')}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-primary" onClick={onOpenFile}>
            <Upload size={16} /> {t('enHelpOpen')}
          </button>
        </div>
      </div>
    </div>
  );
}
