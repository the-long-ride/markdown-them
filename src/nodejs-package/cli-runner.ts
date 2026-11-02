import * as path from 'node:path';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as process from 'node:process';
import { inferOutputPath, convertFileToMarkdown } from '../core';
import { cleanPath, isSupportedFileName } from './cli-args';

export interface BatchStats {
  converted: number;
  skipped: number;
  failed: number;
  outputs: string[];
}

export async function validateSource(
  sourcePath: string,
): Promise<{ resolvedPath: string; isDirectory: boolean }> {
  const cleaned = cleanPath(sourcePath);
  const resolved = path.resolve(process.cwd(), cleaned);
  let stat: fs.Stats;
  try {
    stat = await fsPromises.stat(resolved);
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      throw new Error(`Source path does not exist: "${resolved}"`);
    }
    throw new Error(`Cannot access source path "${resolved}": ${err?.message || err}`);
  }

  const isDir = stat.isDirectory();
  const isFile = stat.isFile();

  if (!isDir && !isFile) {
    throw new Error(`Source path is neither a regular file nor a directory: "${resolved}"`);
  }

  return { resolvedPath: resolved, isDirectory: isDir };
}

export async function convertSingleFile(
  sourceFile: string,
  destinationOption?: string,
): Promise<string> {
  let targetOutputPath: string;

  if (destinationOption) {
    const cleanedDest = cleanPath(destinationOption);
    const resolvedDest = path.resolve(process.cwd(), cleanedDest);
    let isDir = false;
    try {
      const destStat = await fsPromises.stat(resolvedDest);
      isDir = destStat.isDirectory();
    } catch {
      if (cleanedDest.endsWith('/') || cleanedDest.endsWith('\\')) {
        isDir = true;
      }
    }

    if (isDir) {
      await fsPromises.mkdir(resolvedDest, { recursive: true });
      const ext = path.extname(sourceFile).toLowerCase();
      const stem = path.basename(sourceFile, path.extname(sourceFile));
      const outputName =
        ext === '.md' || ext === '.markdown' || ext === '.mdx'
          ? `${stem}_converted.md`
          : `${stem}.md`;
      targetOutputPath = path.join(resolvedDest, outputName);
    } else {
      await fsPromises.mkdir(path.dirname(resolvedDest), { recursive: true });
      targetOutputPath = resolvedDest;
    }
  } else {
    targetOutputPath = inferOutputPath(sourceFile);
    await fsPromises.mkdir(path.dirname(targetOutputPath), { recursive: true });
  }

  await convertFileToMarkdown(sourceFile, targetOutputPath);
  return targetOutputPath;
}

function isSameOrSubdirectory(parent: string, candidate: string): boolean {
  const p = path.normalize(path.resolve(parent));
  const c = path.normalize(path.resolve(candidate));
  const normP = process.platform === 'win32' ? p.toLowerCase() : p;
  const normC = process.platform === 'win32' ? c.toLowerCase() : c;

  const rel = path.relative(normP, normC);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function shouldSkipDirectory(dirPath: string, sourceDir: string, destDir: string): boolean {
  const normDir = path.normalize(path.resolve(dirPath));
  const base = path.basename(normDir);

  if (base === '.git' || base === 'node_modules') {
    return true;
  }

  const defaultResultsDir = path.resolve(sourceDir, 'results');
  if (isSameOrSubdirectory(defaultResultsDir, normDir)) {
    return true;
  }

  const normSource = path.normalize(path.resolve(sourceDir));
  const normDest = path.normalize(path.resolve(destDir));
  const isDestSourceRoot =
    process.platform === 'win32'
      ? normSource.toLowerCase() === normDest.toLowerCase()
      : normSource === normDest;

  if (!isDestSourceRoot && isSameOrSubdirectory(normDest, normDir)) {
    return true;
  }

  return false;
}

export async function scanDirectory(
  sourceDir: string,
  recursive: boolean,
  destDir: string,
): Promise<{ supportedFiles: string[]; skippedFiles: string[] }> {
  const resolvedSource = path.resolve(sourceDir);
  const supportedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const visitedDirs = new Set<string>();
  const queue: string[] = [resolvedSource];

  while (queue.length > 0) {
    const currentDir = queue.shift()!;
    let realCurrentDir: string;
    try {
      realCurrentDir = await fsPromises.realpath(currentDir);
    } catch {
      realCurrentDir = currentDir;
    }

    const key = process.platform === 'win32' ? realCurrentDir.toLowerCase() : realCurrentDir;
    if (visitedDirs.has(key)) {
      continue;
    }
    visitedDirs.add(key);

    let entries: fs.Dirent[];
    try {
      entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
    } catch (err: any) {
      console.error(`Warning: Cannot read directory "${currentDir}": ${err?.message || err}`);
      continue;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      let isDir = entry.isDirectory();
      let isFile = entry.isFile();

      if (entry.isSymbolicLink()) {
        try {
          const stat = await fsPromises.stat(fullPath);
          isDir = stat.isDirectory();
          isFile = stat.isFile();
        } catch {
          continue;
        }
      }

      if (isDir) {
        if (!recursive) {
          continue;
        }
        if (shouldSkipDirectory(fullPath, resolvedSource, destDir)) {
          continue;
        }
        queue.push(fullPath);
      } else if (isFile) {
        if (isSupportedFileName(entry.name)) {
          supportedFiles.push(fullPath);
        } else {
          skippedFiles.push(fullPath);
        }
      }
    }
  }

  return { supportedFiles, skippedFiles };
}

export async function convertDirectory(
  sourceDir: string,
  destinationOption: string | undefined,
  recursive: boolean,
): Promise<BatchStats> {
  const resolvedSource = path.resolve(process.cwd(), cleanPath(sourceDir));
  const resolvedDest = destinationOption
    ? path.resolve(process.cwd(), cleanPath(destinationOption))
    : path.join(resolvedSource, 'results');

  try {
    await fsPromises.mkdir(resolvedDest, { recursive: true });
  } catch (err: any) {
    throw new Error(
      `Cannot create destination directory "${resolvedDest}": ${err?.message || err}`,
    );
  }

  const { supportedFiles, skippedFiles } = await scanDirectory(
    resolvedSource,
    recursive,
    resolvedDest,
  );

  const stats: BatchStats = {
    converted: 0,
    skipped: skippedFiles.length,
    failed: 0,
    outputs: [],
  };

  const usedOutputNames = new Set<string>();

  for (let i = 0; i < supportedFiles.length; i++) {
    const file = supportedFiles[i];
    const ext = path.extname(file).toLowerCase();
    const stem = path.basename(file, path.extname(file));
    const baseOutputName =
      ext === '.md' || ext === '.markdown' ? `${stem}_converted.md` : `${stem}.md`;

    let candidateName = baseOutputName;
    let counter = 1;
    const baseStem = path.basename(baseOutputName, '.md');

    while (
      usedOutputNames.has(candidateName.toLowerCase()) ||
      fs.existsSync(path.join(resolvedDest, candidateName))
    ) {
      counter++;
      candidateName = `${baseStem}-${counter}.md`;
    }

    usedOutputNames.add(candidateName.toLowerCase());
    const outPath = path.join(resolvedDest, candidateName);

    try {
      await convertFileToMarkdown(file, outPath);
      stats.converted++;
      stats.outputs.push(outPath);
      console.log(
        `Converted [${stats.converted}/${supportedFiles.length}]: ${path.relative(resolvedSource, file)} -> ${path.relative(process.cwd(), outPath)}`,
      );
    } catch (err: any) {
      stats.failed++;
      console.error(`Error converting "${file}": ${err?.message || err}`);
    }
  }

  return stats;
}
