import { convertBufferToMarkdown } from './browser-converter';
import { markdownOutputName } from '../shared/formats';

export interface FileTask {
  id: string;
  name: string;
  sourcePath?: string;
  buffer?: Uint8Array;
  file?: File;
  status: 'queued' | 'running' | 'done' | 'error';
  markdown?: string;
  outputPath?: string;
  outputName?: string;
  error?: string;
  convert?: () => Promise<string | { markdown: string; outputPath?: string; outputName?: string }>;
}

export interface FileResult {
  id: string;
  name: string;
  sourcePath?: string;
  status: 'done' | 'error';
  markdown?: string;
  outputPath?: string;
  outputName?: string;
  error?: string;
}

/**
 * Concurrently processes an array of file tasks with strict concurrency pooling,
 * fault isolation, and live progress notifications.
 *
 * @param files Array of FileTask items to process
 * @param concurrency Maximum simultaneous conversions (1 to 16, default 4)
 * @param onProgress Callback invoked upon task state transition
 * @param signal Optional AbortSignal to cancel pending tasks
 */
export async function convertFilesParallel(
  files: FileTask[],
  concurrency: number = 4,
  onProgress?: (task: FileTask) => void,
  signal?: AbortSignal,
): Promise<FileResult[]> {
  if (files.length === 0) {
    return [];
  }

  if (signal?.aborted) {
    return files.map((task) => {
      task.status = 'error';
      task.error = 'Canceled';
      onProgress?.({ ...task });
      return {
        id: task.id,
        name: task.name,
        sourcePath: task.sourcePath,
        status: 'error',
        error: 'Canceled',
      };
    });
  }

  const limit = Math.max(1, Math.min(concurrency || 4, 16));
  const results = new Map<string, FileResult>();
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < files.length) {
      if (signal?.aborted) {
        break;
      }
      const task = files[nextIndex++];
      if (signal?.aborted) {
        task.status = 'error';
        task.error = 'Canceled';
        const result: FileResult = {
          id: task.id,
          name: task.name,
          sourcePath: task.sourcePath,
          status: 'error',
          error: 'Canceled',
        };
        results.set(task.id, result);
        onProgress?.({ ...task });
        break;
      }
      task.status = 'running';
      task.error = undefined;
      onProgress?.({ ...task });

      try {
        let markdown = '';
        let outputPath = task.outputPath;
        let outputName = task.outputName || markdownOutputName(task.name);

        if (task.convert) {
          const res = await task.convert();
          if (typeof res === 'string') {
            markdown = res;
          } else {
            markdown = res.markdown;
            if (res.outputPath) {
              outputPath = res.outputPath;
            }
            if (res.outputName) {
              outputName = res.outputName;
            }
          }
        } else if (task.buffer) {
          markdown = await convertBufferToMarkdown(task.name, task.buffer);
        } else if (task.file) {
          let arrayBuffer: ArrayBuffer | null = await task.file.arrayBuffer();
          markdown = await convertBufferToMarkdown(task.file.name, new Uint8Array(arrayBuffer));
          arrayBuffer = null; // Free memory immediately
        } else {
          throw new Error(`No file content or converter provided for ${task.name}`);
        }

        task.status = 'done';
        task.markdown = markdown;
        task.outputPath = outputPath;
        task.outputName = outputName;
        task.error = undefined;

        const result: FileResult = {
          id: task.id,
          name: task.name,
          sourcePath: task.sourcePath,
          status: 'done',
          markdown,
          outputPath,
          outputName,
        };
        results.set(task.id, result);
        onProgress?.({ ...task });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        task.status = 'error';
        task.error = errorMsg;

        const result: FileResult = {
          id: task.id,
          name: task.name,
          sourcePath: task.sourcePath,
          status: 'error',
          error: errorMsg,
        };
        results.set(task.id, result);
        onProgress?.({ ...task });
      }
    }
  }

  const workerCount = Math.min(limit, files.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  for (const task of files) {
    if (!results.has(task.id)) {
      task.status = 'error';
      task.error = 'Canceled';
      const result: FileResult = {
        id: task.id,
        name: task.name,
        sourcePath: task.sourcePath,
        status: 'error',
        error: 'Canceled',
      };
      results.set(task.id, result);
      onProgress?.({ ...task });
    }
  }

  return files.map((task) => results.get(task.id)).filter(Boolean) as FileResult[];
}
