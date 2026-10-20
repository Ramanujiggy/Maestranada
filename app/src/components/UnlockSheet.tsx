import { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { BUY_URL, FREE_PLAN_LIMIT, type LicenseApi } from '../lib/license.ts';

export function UnlockSheet({ license, onClose, onUnlocked }: { license: LicenseApi; onClose: () => void; onUnlocked: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await license.unlock(key);
    setBusy(false);
    if (result.ok) onUnlocked();
    else setError(result.message);
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card sheet" style={{ width: 'min(460px, 100%)' }} role="dialog" aria-modal="true" aria-label="Unlock" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="eyebrow" style={{ color: 'var(--copper)' }}>
            Full version
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <h2 className="card-title" style={{ margin: '8px 0 6px' }}>
          Unlock unlimited classes
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          The free version keeps {FREE_PLAN_LIMIT} class plans. Buy once to plan as many classes as you teach, on this device,
          forever. No account and no subscription.
        </p>

        {BUY_URL && (
          <a className="btn btn-primary btn-lg" href={BUY_URL} target="_blank" rel="noreferrer" style={{ marginTop: 18, width: '100%' }}>
            Buy Maestranada
          </a>
        )}

        <div className="field" style={{ marginTop: 18 }}>
          <label className="field-label" htmlFor="license-key">
            Already bought it? Enter your license key
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="license-key"
              className="input"
              value={key}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
            />
            <button type="button" className="btn btn-secondary" onClick={submit} disabled={busy || !key.trim()}>
              <KeyRound size={15} /> {busy ? 'Checking' : 'Unlock'}
            </button>
          </div>
          {error && (
            <span role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
