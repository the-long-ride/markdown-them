/**
 * Tauri Desktop API Adapter
 *
 * Implements the MarkdownThemDesktopApi interface for Tauri v2 runtime.
 * Bridges React UI components to native Rust backend commands and integrates
 * the hybrid execution pipeline (Rust I/O + TypeScript in-memory conversion).
 */

import { convertBufferToMarkdown, convertTextToMarkdown } from './browser-converter';
import type {
  DesktopConversionResult,
  DesktopFileEntry,
  DesktopSaveResult,
  DesktopUpdateInfo,
  DragDropPayload,
  MarkdownThemDesktopApi,
} from './desktop-api';
import {
  createDragDropListener,
  createWindowControls,
  isTauriEnvironment,
  tauriInvoke,
  toUint8Array,
} from './tauri-bridge';
import { appVersion } from './version';

export { convertBufferToMarkdown, convertTextToMarkdown, isTauriEnvironment, toUint8Array };

/**
 * Factory function creating the Tauri desktop API implementation.
 */
export function createTauriDesktopApi(): MarkdownThemDesktopApi {
  const api: MarkdownThemDesktopApi = {
    isDesktop: true,

    async chooseFiles(): Promise<DesktopFileEntry[]> {
      const entries = await tauriInvoke<DesktopFileEntry[]>('choose_files');
      return entries ?? [];
    },

    async chooseFolders(): Promise<DesktopFileEntry[]> {
      const entries = await tauriInvoke<DesktopFileEntry[]>('choose_folders');
      return entries ?? [];
    },

    async chooseOutputFolder(): Promise<string | undefined> {
      const result = await tauriInvoke<string | null>('choose_output_folder');
      return result ?? undefined;
    },

    async readFileBinary(filePath: string): Promise<Uint8Array> {
      const raw = await tauriInvoke<number[] | Uint8Array>('read_file_binary', {
        filePath,
        file_path: filePath,
        path: filePath,
      });
      return toUint8Array(raw);
    },

    async saveConvertedFile(
      sourcePath: string,
      outputFolder: string | null | undefined,
      markdown: string,
    ): Promise<string> {
      return await tauriInvoke<string>('save_converted_file', {
        sourcePath,
        source_path: sourcePath,
        outputFolder: outputFolder || null,
        output_folder: outputFolder || null,
        markdown,
      });
    },

    async saveMarkdownDialog(defaultName: string, markdown: string): Promise<string | null> {
      const result = await tauriInvoke<string | null>('save_markdown_dialog', {
        defaultName,
        default_name: defaultName,
        markdown,
      });
      return result ?? null;
    },

    async saveMarkdown(defaultName: string, markdown: string): Promise<DesktopSaveResult> {
      const filePath = await api.saveMarkdownDialog!(defaultName, markdown);
      return {
        canceled: !filePath,
        filePath: filePath ?? undefined,
      };
    },

    async convertFiles(paths: string[], outputFolder?: string): Promise<DesktopConversionResult[]> {
      if (paths.length === 0) {
        return [];
      }

      const results: DesktopConversionResult[] = new Array(paths.length);
      const concurrency = 4;
      let nextIndex = 0;

      const runTask = async (sourcePath: string, index: number) => {
        const fileName = sourcePath.split(/[\\/]/).pop() || sourcePath;
        try {
          const buffer = await api.readFileBinary!(sourcePath);
          const markdown = await convertBufferToMarkdown(fileName, buffer);
          const outputPath = await api.saveConvertedFile!(
            sourcePath,
            outputFolder || null,
            markdown,
          );
          results[index] = {
            sourcePath,
            name: fileName,
            status: 'done',
            outputPath,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          results[index] = {
            sourcePath,
            name: fileName,
            status: 'error',
            error: errorMsg,
          };
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, paths.length) }, async () => {
        while (nextIndex < paths.length) {
          const currentIndex = nextIndex++;
          await runTask(paths[currentIndex], currentIndex);
        }
      });

      await Promise.all(workers);
      return results;
    },

    async convertText(input: string): Promise<string> {
      return convertTextToMarkdown(input);
    },

    async copyText(text: string): Promise<void> {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    },

    async checkForUpdate(): Promise<DesktopUpdateInfo> {
      const currentVersion = appVersion;
      try {
        const res = await fetch(
          'https://api.github.com/repos/the-long-ride/markdown-them/releases/latest',
          {
            headers: { Accept: 'application/vnd.github+json' },
          },
        );
        if (!res.ok) {
          return { currentVersion, updateAvailable: false };
        }
        const release = (await res.json()) as { tag_name?: string; html_url?: string };
        const latestVersion = release.tag_name ? release.tag_name.replace(/^v/i, '') : undefined;
        const updateAvailable = Boolean(latestVersion && latestVersion !== currentVersion);
        return {
          currentVersion,
          latestVersion,
          releaseUrl: release.html_url,
          downloadUrl: release.html_url,
          updateAvailable,
        };
      } catch {
        return { currentVersion, updateAvailable: false };
      }
    },

    async openExternal(url: string): Promise<void> {
      await tauriInvoke('open_external', { url });
    },

    async openPath(path: string): Promise<void> {
      await tauriInvoke('open_path', { path });
    },

    onDragDropEvent(callback: (payload: DragDropPayload) => void): () => void {
      return createDragDropListener(callback);
    },

    async isDebug(): Promise<boolean> {
      try {
        return await tauriInvoke<boolean>('app_is_debug');
      } catch {
        return false;
      }
    },

    window: createWindowControls(),
  };

  return api;
}

/**
 * Singleton cache for Tauri desktop API.
 */
let cachedDesktopApi: MarkdownThemDesktopApi | undefined;

/**
 * Returns the desktop API instance if running in Tauri, or undefined in browser mode.
 */
export function getDesktopApi(): MarkdownThemDesktopApi | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  if (window.markdownThemDesktop) {
    return window.markdownThemDesktop;
  }

  if (isTauriEnvironment()) {
    if (!cachedDesktopApi) {
      cachedDesktopApi = createTauriDesktopApi();
      window.markdownThemDesktop = cachedDesktopApi;
    }
    return cachedDesktopApi;
  }

  return undefined;
}

// Automatically attach to window when in Tauri environment
if (typeof window !== 'undefined' && isTauriEnvironment()) {
  getDesktopApi();
}
