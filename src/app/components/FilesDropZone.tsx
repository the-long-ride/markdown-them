import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { FileItem, FileSummary } from '../app-types';
import { useLanguage } from '../context/LanguageContext';

const SUPPORTED_PILLS = [
  'DOCX',
  'DOC',
  'PDF',
  'HTML',
  'XLSX',
  'XLS',
  'XLM',
  'PPTX',
  'ODT',
  'ODP',
  'ODS',
  'RTF',
  'TXT',
  'MD',
];

interface FilesDropZoneProps {
  fileItems: FileItem[];
  onChooseFiles: () => void;
  pendingCount: number;
  summary: FileSummary;
}

export function FilesDropZone({
  fileItems,
  onChooseFiles,
  pendingCount,
  summary,
}: FilesDropZoneProps) {
  const { t } = useLanguage();

  function handleDropZoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChooseFiles();
    }
  }

  return (
    <div
      aria-label={t('dropTitle')}
      className={`drop-zone ${fileItems.length > 0 ? 'has-files' : ''}`}
      onClick={onChooseFiles}
      onKeyDown={handleDropZoneKeyDown}
      role="button"
      tabIndex={0}
    >
      {fileItems.length === 0 ? (
        <div className="drop-empty-content">
          <div aria-hidden="true" className="drop-icon-wrapper">
            <Upload size={26} />
          </div>
          <div className="drop-copy">
            <strong>{t('dropTitle')}</strong>
            <span className="drop-subtitle">{t('dropSubtitle')}</span>
          </div>
          <div className="drop-pill-row" aria-hidden="true">
            {SUPPORTED_PILLS.map((pill) => (
              <span className="format-pill" key={pill}>
                {pill}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="drop-active-content">
          <div className="drop-active-summary">
            <strong>
              {summary.total} {t('selected')}
            </strong>
            <div className="drop-status-chips">
              {summary.done > 0 && (
                <span className="status-chip chip-done">
                  <CheckCircle2 size={12} /> {summary.done} {t('done')}
                </span>
              )}
              {summary.failed > 0 && (
                <span className="status-chip chip-failed">
                  <AlertCircle size={12} /> {summary.failed} {t('failed')}
                </span>
              )}
              {pendingCount > 0 && (
                <span className="status-chip chip-pending">
                  {pendingCount} {t('pending')}
                </span>
              )}
            </div>
          </div>
          <span className="drop-add-hint">+ {t('dropSubtitle')}</span>
        </div>
      )}
    </div>
  );
}
