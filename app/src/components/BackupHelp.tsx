// How to keep a backup and bring it back. Opened from the backup reminder and
// the library footer; the site FAQ has the same steps.

import { useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { t } from '../lib/i18n.ts';

export function BackupHelp({ onBackUp, onClose }: { onBackUp?: () => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card sheet" role="dialog" aria-modal="true" aria-label={t('bkHelpTitle')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="page-title" style={{ fontSize: 30, margin: 0 }}>
            {t('bkHelpTitle')}
          </h2>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {t('bkHelpLead')}
        </p>
        <ol className="ai-steps">
          {(['bkHelp1', 'bkHelp2', 'bkHelp3'] as const).map((key, i) => (
            <li key={key}>
              <span className="ai-step-n">{i + 1}</span>
              <p className="ai-step-body" style={{ margin: 0, alignSelf: 'center' }}>
                {t(key)}
              </p>
            </li>
          ))}
        </ol>
        <p className="section-hint" style={{ margin: '16px 0 0' }}>
          {t('bkHelpNote')}
        </p>
        {onBackUp && (
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" onClick={onBackUp}>
              <Download size={16} /> {t('bkNow')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
