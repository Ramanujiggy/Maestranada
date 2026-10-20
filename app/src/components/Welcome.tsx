// First-run welcome: what the app is for, the five blocks, and that
// everything stays on this device. Reopened from "How it works".

import { useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';
import type { InstallState } from '../lib/pwa.ts';
import { Logo } from './Tally.tsx';
import { t, type Key } from '../lib/i18n.ts';

const BLOCKS: [Key, Key][] = [
  ['sec.warmup', 'welcomeWarmup'],
  ['sec.concept', 'welcomeConcept'],
  ['sec.game', 'welcomeGame'],
  ['sec.gems', 'welcomeGems'],
  ['sec.freeRoll', 'welcomeFreeRoll'],
];

export function Welcome({
  install,
  onStart,
  onClose,
}: {
  install: InstallState;
  onStart: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card sheet welcome" role="dialog" aria-modal="true" aria-label={t('welcome')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <Logo />
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <h2 className="page-title" style={{ fontSize: 30, margin: '14px 0 6px' }}>
          {t('welcomeTitle')}
        </h2>
        <p className="narrative" style={{ fontSize: 17 }}>
          {t('welcomeLead')}
        </p>

        <ol className="welcome-blocks">
          {BLOCKS.map(([title, text], i) => (
            <li key={title}>
              <span className="section-index" style={{ fontSize: 24, minWidth: 30 }}>
                {i + 1}
              </span>
              <span>
                <strong>{t(title)}</strong>
                <span className="muted">{t(text)}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="subpanel welcome-notes">
          <p>
            <strong>{t('welcomeTeachTitle')}</strong> {t('welcomeTeach')}
          </p>
          <p>
            <strong>{t('welcomePrivateTitle')}</strong> {t('welcomePrivate')}
          </p>
          {install.kind === 'ios' && (
            <p>
              <strong>{t('welcomeIosTitle')}</strong> {t('welcomeIosBefore')} <Share size={13} /> {t('welcomeIosAfter')}
            </p>
          )}
        </div>

        <div className="dialog-actions" style={{ flexWrap: 'wrap' }}>
          {install.kind === 'prompt' && (
            <button type="button" className="btn btn-secondary" onClick={install.install}>
              <Download size={16} /> {t('installApp')}
            </button>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
            {t('welcomeStart')}
          </button>
        </div>
      </div>
    </div>
  );
}
