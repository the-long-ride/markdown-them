import { markdownOutputName } from '../../shared/formats';
import type { FileItem } from '../app-types';
import { downloadBlob } from '../app-utils';
import { convertBufferToMarkdown } from '../browser-converter';
import type { MarkdownThemDesktopApi } from '../desktop-api';
import type { FileTask } from '../parallel-queue';

/**
 * Downloads a zip archive containing all completed converted markdown files.
 */
export async function downloadFilesZip(items: FileItem[]): Promise<void> {
  const completeItems = items.filter(
    (item) => item.status === 'done' && typeof item.markdown === 'string',
  );
  if (completeItems.length === 0) {
    return;
  }

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const item of completeItems) {
    zip.file(item.outputName || markdownOutputName(item.name), item.markdown || '');
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob('markdown-them.zip', blob);
}

/**
 * Builds FileTask items for desktop file conversions.
 */
export function buildDesktopTasks(
  items: FileItem[],
  api: MarkdownThemDesktopApi,
  outputFolder: string,
  signal?: AbortSignal,
): FileTask[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    sourcePath: item.sourcePath,
    file: item.file,
    status: 'queued' as const,
    outputName: item.outputName || markdownOutputName(item.name),
    convert: async () => {
      if (signal?.aborted) {
        throw new Error('Canceled');
      }

      let rawBytes: Uint8Array;
      if (item.sourcePath && api.readFileBinary) {
        rawBytes = await api.readFileBinary(item.sourcePath);
      } else if (item.file) {
        const buffer = await item.file.arrayBuffer();
        rawBytes = new Uint8Array(buffer);
      } else if (item.sourcePath) {
        const results = await api.convertFiles([item.sourcePath], outputFolder || undefined);
        const entry = results[0];
        if (!entry || entry.status === 'error') {
          throw new Error(entry?.error || 'Desktop conversion failed');
        }
        return {
          markdown: '',
          outputPath: entry.outputPath,
          outputName: entry.outputPath
            ? entry.outputPath.split(/[\\/]/).pop()
            : markdownOutputName(item.name),
        };
      } else {
        throw new Error('No file content available');
      }

      if (signal?.aborted) {
        throw new Error('Canceled');
      }

      const markdown = await convertBufferToMarkdown(item.name, rawBytes);
      if (signal?.aborted) {
        throw new Error('Canceled');
      }

      let outputPath: string | undefined;
      let outputName: string | undefined;

      if (api.saveConvertedFile && (item.sourcePath || outputFolder)) {
        outputPath = await api.saveConvertedFile(
          item.sourcePath || item.name,
          outputFolder || null,
          markdown,
        );
        outputName = outputPath.split(/[\\/]/).pop() || markdownOutputName(item.name);
      } else {
        outputName = markdownOutputName(item.name);
      }

      return {
        markdown,
        outputPath,
        outputName,
      };
    },
  }));
}

/**
 * Builds FileTask items for browser file conversions.
 */
export function buildBrowserTasks(items: FileItem[]): FileTask[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    file: item.file,
    status: 'queued' as const,
    outputName: item.outputName || markdownOutputName(item.name),
  }));
}
