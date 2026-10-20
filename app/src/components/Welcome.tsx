// First-run welcome: what the app is for, the five blocks, and that
// everything stays on this device. Reopened from "How it works".

import { useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';
import type { InstallState } from '../lib/pwa.ts';

const BLOCKS: [string, string][] = [
  ['Warm-up · Movement', 'Solo movement to wake the body up.'],
  ['Concept', 'One general rule the whole class is about.'],
  ['Positional game', 'A spar toward a goal. Goals first, details once they have felt it.'],
  ['Gems', 'The specific moves that win the game, and their options.'],
  ['Free roll', 'Live rounds to try it all out.'],
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
      <div className="card sheet welcome" role="dialog" aria-modal="true" aria-label="Welcome" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="wordmark">Maestranada</span>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <h2 className="page-title" style={{ fontSize: 30, margin: '14px 0 6px' }}>
          Every class, one shape.
        </h2>
        <p className="narrative" style={{ fontSize: 17 }}>
          Plan it before you step on the mat, then teach it from your phone.
        </p>

        <ol className="welcome-blocks">
          {BLOCKS.map(([title, text], i) => (
            <li key={title}>
              <span className="section-index" style={{ fontSize: 24, minWidth: 30 }}>
                {i + 1}
              </span>
              <span>
                <strong>{title}</strong>
                <span className="muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="subpanel welcome-notes">
          <p>
            <strong>Teach mode</strong> shows one block at a time in big type, with a round timer that calls the
            switches for you.
          </p>
          <p>
            <strong>Your plans stay on this device.</strong> No account, no sign-in. Use Export to keep a backup or move
            plans to another device.
          </p>
          {install.kind === 'ios' && (
            <p>
              <strong>Add it to your Home Screen</strong> to use it like an app, even offline: tap <Share size={13} /> Share,
              then Add to Home Screen.
            </p>
          )}
        </div>

        <div className="dialog-actions" style={{ flexWrap: 'wrap' }}>
          {install.kind === 'prompt' && (
            <button type="button" className="btn btn-secondary" onClick={install.install}>
              <Download size={16} /> Install app
            </button>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
            Plan your first class
          </button>
        </div>
      </div>
    </div>
  );
}
