import { Download, Trash2 } from 'lucide-react';
import type { FileItem, FileSummary } from '../app-types';
import { useLanguage } from '../context/LanguageContext';
import { FileRow } from './FileRow';
import { Tooltip } from './Tooltip';

interface FilesOutputPanelProps {
  filesBusy: boolean;
  fileItems: FileItem[];
  isDesktop: boolean;
  onClearFiles: () => void;
  onDownloadAll: () => void;
  onRemoveFile?: (id: string) => void;
  summary: FileSummary;
}

export function FilesOutputPanel({
  filesBusy,
  fileItems,
  isDesktop,
  onClearFiles,
  onDownloadAll,
  onRemoveFile,
  summary,
}: FilesOutputPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="glass-panel output-list-panel motion-card">
      <div className="panel-head output-list-head">
        <div className="panel-title-group">
          <h2>02 // {t('output')}</h2>
          {summary.total > 0 && (
            <span className="panel-count-badge">
              {summary.done}/{summary.total}
            </span>
          )}
        </div>
        <div className="compact-actions">
          {!isDesktop && summary.done > 0 ? (
            <button
              className="secondary-button compact-download"
              disabled={filesBusy}
              onClick={onDownloadAll}
              type="button"
            >
              <Download size={15} />
              <span>{t('downloadAll')}</span>
            </button>
          ) : null}
          <Tooltip content={t('clear')}>
            <button
              aria-label={t('clear')}
              className="icon-button"
              disabled={filesBusy}
              onClick={onClearFiles}
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="file-list">
        {fileItems.map((item) => (
          <FileRow isDesktop={isDesktop} item={item} key={item.id} onRemove={onRemoveFile} />
        ))}
      </div>
    </div>
  );
}
