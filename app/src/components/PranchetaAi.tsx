// "Prancheta AI" sheet: a chat inside the app that asks the coach about the
// class they have in mind and lays it out in the format. Without a
// subscription on this phone it offers one, or the email code that brings an
// existing one over. Once the AI hands back a class, it opens in the editor
// like any other, ready for clips.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Mail, RotateCcw, Send, X } from 'lucide-react';
import { readAiReply } from '../lib/aiClass.ts';
import {
  aiStatus,
  chat,
  getAiKey,
  joinWith,
  replyText,
  saveChat,
  savedChat,
  sendCode,
  verifyCode,
  type AiInfo,
  type ChatError,
  type ChatMessage,
  type KeyResult,
} from '../lib/aiService.ts';
import type { ClassPlan } from '../lib/plan.ts';
import { t, type Key } from '../lib/i18n.ts';

const CHAT_ERRORS: Record<ChatError, Key> = {
  offline: 'paiOffline',
  badKey: 'paiErrNotActive',
  notActive: 'paiErrNotActive',
  limit: 'paiErrLimit',
  busy: 'paiErrBusy',
  noAnswer: 'paiErrNoAnswer',
  failed: 'paiErrFailed',
};

export function PranchetaAi({
  info,
  checkout,
  onBack,
  onClose,
  onPlan,
}: {
  info: AiInfo | null;
  /** The checkout id Stripe sent a new subscriber back with, swapped for a key as the sheet opens. */
  checkout?: string;
  onBack?: () => void;
  onClose: () => void;
  onPlan: (plan: ClassPlan, skipped: number) => void;
}) {
  const [hasKey, setHasKey] = useState(() => !!getAiKey());
  const [joining, setJoining] = useState<'checking' | KeyResult | null>(checkout ? 'checking' : null);
  const lost = useCallback(() => setHasKey(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const started = useRef(false);
  useEffect(() => {
    if (!checkout || started.current) return;
    started.current = true;
    void joinWith(checkout).then((r) => {
      setJoining(r);
      if (r === 'ok') setHasKey(true);
    });
  }, [checkout]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="card sheet ai-sheet pai-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('paiTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div>
            {onBack && (
              <button type="button" className="link ai-back" onClick={onBack}>
                <ArrowLeft size={14} /> {t('newClass')}
              </button>
            )}
            <h2 className="card-title" style={{ marginTop: onBack ? 6 : 0 }}>
              {t('paiTitle')}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {joining === 'checking' ? (
          <p className="muted" role="status">
            {t('paiJoining')}
          </p>
        ) : hasKey ? (
          <Chat info={info} onPlan={onPlan} onLost={lost} />
        ) : (
          <Join info={info} joinFailed={joining === 'bad' || joining === 'offline' ? joining : null} onKey={() => setHasKey(true)} />
        )}
      </div>
    </div>
  );
}

function Join({ info, joinFailed, onKey }: { info: AiInfo | null; joinFailed: 'bad' | 'offline' | null; onKey: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'offline' | 'bad' | 'tooMany'>('idle');

  const send = async () => {
    if (!email.trim() || state === 'busy') return;
    setState('busy');
    const r = await sendCode(email.trim());
    setState(r === 'ok' ? 'idle' : 'offline');
    if (r === 'ok') setSent(true);
  };
  const verify = async () => {
    if (code.replace(/\D/g, '').length !== 6 || state === 'busy') return;
    setState('busy');
    const r = await verifyCode(email.trim(), code);
    if (r === 'ok') return onKey();
    setState(r);
  };

  return (
    <>
      {joinFailed && (
        <p className="ai-error" role="alert">
          {t(joinFailed === 'bad' ? 'paiJoinBad' : 'paiOffline')}
        </p>
      )}
      <p className="muted" style={{ margin: '6px 0 16px' }}>
        {t('paiLead')}
      </p>
      {info?.checkout ? (
        <a className="btn btn-primary btn-lg unlock-buy" href={info.checkout}>
          {t('paiSubscribe')}
        </a>
      ) : (
        <p className="muted unlock-buy-off">{t(info ? 'paiNotReady' : 'paiOffline')}</p>
      )}

      <form
        className="unlock-key"
        onSubmit={(e) => {
          e.preventDefault();
          void (sent ? verify() : send());
        }}
      >
        <label htmlFor="pai-email">
          <Mail size={15} /> {t('paiHave')}
        </label>
        <div className="unlock-row">
          <input
            id="pai-email"
            className="input"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSent(false);
              setState('idle');
            }}
            placeholder={t('paiEmailPh')}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
          {!sent && (
            <button type="submit" className="btn btn-secondary" disabled={!email.trim() || state === 'busy'}>
              {t('paiSendCode')}
            </button>
          )}
        </div>
        {sent && (
          <>
            <p className="muted" style={{ margin: '8px 0' }} role="status">
              {t('paiCodeSent')}
            </p>
            <div className="unlock-row">
              <input
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setState('idle');
                }}
                placeholder={t('paiCodePh')}
                aria-label={t('paiCodePh')}
              />
              <button type="submit" className="btn btn-primary" disabled={code.replace(/\D/g, '').length !== 6 || state === 'busy'}>
                {t('paiVerify')}
              </button>
            </div>
          </>
        )}
        {(state === 'bad' || state === 'tooMany' || state === 'offline') && (
          <p className="ai-error" role="alert">
            {t(state === 'bad' ? 'paiCodeBad' : state === 'tooMany' ? 'paiTooMany' : 'paiOffline')}
          </p>
        )}
      </form>
    </>
  );
}

function Chat({ info, onPlan, onLost }: { info: AiInfo | null; onPlan: (plan: ClassPlan, skipped: number) => void; onLost: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(savedChat);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [cutOff, setCutOff] = useState(false);
  const [used, setUsed] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void aiStatus().then((s) => {
      if ('used' in s) setUsed(s.used);
      else if (s.error === 'badKey') onLost();
      else if (s.error !== 'offline') setError(s.error);
    });
  }, [onLost]);

  useEffect(() => saveChat(messages), [messages]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(next);
    setDraft('');
    setError(null);
    setCutOff(false);
    setBusy(true);
    const r = await chat(next);
    setBusy(false);
    if (r.used !== undefined) setUsed(r.used);
    if ('error' in r) {
      setError(r.error);
      // Put the message back in the box, so it can be sent again as it is.
      setMessages(messages);
      setDraft(text);
      if (r.error === 'badKey') onLost();
      return;
    }
    setCutOff(r.cutOff);
    setMessages([...next, { role: 'assistant', text: r.reply }]);
  };

  const restart = () => {
    setMessages([]);
    setError(null);
    setCutOff(false);
    inputRef.current?.focus();
  };

  // The newest class in the chat: once the AI gives one, it's ready to open.
  let ready: { plan: ClassPlan; skipped: number } | null = null;
  for (let i = messages.length - 1; i >= 0 && !ready; i--) {
    if (messages[i].role !== 'assistant') continue;
    const r = readAiReply(messages[i].text);
    if (!('error' in r)) ready = r;
  }

  return (
    <>
      <div className="pai-chat" aria-live="polite">
        <p className="pai-msg assistant">{t('paiFirst')}</p>
        {messages.map((m, i) => {
          const words = m.role === 'assistant' ? replyText(m.text) : m.text;
          const isClass = m.role === 'assistant' && !('error' in readAiReply(m.text));
          return (
            <div key={i} className={`pai-msg ${m.role}`}>
              {words && <p>{words}</p>}
              {isClass && (
                <p className="pai-class">
                  <Check size={15} /> {t('paiClassReady')}
                </p>
              )}
            </div>
          );
        })}
        {busy && (
          <p className="pai-msg assistant pai-busy" role="status">
            {t('paiThinking')}
            <span aria-hidden>…</span>
          </p>
        )}
        <div ref={endRef} />
      </div>

      {ready && !busy && (
        <button type="button" className="btn btn-primary btn-lg pai-open" onClick={() => onPlan(ready.plan, ready.skipped)}>
          {t('paiOpenClass')}
        </button>
      )}
      {error && (
        <p className="ai-error" role="alert">
          {t(CHAT_ERRORS[error])}
        </p>
      )}
      {cutOff && !ready && (
        <p className="ai-error" role="alert">
          {t('paiCutOff')}
        </p>
      )}

      <form
        className="pai-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          ref={inputRef}
          className="textarea"
          rows={3}
          value={draft}
          placeholder={t('paiPh')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a keyboard; on a phone the return key makes a new line.
            if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover: hover)').matches) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim() || busy} aria-label={t('paiSend')}>
          <Send size={16} /> {t('paiSend')}
        </button>
      </form>

      <div className="pai-foot">
        {used !== null && (
          <span className="pai-meter" title={t('paiUsed', { n: Math.round(used * 100) })}>
            <span className="pai-meter-bar" aria-hidden>
              <span style={{ width: `${Math.round(used * 100)}%` }} />
            </span>
            {t('paiUsed', { n: Math.round(used * 100) })}
          </span>
        )}
        {messages.length > 0 && (
          <button type="button" className="link" onClick={restart}>
            <RotateCcw size={13} /> {t('paiNewChat')}
          </button>
        )}
        {info?.portal && (
          <a className="link" href={info.portal} target="_blank" rel="noreferrer">
            {t('paiManage')}
          </a>
        )}
      </div>
    </>
  );
}
