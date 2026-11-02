import { Files, FolderOpen, LoaderCircle, Play, Trash2, X } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';
import type { FileItem, FileSummary } from '../app-types';
import { useLanguage } from '../context/LanguageContext';
import { FilesDropZone } from './FilesDropZone';
import { FilesOutputPanel } from './FilesOutputPanel';
import { FilesSelectionPreview } from './FilesSelectionPreview';
import { Tooltip } from './Tooltip';

interface FilesModeProps {
  contentRef: RefObject<HTMLElement | null>;
  fileAccept: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  fileItems: FileItem[];
  filesBusy: boolean;
  isDesktop: boolean;
  onBrowserFileInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onChooseFiles: () => void;
  onChooseFolders: () => void;
  onChooseOutputFolder: () => void;
  onClearFiles: () => void;
  onRemoveFile?: (id: string) => void;
  onConvertFiles: () => void;
  onDownloadAll: () => void;
  onResetOutputFolder: () => void;
  outputFolder: string;
  summary: FileSummary;
}

export function FilesMode({
  contentRef,
  fileAccept,
  fileInputRef,
  fileItems,
  filesBusy,
  isDesktop,
  onBrowserFileInput,
  onChooseFiles,
  onChooseFolders,
  onChooseOutputFolder,
  onClearFiles,
  onRemoveFile,
  onConvertFiles,
  onDownloadAll,
  onResetOutputFolder,
  outputFolder,
  summary,
}: FilesModeProps) {
  const { t } = useLanguage();
  const hasConverted = Boolean(summary.done > 0 || summary.failed > 0 || filesBusy);
  const pendingCount = Math.max(0, summary.total - summary.done - summary.failed);

  return (
    <section
      ref={contentRef}
      className={`files-layout mode-surface ${hasConverted ? 'has-output' : ''}`}
    >
      <div className="glass-panel files-panel motion-card">
        <div className="panel-head">
          <div className="panel-title-group">
            <h2>01 // {t('selection')}</h2>
            {summary.total > 0 && <span className="panel-count-badge">{summary.total}</span>}
          </div>
          <Tooltip content={t('clear')}>
            <button
              aria-label={t('clear')}
              className="icon-button"
              disabled={filesBusy || fileItems.length === 0}
              onClick={onClearFiles}
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </Tooltip>
        </div>

        <input
          accept={fileAccept}
          className="hidden-input"
          multiple
          onChange={onBrowserFileInput}
          ref={fileInputRef}
          type="file"
        />

        <FilesDropZone
          fileItems={fileItems}
          onChooseFiles={onChooseFiles}
          pendingCount={pendingCount}
          summary={summary}
        />

        {fileItems.length > 0 && !hasConverted ? (
          <FilesSelectionPreview fileItems={fileItems} onRemoveFile={onRemoveFile} />
        ) : null}

        {isDesktop ? (
          <div
            className="output-picker"
            onClick={onChooseOutputFolder}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChooseOutputFolder();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="output-copy">
              <span className="output-picker-label">{t('outputFolder')}</span>
              <strong className="output-picker-path">{outputFolder || t('sameFolder')}</strong>
            </div>
            <div className="compact-actions" onClick={(e) => e.stopPropagation()}>
              <Tooltip content={t('chooseOutput')}>
                <button
                  aria-label={t('chooseOutput')}
                  className="icon-button"
                  disabled={filesBusy}
                  onClick={onChooseOutputFolder}
                  type="button"
                >
                  <FolderOpen size={16} />
                </button>
              </Tooltip>
              {outputFolder ? (
                <Tooltip content={t('useSourceFolders')}>
                  <button
                    aria-label={t('useSourceFolders')}
                    className="icon-button"
                    disabled={filesBusy}
                    onClick={onResetOutputFolder}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </Tooltip>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="action-row split-actions">
          <button
            className="secondary-button"
            disabled={filesBusy}
            onClick={onChooseFiles}
            type="button"
          >
            <Files size={16} />
            <span>{t('files')}</span>
          </button>
          {isDesktop ? (
            <button
              className="secondary-button"
              disabled={filesBusy}
              onClick={onChooseFolders}
              type="button"
            >
              <FolderOpen size={16} />
              <span>{t('folders')}</span>
            </button>
          ) : null}
          <button
            className={`primary-button ${fileItems.length > 0 && !filesBusy ? 'pulse-cta' : ''}`}
            disabled={filesBusy || fileItems.length === 0}
            onClick={onConvertFiles}
            type="button"
          >
            {filesBusy ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}
            <span>
              {t('convert')}
              {summary.total > 0 ? ` (${summary.total})` : ''}
            </span>
          </button>
        </div>
      </div>

      {hasConverted ? (
        <FilesOutputPanel
          filesBusy={filesBusy}
          fileItems={fileItems}
          isDesktop={isDesktop}
          onClearFiles={onClearFiles}
          onDownloadAll={onDownloadAll}
          onRemoveFile={onRemoveFile}
          summary={summary}
        />
      ) : null}
    </section>
  );
}
