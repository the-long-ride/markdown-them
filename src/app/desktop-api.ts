export interface DesktopFileEntry {
  path: string;
  name: string;
  size?: number;
}

export interface DesktopConversionResult {
  sourcePath: string;
  name: string;
  status: "done" | "error";
  outputPath?: string;
  error?: string;
}

export interface DesktopSaveResult {
  canceled: boolean;
  filePath?: string;
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
  openExternal(url: string): Promise<void>;
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    onMaximizedChange(callback: (isMaximized: boolean) => void): () => void;
  };
}

declare global {
  interface Window {
    markdownThemDesktop?: MarkdownThemDesktopApi;
  }
}
