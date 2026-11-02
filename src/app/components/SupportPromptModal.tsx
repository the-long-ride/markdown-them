import { Check, Heart, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getSupportPromptTranslations } from '../context/supportPromptTranslations';

export interface SupportPromptModalProps {
  isOpen: boolean;
  onClose: (neverShowAgain: boolean) => void;
  onStar: (neverShowAgain: boolean) => void;
  onDonate: (neverShowAgain: boolean) => void;
}

export function SupportPromptModal({ isOpen, onClose, onStar, onDonate }: SupportPromptModalProps) {
  const { language } = useLanguage();
  const [neverShowAgain, setNeverShowAgain] = useState(false);

  const t = getSupportPromptTranslations(language);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(neverShowAgain);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, neverShowAgain, onClose]);

  if (!isOpen) return null;

  return (
    <div
      aria-labelledby="support-prompt-title"
      aria-modal="true"
      className="support-prompt-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose(neverShowAgain);
        }
      }}
      role="dialog"
    >
      <div className="support-prompt-card">
        <button
          aria-label={t.close}
          className="support-prompt-card__close"
          onClick={() => onClose(neverShowAgain)}
          type="button"
        >
          <X size={18} />
        </button>

        <div className="support-prompt-card__header">
          <div aria-hidden="true" className="support-prompt-card__icon">
            <Heart size={22} fill="currentColor" />
          </div>
          <h2 className="support-prompt-card__title" id="support-prompt-title">
            {t.title}
          </h2>
          <p className="support-prompt-card__message">{t.message}</p>
        </div>

        <div className="support-prompt-card__options">
          <section
            aria-labelledby="support-prompt-star-title"
            className="support-prompt-option support-prompt-option--star"
          >
            <div aria-hidden="true" className="support-prompt-option__icon">
              <Star size={16} fill="currentColor" />
            </div>
            <h3 className="support-prompt-option__title" id="support-prompt-star-title">
              {t.starTitle}
            </h3>
            <p className="support-prompt-option__desc">{t.starDesc}</p>
            <button
              className="support-prompt-card__star-btn"
              onClick={() => onStar(neverShowAgain)}
              type="button"
            >
              <Star size={14} fill="currentColor" />
              <span>{t.starButton}</span>
            </button>
          </section>

          <section
            aria-labelledby="support-prompt-donate-title"
            className="support-prompt-option support-prompt-option--donate"
          >
            <div aria-hidden="true" className="support-prompt-option__icon">
              <Heart size={16} fill="currentColor" />
            </div>
            <h3 className="support-prompt-option__title" id="support-prompt-donate-title">
              {t.donateTitle}
            </h3>
            <p className="support-prompt-option__desc">{t.donateDesc}</p>
            <button
              className="support-prompt-card__donate-btn"
              onClick={() => onDonate(neverShowAgain)}
              type="button"
            >
              <Heart size={14} fill="currentColor" />
              <span>{t.donateButton}</span>
            </button>
          </section>
        </div>

        <p className="support-prompt-card__thanks">{t.thanks}</p>

        <div className="support-prompt-card__actions">
          <label className="support-prompt-card__checkbox-label">
            <input
              checked={neverShowAgain}
              className="support-prompt-card__checkbox"
              onChange={(e) => setNeverShowAgain(e.target.checked)}
              type="checkbox"
            />
            <span aria-hidden="true" className="support-prompt-card__checkbox-custom">
              {neverShowAgain ? <Check size={14} strokeWidth={3} /> : null}
            </span>
            <span className="support-prompt-card__checkbox-text">{t.dontShowAgain}</span>
          </label>

          <button
            className="support-prompt-card__later-btn"
            onClick={() => onClose(neverShowAgain)}
            type="button"
          >
            {t.maybeLater}
          </button>
        </div>
      </div>
    </div>
  );
}
