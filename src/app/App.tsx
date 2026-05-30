import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  CloudOff,
  Copy,
  Download,
  Files,
  FolderOpen,
  LoaderCircle,
  Maximize2,
  Minus,
  MonitorCheck,
  Play,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";
import { BrowserConversionResult, convertBrowserFile, convertTextToMarkdown } from "./browser-converter";
import type { DesktopFileEntry } from "./desktop-api";
import { markdownOutputName, SUPPORTED_FILE_EXTENSIONS } from "../shared/formats";

type Mode = "text" | "files";
type FileStatus = "queued" | "running" | "done" | "error";

interface FileItem {
  id: string;
  name: string;
  size?: number;
  sourcePath?: string;
  file?: File;
  status: FileStatus;
  markdown?: string;
  outputName?: string;
  outputPath?: string;
  error?: string;
}

const desktopApi = window.markdownThemDesktop;
const fileAccept = [...SUPPORTED_FILE_EXTENSIONS, ".md", ".markdown", ".txt"].join(",");
const profileUrl = "https://github.com/the-long-ride";
const repoUrl = "https://github.com/the-long-ride/vscode-extension-markdown-them";
const variantsUrl = `${repoUrl}#markdown-them-variants`;
const licenseUrl = "https://github.com/the-long-ride/vscode-extension-markdown-them/blob/main/LICENSE";

gsap.registerPlugin(useGSAP);

export function App() {
  const [mode, setMode] = useState<Mode>("files");
  const [textInput, setTextInput] = useState("");
  const [textOutput, setTextOutput] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [outputFolder, setOutputFolder] = useState("");
  const [filesBusy, setFilesBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const modeAnimationReadyRef = useRef(false);
  const isDesktop = Boolean(desktopApi);

  const summary = useMemo(() => {
    const done = fileItems.filter((item) => item.status === "done").length;
    const failed = fileItems.filter((item) => item.status === "error").length;
    return { done, failed, total: fileItems.length };
  }, [fileItems]);

  useGSAP(
    () => {
      if (shouldReduceMotion()) {
        return;
      }

      gsap.set(".motion-card, .trust-badge, .brand-lockup, .segmented", { willChange: "transform, opacity" });

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .from(".brand-lockup", { autoAlpha: 0, y: 14, duration: 0.46 })
        .from(".segmented", { autoAlpha: 0, y: -10, duration: 0.38 }, "<0.08")
        .from(".trust-badge", { autoAlpha: 0, y: 14, scale: 0.985, stagger: 0.065, duration: 0.44 }, "<0.06")
        .from(".motion-card", { autoAlpha: 0, y: 18, scale: 0.992, stagger: 0.075, duration: 0.48 }, "<0.1")
        .set(".motion-card, .trust-badge, .brand-lockup, .segmented", { clearProps: "willChange" });
    },
    { scope: workspaceRef },
  );

  useGSAP(
    () => {
      if (!modeAnimationReadyRef.current) {
        modeAnimationReadyRef.current = true;
        return;
      }

      if (!contentRef.current || shouldReduceMotion()) {
        return;
      }

      gsap.fromTo(
        contentRef.current,
        { autoAlpha: 0, y: 12, scale: 0.996 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: "power2.out", clearProps: "transform,opacity,visibility" },
      );
    },
    { dependencies: [mode], revertOnUpdate: true, scope: workspaceRef },
  );

  async function handleConvertText() {
    setTextBusy(true);
    setNotice("");

    try {
      const markdown = desktopApi ? await desktopApi.convertText(textInput) : convertTextToMarkdown(textInput);
      setTextOutput(markdown);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setTextBusy(false);
    }
  }

  async function handleCopyText() {
    if (!textOutput) {
      return;
    }

    await copyToClipboard(textOutput);
    setNotice("Copied");
  }

  async function handleSaveText() {
    if (!textOutput) {
      return;
    }

    if (desktopApi) {
      const result = await desktopApi.saveMarkdown("input.md", textOutput);
      if (!result.canceled && result.filePath) {
        setNotice(`Saved ${result.filePath}`);
      }
      return;
    }

    downloadMarkdown("input.md", textOutput);
  }

  async function handleChooseFiles() {
    setNotice("");

    if (desktopApi) {
      const entries = await desktopApi.chooseFiles();
      addDesktopEntries(entries);
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleChooseFolders() {
    if (!desktopApi) {
      return;
    }

    setNotice("");
    const entries = await desktopApi.chooseFolders();
    addDesktopEntries(entries);
  }

  async function handleChooseOutputFolder() {
    if (!desktopApi) {
      return;
    }

    const folderPath = await desktopApi.chooseOutputFolder();
    if (folderPath) {
      setOutputFolder(folderPath);
    }
  }

  function handleBrowserFileInput(event: ChangeEvent<HTMLInputElement>) {
    addBrowserFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!desktopApi) {
      addBrowserFiles(Array.from(event.dataTransfer.files || []));
    }
  }

  async function handleConvertFiles() {
    const queued = fileItems.filter((item) => item.status !== "running");
    if (queued.length === 0) {
      return;
    }

    setFilesBusy(true);
    setNotice("");
    setFileItems((items) => items.map((item) => ({ ...item, status: "queued", error: undefined })));

    try {
      if (desktopApi) {
        setFileItems((items) => items.map((item) => ({ ...item, status: "running" })));
        const results = await desktopApi.convertFiles(
          fileItems.map((item) => item.sourcePath).filter(Boolean) as string[],
          outputFolder || undefined,
        );
        setFileItems((items) =>
          items.map((item) => {
            const result = results.find((entry) => entry.sourcePath === item.sourcePath);
            if (!result) {
              return item;
            }

            return {
              ...item,
              status: result.status,
              outputPath: result.outputPath,
              outputName: result.outputPath ? result.outputPath.split(/[\\/]/).pop() : markdownOutputName(item.name),
              error: result.error,
            };
          }),
        );
      } else {
        await runLimited(
          fileItems.filter((item) => item.file),
          3,
          async (item) => {
            updateFileItem(item.id, { status: "running", error: undefined });
            try {
              const result = await convertBrowserFile(item.file as File);
              applyBrowserResult(item.id, result);
            } catch (error) {
              updateFileItem(item.id, { status: "error", error: getErrorMessage(error) });
            }
          },
        );
      }
    } finally {
      setFilesBusy(false);
    }
  }

  async function handleDownloadAll() {
    const completeItems = fileItems.filter((item) => item.status === "done" && item.markdown);
    if (completeItems.length === 0) {
      return;
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    for (const item of completeItems) {
      zip.file(item.outputName || markdownOutputName(item.name), item.markdown || "");
    }

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob("markdown-them.zip", blob);
  }

  function addDesktopEntries(entries: DesktopFileEntry[]) {
    if (entries.length === 0) {
      return;
    }

    setFileItems((items) => mergeFileItems(items, entries.map(createDesktopItem)));
  }

  function addBrowserFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setFileItems((items) => mergeFileItems(items, files.map(createBrowserItem)));
  }

  function applyBrowserResult(id: string, result: BrowserConversionResult) {
    updateFileItem(id, {
      status: "done",
      markdown: result.markdown,
      outputName: result.outputName,
      error: undefined,
    });
  }

  function updateFileItem(id: string, patch: Partial<FileItem>) {
    setFileItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <div className={`app-shell ${isDesktop ? "desktop-shell" : ""}`}>
      {isDesktop ? <Titlebar /> : null}

      <main
        ref={workspaceRef}
        className={`workspace ${isDragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <section className="topline">
          <div className="brand-lockup">
            <img src="assets/markdown-them-logo.png" alt="" />
            <div>
              <h1>Markdown Them</h1>
              <p>{isDesktop ? "Desktop" : "Web"} local converter</p>
            </div>
          </div>

          <div className="segmented" role="tablist" aria-label="Mode">
            <button className={mode === "files" ? "active" : ""} onClick={() => setMode("files")} type="button">
              <Files size={16} />
              <span>Files</span>
            </button>
            <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")} type="button">
              <Clipboard size={16} />
              <span>Text</span>
            </button>
          </div>
        </section>

        <section className="trust-strip" aria-label="Privacy and project links">
          <TrustBadge icon={ShieldCheck} title="Privacy-first" detail="No account, no file tracking" />
          <TrustBadge
            icon={MonitorCheck}
            title={isDesktop ? "100% local processing" : "100% client-side conversion"}
            detail={isDesktop ? "Runs on this computer" : "Runs inside your browser"}
          />
          <TrustBadge icon={CloudOff} title="No document uploads" detail="Files never leave your device" />
        </section>

        {mode === "text" ? (
          <section ref={contentRef} className="tool-grid mode-surface">
            <div className="glass-panel input-panel motion-card">
              <div className="panel-head">
                <h2>Input</h2>
                <button className="icon-button" type="button" title="Clear" aria-label="Clear" onClick={() => setTextInput("")}>
                  <Trash2 size={16} />
                </button>
              </div>
              <textarea
                className="editor"
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                spellCheck={false}
              />
              <div className="action-row">
                <button className="primary-button" type="button" onClick={handleConvertText} disabled={textBusy || !textInput.trim()}>
                  {textBusy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
                  <span>Convert</span>
                </button>
              </div>
            </div>

            <div className="glass-panel output-panel motion-card">
              <div className="panel-head">
                <h2>Markdown</h2>
                <div className="compact-actions">
                  <button className="icon-button" type="button" title="Copy" aria-label="Copy" onClick={handleCopyText} disabled={!textOutput}>
                    <Copy size={16} />
                  </button>
                  <button className="icon-button" type="button" title={isDesktop ? "Save" : "Download"} aria-label={isDesktop ? "Save" : "Download"} onClick={handleSaveText} disabled={!textOutput}>
                    {isDesktop ? <Save size={16} /> : <Download size={16} />}
                  </button>
                </div>
              </div>
              <textarea className="editor output-editor" value={textOutput} onChange={(event) => setTextOutput(event.target.value)} spellCheck={false} />
            </div>
          </section>
        ) : (
          <section ref={contentRef} className="files-layout mode-surface">
            <div className="glass-panel files-panel motion-card">
              <div className="panel-head">
                <h2>Selection</h2>
                <button className="icon-button" type="button" title="Clear" aria-label="Clear" onClick={() => setFileItems([])} disabled={filesBusy || fileItems.length === 0}>
                  <Trash2 size={16} />
                </button>
              </div>

              <input ref={fileInputRef} className="hidden-input" type="file" multiple accept={fileAccept} onChange={handleBrowserFileInput} />

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
                    <button className="icon-button" type="button" title="Choose output folder" aria-label="Choose output folder" onClick={handleChooseOutputFolder} disabled={filesBusy}>
                      <FolderOpen size={16} />
                    </button>
                    <button className="icon-button" type="button" title="Use source folders" aria-label="Use source folders" onClick={() => setOutputFolder("")} disabled={filesBusy || !outputFolder}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="action-row split-actions">
                <button className="secondary-button" type="button" onClick={handleChooseFiles} disabled={filesBusy}>
                  <Files size={16} />
                  <span>Files</span>
                </button>
                {isDesktop ? (
                  <button className="secondary-button" type="button" onClick={handleChooseFolders} disabled={filesBusy}>
                    <FolderOpen size={16} />
                    <span>Folders</span>
                  </button>
                ) : null}
                <button className="primary-button" type="button" onClick={handleConvertFiles} disabled={filesBusy || fileItems.length === 0}>
                  {filesBusy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
                  <span>Convert</span>
                </button>
              </div>
            </div>

            <div className="glass-panel file-list motion-card">
              {fileItems.length === 0 ? (
                <div className="empty-state">No files selected</div>
              ) : (
                fileItems.map((item) => (
                  <article className="file-row" key={item.id}>
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
                ))
              )}
            </div>

            {!isDesktop && summary.done > 1 ? (
              <button className="floating-download" type="button" onClick={handleDownloadAll}>
                <Download size={16} />
                <span>Download all</span>
              </button>
            ) : null}
          </section>
        )}

        {!isDesktop ? <AppFooter /> : null}

        {notice ? <div className="toast">{notice}</div> : null}
      </main>
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <span>
        made by <ExternalLink href={profileUrl}>the-long-ride</ExternalLink> with &lt;3
      </span>
      <span>
        <ExternalLink href={repoUrl}>GitHub repo</ExternalLink>
      </span>
      <span>
        <ExternalLink href={variantsUrl}>Variants</ExternalLink>
      </span>
      <span>
        <ExternalLink href={licenseUrl}>MIT license</ExternalLink>
      </span>
    </footer>
  );
}

function TrustBadge({ detail, icon: Icon, title }: { detail: string; icon: LucideIcon; title: string }) {
  return (
    <div className="trust-badge">
      <span className="trust-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="trust-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
  );
}

function ExternalLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!desktopApi) {
          return;
        }

        event.preventDefault();
        desktopApi.openExternal(href).catch(() => undefined);
      }}
    >
      {children}
    </a>
  );
}

function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!desktopApi) {
      return;
    }

    desktopApi.window.isMaximized().then(setIsMaximized).catch(() => undefined);
    return desktopApi.window.onMaximizedChange(setIsMaximized);
  }, []);

  if (!desktopApi) {
    return null;
  }

  return (
    <div className="titlebar">
      <div className="titlebar-title">Markdown Them</div>
      <AppFooter />
      <div className="window-controls">
        <button type="button" title="Minimize" aria-label="Minimize" onClick={() => desktopApi.window.minimize()}>
          <Minus size={14} />
        </button>
        <button type="button" title={isMaximized ? "Restore" : "Maximize"} aria-label={isMaximized ? "Restore" : "Maximize"} onClick={() => desktopApi.window.toggleMaximize()}>
          <Maximize2 size={14} />
        </button>
        <button className="close-control" type="button" title="Close" aria-label="Close" onClick={() => desktopApi.window.close()}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function createBrowserItem(file: File): FileItem {
  return {
    id: `browser:${file.name}:${file.size}:${file.lastModified}`,
    name: file.name,
    size: file.size,
    file,
    status: "queued",
    outputName: markdownOutputName(file.name),
  };
}

function createDesktopItem(entry: DesktopFileEntry): FileItem {
  return {
    id: `desktop:${entry.path}`,
    name: entry.name,
    size: entry.size,
    sourcePath: entry.path,
    status: "queued",
    outputName: markdownOutputName(entry.name),
  };
}

function mergeFileItems(current: FileItem[], incoming: FileItem[]): FileItem[] {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];

  for (const item of incoming) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}

async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
      }
    }),
  );
}

async function copyToClipboard(text: string): Promise<void> {
  if (desktopApi) {
    await desktopApi.copyText(text);
    return;
  }

  await navigator.clipboard.writeText(text);
}

function downloadMarkdown(fileName: string, markdown: string) {
  downloadBlob(fileName, new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatSize(size?: number): string {
  if (!size) {
    return "Ready";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function shouldReduceMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
