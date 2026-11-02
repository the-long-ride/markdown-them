import { Check, Copy, Download, LoaderCircle, Play, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Tooltip } from './Tooltip';

interface TextModeProps {
  contentRef: RefObject<HTMLElement | null>;
  isDesktop: boolean;
  onClearInput: () => void;
  onClearOutput?: () => void;
  onConvertText: () => void;
  onCopyText: () => void;
  onSaveText: () => void;
  onTextInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onTextOutputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  textBusy: boolean;
  textInput: string;
  textOutput: string;
}

function getTextStats(text: string) {
  const trimmed = text.trim();
  return {
    chars: text.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: text ? text.split('\n').length : 0,
  };
}

export function TextMode({
  contentRef,
  isDesktop,
  onClearInput,
  onClearOutput,
  onConvertText,
  onCopyText,
  onSaveText,
  onTextInputChange,
  onTextOutputChange,
  textBusy,
  textInput,
  textOutput,
}: TextModeProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const hasOutput = Boolean(textOutput.trim() || textBusy);
  const inputStats = useMemo(() => getTextStats(textInput), [textInput]);
  const outputStats = useMemo(() => getTextStats(textOutput), [textOutput]);

  const handleCopy = () => {
    onCopyText();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (!textBusy && textInput.trim()) {
        event.preventDefault();
        onConvertText();
      }
    }
  };

  return (
    <section ref={contentRef} className={`tool-grid mode-surface ${hasOutput ? 'has-output' : ''}`}>
      <div className="glass-panel input-panel motion-card">
        <div className="panel-head">
          <div className="panel-title-group">
            <h2>01 // {t('input')}</h2>
            {inputStats.chars > 0 && (
              <span className="panel-count-badge">
                {inputStats.words.toLocaleString()} {t('words')}
              </span>
            )}
          </div>
          <Tooltip content={t('clear')}>
            <button
              aria-label={t('clear')}
              className="icon-button"
              disabled={!textInput}
              onClick={onClearInput}
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </Tooltip>
        </div>

        <textarea
          className="editor input-editor"
          onChange={onTextInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t('textInputPlaceholder')}
          spellCheck={false}
          value={textInput}
        />

        <div className="panel-footer">
          <div className="panel-stats">
            <span>
              {inputStats.chars.toLocaleString()} {t('chars')}
            </span>
            <span className="stat-sep">•</span>
            <span>
              {inputStats.lines.toLocaleString()} {t('lines')}
            </span>
          </div>
          <div className="panel-footer-actions">
            <span className="shortcut-hint">Ctrl+↵</span>
            <Tooltip content={t('convert')} shortcut="Ctrl+↵">
              <button
                className="primary-button compact-btn"
                disabled={textBusy || !textInput.trim()}
                onClick={onConvertText}
                type="button"
              >
                {textBusy ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />}
                <span>{t('convert')}</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {hasOutput ? (
        <div className="glass-panel output-panel motion-card">
          <div className="panel-head">
            <div className="panel-title-group">
              <h2>02 // {t('markdown')}</h2>
              {outputStats.chars > 0 && (
                <span className="panel-count-badge">
                  {outputStats.words.toLocaleString()} {t('words')}
                </span>
              )}
            </div>
            <div className="compact-actions">
              <Tooltip content={copied ? t('copiedNotice') : t('copy')}>
                <button
                  aria-label={t('copy')}
                  className="icon-button"
                  disabled={!textOutput}
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </Tooltip>
              <Tooltip content={isDesktop ? t('save') : t('download')}>
                <button
                  aria-label={isDesktop ? t('save') : t('download')}
                  className="icon-button"
                  disabled={!textOutput}
                  onClick={onSaveText}
                  type="button"
                >
                  {isDesktop ? <Save size={16} /> : <Download size={16} />}
                </button>
              </Tooltip>
              {onClearOutput && (
                <Tooltip content={t('clear')}>
                  <button
                    aria-label={t('clear')}
                    className="icon-button"
                    onClick={onClearOutput}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          <textarea
            className="editor output-editor"
            onChange={onTextOutputChange}
            placeholder={t('textOutputPlaceholder')}
            spellCheck={false}
            value={textOutput}
          />

          <div className="panel-footer">
            <div className="panel-stats">
              <span>
                {outputStats.chars.toLocaleString()} {t('chars')}
              </span>
              <span className="stat-sep">•</span>
              <span>
                {outputStats.lines.toLocaleString()} {t('lines')}
              </span>
            </div>
            <div className="panel-footer-actions">
              <button
                className="secondary-button compact-btn"
                disabled={!textOutput}
                onClick={handleCopy}
                type="button"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? t('copiedNotice') || 'Copied' : t('copy')}</span>
              </button>
              <button
                className="secondary-button compact-btn"
                disabled={!textOutput}
                onClick={onSaveText}
                type="button"
              >
                {isDesktop ? <Save size={14} /> : <Download size={14} />}
                <span>{isDesktop ? t('save') : t('download')}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
