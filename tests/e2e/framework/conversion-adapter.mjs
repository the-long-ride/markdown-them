/**
 * E2E Conversion Adapter
 * Bridge to the Markdown Them conversion pipeline.
 * Encapsulates core conversion, batch execution, concurrency control, and collision-free output naming.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Locate compiled core converters
const projectRoot = path.resolve(import.meta.dirname, '../../..');
const convertersPath = path.join(projectRoot, 'out/core/converters.js');

if (!fsSync.existsSync(convertersPath)) {
  // If not compiled yet, trigger tsc
  const { execSync } = require('child_process');
  try {
    execSync('npm run compile', { cwd: projectRoot, stdio: 'pipe' });
  } catch (err) {
    console.error('Failed to compile TypeScript sources before running tests:', err);
  }
}

const coreIndexPath = path.join(projectRoot, 'out/core/index.js');
const coreModule = require(fsSync.existsSync(coreIndexPath) ? coreIndexPath : convertersPath);
const {
  generateMarkdown: coreGenerateMarkdown,
  convertFileToMarkdown: coreConvertFileToMarkdown,
  convertTextToMarkdown: coreConvertTextToMarkdown,
  inferOutputPath: coreInferOutputPath,
  DocumentConverter,
  createDocumentConverter,
  decodeXmlEntities,
  normalizeMarkdown,
  normalizePreviewMarkdown,
  createFailureMarkdown,
  classifyExtension,
  getExtension,
  isMarkdownFilePath,
  isConvertibleDocumentFilePath,
  isTextDocumentFilePath,
  stripKnownExtension,
  getFileTypeLabel,
  readMarkdownFile,
  getConversionQuality,
  getMarkdownThem,
  escapeMarkdownTableCell,
  htmlToMarkdown,
  convertRtfToMarkdown,
} = coreModule;

export {
  coreConvertFileToMarkdown as convertFileToMarkdown,
  coreConvertTextToMarkdown as convertTextToMarkdown,
  DocumentConverter,
  createDocumentConverter,
  decodeXmlEntities,
  normalizeMarkdown,
  normalizePreviewMarkdown,
  createFailureMarkdown,
  classifyExtension,
  getExtension,
  isMarkdownFilePath,
  isConvertibleDocumentFilePath,
  isTextDocumentFilePath,
  stripKnownExtension,
  getFileTypeLabel,
  readMarkdownFile,
  getConversionQuality,
  getMarkdownThem,
  escapeMarkdownTableCell,
  htmlToMarkdown,
  convertRtfToMarkdown,
};

export function inferOutputPath(filePath) {
  return coreInferOutputPath(filePath);
}

export function convertText(text) {
  return coreConvertTextToMarkdown(typeof text === 'string' ? text : '');
}

/**
 * Generate Markdown string directly from a file path.
 * Handles both rich document formats (.docx, .pdf, .xlsx, .pptx, .odt, .rtf, .html)
 * and plain text formats (.txt, .md).
 */
export async function generateMarkdown(filePath) {
  return coreGenerateMarkdown(filePath);
}

/**
 * Convert a file from disk and write the result to markdown output file.
 */
export async function convertFile(filePath, outputPath) {
  const targetOutput = outputPath || coreInferOutputPath(filePath);
  const writtenPath = await coreConvertFileToMarkdown(filePath, targetOutput);
  const mdContent = await fs.readFile(writtenPath, 'utf-8');
  return { outputPath: writtenPath, markdown: mdContent };
}

/**
 * Collision-free output name generator (matching Desktop Tauri contract)
 * Given files with duplicate names (e.g. `doc.docx` and another `doc.docx` or `doc.html`),
 * yields: `doc.md`, `doc-2.md`, `doc-3.md`, etc.
 */
export function uniqueOutputName(fileName, usedNames) {
  const normalized = fileName.toLowerCase();
  const count = usedNames.get(normalized) || 0;
  usedNames.set(normalized, count + 1);

  if (count === 0) {
    return fileName;
  }

  const extension = path.extname(fileName);
  const basename = path.basename(fileName, extension);
  return `${basename}-${count + 1}${extension}`;
}

/**
 * Resolves collision-free destination paths for a list of input files.
 */
export async function resolveOutputPaths(filePaths, outputFolder) {
  const outputPaths = new Map();
  if (!outputFolder) {
    return outputPaths;
  }

  const usedNames = new Map();
  for (const filePath of filePaths) {
    const base = path.basename(filePath);
    const dotIndex = base.lastIndexOf('.');
    const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base || 'converted';
    const baseMdName = base.toLowerCase().endsWith('.md') ? `${stem}_converted.md` : `${stem}.md`;
    const resolvedName = uniqueOutputName(baseMdName, usedNames);
    outputPaths.set(filePath, path.join(outputFolder, resolvedName));
  }

  return outputPaths;
}

/**
 * Concurrency-controlled worker pool (matches `runLimited` in Desktop & UI)
 */
export async function runLimited(items, limit, worker) {
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

/**
 * Batch file conversion with concurrency pool and fault isolation.
 */
export async function convertBatch(filePaths, { concurrency = 4, outputFolder, onProgress } = {}) {
  const results = new Map();
  const outputPaths = await resolveOutputPaths(filePaths, outputFolder);

  await runLimited(filePaths, concurrency, async (filePath) => {
    const name = path.basename(filePath);
    const targetOut = outputPaths.get(filePath);

    try {
      const { outputPath, markdown } = await convertFile(filePath, targetOut);
      const res = {
        sourcePath: filePath,
        name,
        status: 'done',
        outputPath,
        markdown,
      };
      results.set(filePath, res);
      if (onProgress) onProgress(res);
    } catch (error) {
      const res = {
        sourcePath: filePath,
        name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
      results.set(filePath, res);
      if (onProgress) onProgress(res);
    }
  });

  return filePaths.map((fp) => results.get(fp)).filter(Boolean);
}
