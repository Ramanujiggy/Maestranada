// "Plan with AI" sheet. Two steps: copy a prompt with the class format and
// the coach's idea into any AI chat, then paste the reply back. The class
// opens in the editor like any other, ready for clips and sending.

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ClipboardPaste, Copy, ExternalLink, X } from 'lucide-react';
import { AI_CHATS, aiPrompt, readAiReply, type ReadError } from '../lib/aiClass.ts';
import type { ClassPlan } from '../lib/plan.ts';
import { t, type Key } from '../lib/i18n.ts';

const IDEA_KEY = 'maestranada.aiIdea';

const ERRORS: Record<ReadError, Key> = {
  empty: 'aiErrEmpty',
  noJson: 'aiErrNoJson',
  cutOff: 'aiErrCutOff',
  badJson: 'aiErrBadJson',
  noBlocks: 'aiErrNoBlocks',
};

function readIdea(): string {
  try {
    return localStorage.getItem(IDEA_KEY) ?? '';
  } catch {
    return '';
  }
}

function keepIdea(idea: string): void {
  try {
    if (idea.trim()) localStorage.setItem(IDEA_KEY, idea);
    else localStorage.removeItem(IDEA_KEY);
  } catch {
    // Private mode: the idea lasts while the sheet is open.
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some in-app web views: copy through a hidden field.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function AiPlanner({
  onBack,
  onClose,
  onPlan,
}: {
  onBack: () => void;
  onClose: () => void;
  onPlan: (plan: ClassPlan, skipped: number) => void;
}) {
  const [idea, setIdea] = useState(readIdea);
  const [reply, setReply] = useState('');
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  const [error, setError] = useState<ReadError | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => keepIdea(idea), [idea]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2400);
    return () => clearTimeout(timer);
  }, [copied]);

  const prompt = aiPrompt(idea);
  const copy = async () => setCopied((await copyText(prompt)) ? 'ok' : 'failed');

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setReply(text);
        setError(null);
      }
    } catch {
      // Permission refused: the coach pastes into the box by hand.
    }
  };

  const build = () => {
    const result = readAiReply(reply);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    keepIdea('');
    onPlan(result.plan, result.skipped);
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="card sheet ai-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('aiTitle')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div>
            <button type="button" className="link ai-back" onClick={onBack}>
              <ArrowLeft size={14} /> {t('newClass')}
            </button>
            <h2 className="card-title" style={{ marginTop: 6 }}>
              {t('aiTitle')}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="section-hint" style={{ margin: '4px 0 0' }}>
          {t('aiLead')}
        </p>

        <ol className="ai-steps">
          <li>
            <span className="ai-step-n">1</span>
            <div className="ai-step-body">
              <label className="field">
                <span className="field-label">{t('aiIdeaLabel')}</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={idea}
                  placeholder={t('aiIdeaPlaceholder')}
                  onChange={(e) => setIdea(e.target.value)}
                />
              </label>
              <div className="ai-actions">
                <button type="button" className="btn btn-primary" onClick={() => void copy()}>
                  {copied === 'ok' ? <Check size={16} /> : <Copy size={16} />}{' '}
                  {copied === 'ok' ? t('aiCopied') : t('aiCopyPrompt')}
                </button>
                {AI_CHATS.map((chat) => (
                  <a
                    key={chat.name}
                    className="btn btn-secondary"
                    href={chat.url(prompt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void copyText(prompt)}
                  >
                    {t('aiOpenIn', { name: chat.name })} <ExternalLink size={14} />
                  </a>
                ))}
              </div>
              <p className="section-hint" style={{ margin: 0 }} role={copied === 'failed' ? 'alert' : undefined}>
                {copied === 'failed' ? t('aiCopyFailed') : t('aiAnyChat')}
              </p>
              {copied === 'failed' && <textarea className="textarea ai-prompt" readOnly value={prompt} onFocus={(e) => e.target.select()} />}
            </div>
          </li>
          <li>
            <span className="ai-step-n">2</span>
            <div className="ai-step-body">
              <label className="field">
                <span className="field-label">{t('aiReplyLabel')}</span>
                <textarea
                  className="textarea ai-reply"
                  rows={5}
                  value={reply}
                  placeholder={t('aiReplyPlaceholder')}
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => {
                    setReply(e.target.value);
                    setError(null);
                  }}
                />
              </label>
              {error && (
                <p className="ai-error" role="alert">
                  {t(ERRORS[error])}
                </p>
              )}
              <div className="ai-actions">
                <button type="button" className="btn btn-primary" onClick={build} disabled={!reply.trim()}>
                  {t('aiBuild')}
                </button>
                {'clipboard' in navigator && 'readText' in navigator.clipboard && (
                  <button type="button" className="btn btn-ghost" onClick={() => void pasteFromClipboard()}>
                    <ClipboardPaste size={16} /> {t('aiPaste')}
                  </button>
                )}
              </div>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
