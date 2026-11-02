import { X } from 'lucide-react';
import type { FileItem } from '../app-types';
import { formatSize } from '../app-utils';
import { useLanguage } from '../context/LanguageContext';
import { getFileExtensionBadge } from './FileRow';
import { Tooltip } from './Tooltip';

interface FilesSelectionPreviewProps {
  fileItems: FileItem[];
  onRemoveFile?: (id: string) => void;
}

export function FilesSelectionPreview({ fileItems, onRemoveFile }: FilesSelectionPreviewProps) {
  const { t } = useLanguage();

  return (
    <div className="selection-file-preview">
      <div className="selection-file-preview-head">
        <span className="preview-label">
          {fileItems.length} {t('selected')}
        </span>
      </div>
      <div className="selection-file-list">
        {fileItems.map((item) => (
          <div className="selection-file-item" key={item.id}>
            <div className="selection-file-info">
              <span className="file-type-pill">{getFileExtensionBadge(item.name)}</span>
              <strong className="selection-file-name" title={item.sourcePath || item.name}>
                {item.name}
              </strong>
              <span className="selection-file-size">{formatSize(item.size)}</span>
            </div>
            {onRemoveFile && (
              <Tooltip content={t('remove')}>
                <button
                  aria-label={`Remove ${item.name}`}
                  className="icon-button remove-row-btn"
                  onClick={() => onRemoveFile(item.id)}
                  type="button"
                >
                  <X size={14} />
                </button>
              </Tooltip>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
