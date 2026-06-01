import { markdownOutputName } from "../shared/formats";
import type { DesktopFileEntry } from "./desktop-api";
import { desktopApi } from "./app-constants";
import type { FileItem } from "./app-types";

export function createBrowserItem(file: File): FileItem {
  return {
    id: `browser:${file.name}:${file.size}:${file.lastModified}`,
    name: file.name,
    size: file.size,
    file,
    status: "queued",
    outputName: markdownOutputName(file.name),
  };
}

export function createDesktopItem(entry: DesktopFileEntry): FileItem {
  return {
    id: `desktop:${entry.path}`,
    name: entry.name,
    size: entry.size,
    sourcePath: entry.path,
    status: "queued",
    outputName: markdownOutputName(entry.name),
  };
}

export function mergeFileItems(current: FileItem[], incoming: FileItem[]): FileItem[] {
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

export async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
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

export async function copyToClipboard(text: string): Promise<void> {
  if (desktopApi) {
    await desktopApi.copyText(text);
    return;
  }

  await navigator.clipboard.writeText(text);
}

export function downloadMarkdown(fileName: string, markdown: string) {
  downloadBlob(fileName, new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatSize(size?: number): string {
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

export function shouldReduceMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
