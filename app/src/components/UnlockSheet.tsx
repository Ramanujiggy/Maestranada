// The unlock: buy once on Lemon Squeezy, paste the key from the receipt, and
// this copy of the app makes classes without limit. It opens by itself when a
// new class would go past the free ones, and from the note on the class list.

import { useEffect, useState } from 'react';
import { Check, KeyRound, X } from 'lucide-react';
import { CHECKOUT_URL, FREE_CLASSES, unlockWith, useUnlocked, type KeyCheck } from '../lib/access.ts';
import { isApple } from '../lib/pwa.ts';
import { t } from '../lib/i18n.ts';

export function UnlockSheet({ limitHit, onClose }: { limitHit: boolean; onClose: () => void }) {
  const unlocked = useUnlocked();
  const [key, setKey] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | KeyCheck>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    if (!key.trim() || state === 'checking') return;
    setState('checking');
    setState(await unlockWith(key));
  };

  const title = unlocked ? t('unlockedTitle') : limitHit ? t('freeUsedTitle', { total: FREE_CLASSES }) : t('unlockTitle');

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="card sheet unlock-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="page-title" style={{ fontSize: 30, margin: 0 }}>
            {title}
          </h2>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {unlocked ? (
          <>
            <p className="unlock-done">
              <Check size={18} /> {t('unlockedBody')}
            </p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
                {t('done')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: '6px 0 16px' }}>
              {t('unlockLead', { total: FREE_CLASSES })}
            </p>

            {CHECKOUT_URL && (
              <a className="btn btn-primary btn-lg unlock-buy" href={CHECKOUT_URL} target="_blank" rel="noopener">
                {t('unlockBuy')}
              </a>
            )}

            <form
              className="unlock-key"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label htmlFor="unlock-key">
                <KeyRound size={15} /> {t('unlockHaveKey')}
              </label>
              <div className="unlock-row">
                <input
                  id="unlock-key"
                  className="input"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    if (state !== 'checking') setState('idle');
                  }}
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <button type="submit" className={CHECKOUT_URL ? 'btn btn-secondary' : 'btn btn-primary'} disabled={!key.trim() || state === 'checking'}>
                  {state === 'checking' ? t('unlockChecking') : t('unlockButton')}
                </button>
              </div>
              {state === 'bad' && (
                <p className="ai-error" role="alert">
                  {t('unlockBad')}
                </p>
              )}
              {state === 'offline' && (
                <p className="ai-error" role="alert">
                  {t('unlockOffline')}
                </p>
              )}
            </form>

            <p className="muted unlock-fine">
              {t('unlockKeep')}
              {isApple() && ` ${t('unlockApple')}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
