export interface DesktopFileEntry {
  path: string;
  name: string;
  size?: number;
}

export interface DesktopConversionResult {
  sourcePath: string;
  name: string;
  status: 'done' | 'error';
  outputPath?: string;
  error?: string;
}

export interface DesktopSaveResult {
  canceled: boolean;
  filePath?: string;
}

export interface DesktopUpdateInfo {
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  downloadUrl?: string;
  updateAvailable: boolean;
}

export interface DragDropPayload {
  type: 'enter' | 'over' | 'drop' | 'leave';
  paths?: string[];
  position?: { x: number; y: number };
}

export interface MarkdownThemDesktopApi {
  isDesktop: true;
  chooseFiles(): Promise<DesktopFileEntry[]>;
  chooseFolders(): Promise<DesktopFileEntry[]>;
  chooseOutputFolder(): Promise<string | undefined>;
  convertFiles(paths: string[], outputFolder?: string): Promise<DesktopConversionResult[]>;
  convertText(input: string): Promise<string>;
  saveMarkdown(defaultName: string, markdown: string): Promise<DesktopSaveResult>;
  copyText(text: string): Promise<void>;
  checkForUpdate(): Promise<DesktopUpdateInfo>;
  openExternal(url: string): Promise<void>;
  isDebug?(): Promise<boolean>;
  openPath?(path: string): Promise<void>;
  readFileBinary?(filePath: string): Promise<Uint8Array>;
  saveConvertedFile?(
    sourcePath: string,
    outputFolder: string | null | undefined,
    markdown: string,
  ): Promise<string>;
  saveMarkdownDialog?(defaultName: string, markdown: string): Promise<string | null>;
  onDragDropEvent?(callback: (payload: DragDropPayload) => void): () => void;
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    startDragging?(): void;
    setZoom?(factor: number): Promise<void>;
    getZoom?(): number;
    onMaximizedChange(callback: (isMaximized: boolean) => void): () => void;
  };
}

declare global {
  interface Window {
    markdownThemDesktop?: MarkdownThemDesktopApi;
    __TAURI_INTERNALS__?: {
      invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
    };
  }
}
