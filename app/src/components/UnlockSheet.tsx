// The unlock: pay once through Stripe's buy button, whose payment link sends the coach
// back here, and this copy of the app makes classes without limit. Another
// copy (the Home Screen app, a new phone) unlocks with the email they paid
// with. It opens by itself when a new class would go past the free ones, when
// the coach comes back from paying, and from the note on the class list.

import { useEffect, useRef, useState } from 'react';
import { Check, Mail, X } from 'lucide-react';
import { BUY_BUTTON, FREE_CLASSES, unlockWith, useUnlocked, type PurchaseCheck } from '../lib/access.ts';
import { isApple } from '../lib/pwa.ts';
import { BuyButton } from './BuyButton.tsx';
import { t } from '../lib/i18n.ts';

export function UnlockSheet({
  limitHit,
  session,
  onClose,
}: {
  limitHit: boolean;
  /** The checkout id Stripe sent the coach back with, checked as soon as the sheet opens. */
  session?: string;
  onClose: () => void;
}) {
  const unlocked = useUnlocked();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | PurchaseCheck>(session ? 'checking' : 'idle');
  // Which question the last answer was to: the payment just made, or an email.
  const [asked, setAsked] = useState<'session' | 'email'>(session ? 'session' : 'email');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const checkSession = async () => {
    if (!session) return;
    setAsked('session');
    setState('checking');
    setState(await unlockWith({ session }));
  };
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void checkSession();
    // Only the first open checks by itself; Try again checks again.
  }, []);

  const submit = async () => {
    const address = email.trim();
    if (!address || state === 'checking') return;
    setAsked('email');
    setState('checking');
    setState(await unlockWith({ email: address }));
  };

  const title = unlocked
    ? t('unlockedTitle')
    : session && asked === 'session' && state === 'checking'
      ? t('unlockConfirming')
      : limitHit
        ? t('freeUsedTitle', { total: FREE_CLASSES })
        : t('unlockTitle');

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
            {isApple() && <p className="muted unlock-fine">{t('unlockApple')}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
                {t('done')}
              </button>
            </div>
          </>
        ) : (
          <>
            {asked === 'session' && state !== 'idle' ? (
              <p className={state === 'checking' ? 'muted' : 'ai-error'} role={state === 'checking' ? 'status' : 'alert'} style={{ margin: '6px 0 16px' }}>
                {state === 'checking' ? t('unlockConfirmingBody') : state === 'bad' ? t('unlockPaidBad') : t('unlockOffline')}
                {state === 'offline' && (
                  <>
                    {' '}
                    <button type="button" className="link" onClick={() => void checkSession()}>
                      {t('tryAgain')}
                    </button>
                  </>
                )}
              </p>
            ) : (
              <p className="muted" style={{ margin: '6px 0 16px' }}>
                {t('unlockLead')}
              </p>
            )}

            {BUY_BUTTON.id && !session && <BuyButton />}

            <form
              className="unlock-key"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label htmlFor="unlock-email">
                <Mail size={15} /> {t('unlockHaveBought')}
              </label>
              <div className="unlock-row">
                <input
                  id="unlock-email"
                  className="input"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state !== 'checking' && asked === 'email') setState('idle');
                  }}
                  placeholder={t('unlockEmailPh')}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  className={BUY_BUTTON.id && !session ? 'btn btn-secondary' : 'btn btn-primary'}
                  disabled={!email.trim() || state === 'checking'}
                >
                  {state === 'checking' && asked === 'email' ? t('unlockChecking') : t('unlockButton')}
                </button>
              </div>
              {asked === 'email' && state === 'bad' && (
                <p className="ai-error" role="alert">
                  {t('unlockBad')}
                </p>
              )}
              {asked === 'email' && state === 'offline' && (
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
