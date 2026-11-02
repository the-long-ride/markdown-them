import { AlertCircle, CheckCircle2, Download, FolderOpen, LoaderCircle, X } from 'lucide-react';
import { markdownOutputName } from '../../shared/formats';
import { desktopApi, resolveDesktopApi } from '../app-constants';
import type { FileItem } from '../app-types';
import { downloadMarkdown, formatSize } from '../app-utils';
import { useLanguage } from '../context/LanguageContext';
import { Tooltip } from './Tooltip';

export function getFileExtensionBadge(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    const ext = parts.pop()?.toUpperCase() || '';
    return ext.length > 4 ? ext.slice(0, 4) : ext;
  }
  return 'DOC';
}

export function FileRow({
  isDesktop,
  item,
  onRemove,
}: {
  isDesktop: boolean;
  item: FileItem;
  onRemove?: (id: string) => void;
}) {
  const { t } = useLanguage();
  const api = desktopApi || resolveDesktopApi();
  const isDone = item.status === 'done';
  const displayTitle = isDone ? item.outputName || markdownOutputName(item.name) : item.name;
  const extBadge = isDone ? 'MD' : getFileExtensionBadge(item.name);
  const fullPath = item.outputPath || item.sourcePath || item.name;
  const subInfo = item.error
    ? item.error
    : item.outputPath
      ? item.outputPath
      : item.outputName
        ? item.outputName
        : formatSize(item.size);

  const handleOpenPath = () => {
    const targetPath = item.outputPath;
    if (isDesktop && targetPath && api) {
      if (api.openPath) {
        api.openPath(targetPath).catch((err) => {
          console.warn('api.openPath failed, falling back to openExternal:', err);
          api.openExternal(targetPath).catch(() => undefined);
        });
      } else {
        api.openExternal(targetPath).catch(() => undefined);
      }
    }
  };

  return (
    <article className={`file-row file-row--${item.status}`}>
      <Tooltip content={fullPath}>
        <div className="file-info-area">
          <div className={`status-dot ${item.status}`}>
            {item.status === 'done' ? (
              <CheckCircle2 size={16} />
            ) : item.status === 'error' ? (
              <AlertCircle size={16} />
            ) : item.status === 'running' ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <span className="file-ext-glyph">{extBadge}</span>
            )}
          </div>

          <div className="file-main">
            <div className="file-title-line">
              <strong
                className={isDesktop && isDone && item.outputPath ? 'file-name-clickable' : ''}
                onClick={isDesktop && isDone && item.outputPath ? handleOpenPath : undefined}
              >
                {displayTitle}
              </strong>
              <span className="file-type-pill">{extBadge}</span>
            </div>
            <span className={`file-sub-info ${item.status === 'error' ? 'error-text' : ''}`}>
              {subInfo}
            </span>
          </div>
        </div>
      </Tooltip>

      <div className="file-row-actions">
        {isDesktop && isDone && item.outputPath ? (
          <Tooltip content={t('openOutputFolder')}>
            <button
              aria-label={t('openOutputFolder')}
              className="icon-button"
              onClick={handleOpenPath}
              type="button"
            >
              <FolderOpen size={15} />
            </button>
          </Tooltip>
        ) : null}

        {!isDesktop && isDone && typeof item.markdown === 'string' ? (
          <Tooltip content={t('download')}>
            <button
              aria-label={`${t('download')} ${item.name}`}
              className="icon-button download-row-btn"
              onClick={() =>
                downloadMarkdown(
                  item.outputName || markdownOutputName(item.name),
                  item.markdown || '',
                )
              }
              type="button"
            >
              <Download size={15} />
            </button>
          </Tooltip>
        ) : null}

        {item.status === 'queued' ? <span className="pending-status">{t('pending')}</span> : null}

        {item.status !== 'running' && onRemove ? (
          <Tooltip content={t('remove')}>
            <button
              aria-label={t('remove')}
              className="icon-button remove-row-btn"
              onClick={() => onRemove(item.id)}
              type="button"
            >
              <X size={14} />
            </button>
          </Tooltip>
        ) : null}
      </div>
    </article>
  );
}
