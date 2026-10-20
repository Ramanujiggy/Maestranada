// "New class" sheet: start blank or from one of the ready-made classes.

import { useEffect } from 'react';
import { FilePlus2, X } from 'lucide-react';
import { TEMPLATES, type Template } from '../lib/samples.ts';

export function TemplatePicker({
  onBlank,
  onTemplate,
  onClose,
}: {
  onBlank: () => void;
  onTemplate: (t: Template) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="card sheet"
        role="dialog"
        aria-modal="true"
        aria-label="New class"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div>
            <div className="eyebrow-strong">
              New class
            </div>
            <h2 className="card-title" style={{ marginTop: 6 }}>
              How do you want to start?
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <button type="button" className="template blank" onClick={onBlank} autoFocus>
          <FilePlus2 size={22} color="var(--ink)" />
          <span>
            <span className="template-title">Blank class</span>
            <span className="template-blurb">The five blocks, ready for your own plan.</span>
          </span>
        </button>

        <div className="eyebrow" style={{ margin: '20px 0 10px' }}>
          Or start from an example
        </div>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button type="button" key={t.key} className="template" onClick={() => onTemplate(t)}>
              <span>
                <span className="pill" style={{ marginBottom: 8 }}>
                  {t.level}
                </span>
                <span className="template-title serif">{t.title}</span>
                <span className="template-blurb">{t.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
