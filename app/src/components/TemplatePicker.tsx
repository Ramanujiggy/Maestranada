// "New class" sheet: start blank or from one of the ready-made classes.

import { useEffect } from 'react';
import { FilePlus2, X } from 'lucide-react';
import { templates, type Template } from '../lib/samples.ts';
import { t } from '../lib/i18n.ts';

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
        aria-label={t('newClass')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <div>
            <div className="eyebrow-strong">{t('newClass')}</div>
            <h2 className="card-title" style={{ marginTop: 6 }}>
              {t('howStart')}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <button type="button" className="template blank" onClick={onBlank} autoFocus>
          <FilePlus2 size={22} color="var(--ink)" />
          <span>
            <span className="template-title">{t('blankClass')}</span>
            <span className="template-blurb">{t('blankClassBlurb')}</span>
          </span>
        </button>

        <div className="eyebrow" style={{ margin: '20px 0 10px' }}>
          {t('orExample')}
        </div>
        <div className="template-grid">
          {templates().map((tpl) => (
            <button type="button" key={tpl.key} className="template" onClick={() => onTemplate(tpl)}>
              <span>
                <span className="pill" style={{ marginBottom: 8 }}>
                  {t(`level.${tpl.level}`)}
                </span>
                <span className="template-title serif">{tpl.title}</span>
                <span className="template-blurb">{tpl.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
