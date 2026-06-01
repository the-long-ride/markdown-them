export type Mode = "text" | "files";
export type ThemeMode = "dark" | "light";
export type FileStatus = "queued" | "running" | "done" | "error";

export interface FileItem {
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

export interface FileSummary {
  done: number;
  failed: number;
  total: number;
}
