import { AlertCircle, CheckCircle2, Download, Files, FolderOpen, LoaderCircle, Play, Trash2, Upload, X } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import { markdownOutputName } from "../../shared/formats";
import { downloadMarkdown, formatSize } from "../app-utils";
import type { FileItem, FileSummary } from "../app-types";

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
  onConvertFiles,
  onDownloadAll,
  onResetOutputFolder,
  outputFolder,
  summary,
}: FilesModeProps) {
  return (
    <section ref={contentRef} className="files-layout mode-surface">
      <div className="glass-panel files-panel motion-card">
        <div className="panel-head">
          <h2>Selection</h2>
          <button className="icon-button" type="button" title="Clear" aria-label="Clear" onClick={onClearFiles} disabled={filesBusy || fileItems.length === 0}>
            <Trash2 size={16} />
          </button>
        </div>

        <input ref={fileInputRef} className="hidden-input" type="file" multiple accept={fileAccept} onChange={onBrowserFileInput} />

        <div className="drop-zone">
          <Upload size={28} />
          <div className="drop-copy">
            <strong>{summary.total} selected</strong>
            <span>
              {summary.done} done, {summary.failed} failed
            </span>
          </div>
        </div>

        {isDesktop ? (
          <div className="output-picker">
            <div className="output-copy">
              <strong>Output folder</strong>
              <span title={outputFolder || undefined}>{outputFolder || "Same folder as source"}</span>
            </div>
            <div className="compact-actions">
              <button className="icon-button" type="button" title="Choose output folder" aria-label="Choose output folder" onClick={onChooseOutputFolder} disabled={filesBusy}>
                <FolderOpen size={16} />
              </button>
              <button className="icon-button" type="button" title="Use source folders" aria-label="Use source folders" onClick={onResetOutputFolder} disabled={filesBusy || !outputFolder}>
                <X size={16} />
              </button>
            </div>
          </div>
        ) : null}

        <div className="action-row split-actions">
          <button className="secondary-button" type="button" onClick={onChooseFiles} disabled={filesBusy}>
            <Files size={16} />
            <span>Files</span>
          </button>
          {isDesktop ? (
            <button className="secondary-button" type="button" onClick={onChooseFolders} disabled={filesBusy}>
              <FolderOpen size={16} />
              <span>Folders</span>
            </button>
          ) : null}
          <button className="primary-button" type="button" onClick={onConvertFiles} disabled={filesBusy || fileItems.length === 0}>
            {filesBusy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
            <span>Convert</span>
          </button>
        </div>
      </div>

      <div className="glass-panel output-list-panel motion-card">
        <div className="panel-head output-list-head">
          <h2>Output</h2>
          {!isDesktop && summary.done > 1 ? (
            <button className="secondary-button compact-download" type="button" onClick={onDownloadAll} disabled={filesBusy}>
              <Download size={16} />
              <span>Download all</span>
            </button>
          ) : null}
        </div>
        <div className="file-list">
          {fileItems.length === 0 ? (
            <div className="empty-state">No files selected</div>
          ) : (
            fileItems.map((item) => <FileRow item={item} isDesktop={isDesktop} key={item.id} />)
          )}
        </div>
      </div>
    </section>
  );
}

function FileRow({ isDesktop, item }: { isDesktop: boolean; item: FileItem }) {
  return (
    <article className="file-row">
      <div className={`status-dot ${item.status}`}>
        {item.status === "done" ? <CheckCircle2 size={18} /> : item.status === "error" ? <AlertCircle size={18} /> : item.status === "running" ? <LoaderCircle size={18} className="spin" /> : <Files size={18} />}
      </div>
      <div className="file-main">
        <strong title={item.sourcePath || item.name}>{item.name}</strong>
        <span>{item.error || item.outputPath || item.outputName || formatSize(item.size)}</span>
      </div>
      {!isDesktop && item.status === "done" && item.markdown ? (
        <button className="icon-button" type="button" title="Download" aria-label={`Download ${item.name}`} onClick={() => downloadMarkdown(item.outputName || markdownOutputName(item.name), item.markdown || "")}>
          <Download size={16} />
        </button>
      ) : null}
    </article>
  );
}
