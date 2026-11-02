import * as fs from 'fs/promises';
import * as path from 'path';
import { generateMarkdown } from './converters';
import {
  DocumentPreviewKind,
  DocumentPreviewInfo,
  ReadMarkdownResult,
  CacheEntry,
} from './document-types';

export type { DocumentPreviewKind, DocumentPreviewInfo, ReadMarkdownResult, CacheEntry };

export const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx', '.markdown']);
export const TEXT_DOCUMENT_EXTENSIONS = new Set(['.txt', '.text']);
export const CONVERTIBLE_DOCUMENT_EXTENSIONS = new Set([
  '.doc',
  '.docx',
  '.pdf',
  '.html',
  '.htm',
  '.xls',
  '.xlsx',
  '.xlm',
  '.pptx',
  '.odt',
  '.odp',
  '.ods',
  '.rtf',
]);
export const EXTRA_DOCUMENT_EXTENSIONS = new Set([
  ...CONVERTIBLE_DOCUMENT_EXTENSIONS,
  ...TEXT_DOCUMENT_EXTENSIONS,
]);
export const ALL_SUPPORTED_EXTENSIONS = new Set([
  ...MARKDOWN_EXTENSIONS,
  ...EXTRA_DOCUMENT_EXTENSIONS,
]);

let defaultMarkdownThem: { generateMarkdown: typeof generateMarkdown } | null = null;

export function getMarkdownThem(): { generateMarkdown: typeof generateMarkdown } {
  if (!defaultMarkdownThem) {
    defaultMarkdownThem = { generateMarkdown };
  }
  return defaultMarkdownThem;
}

export function getExtension(filePath: string): string {
  return path.extname(filePath || '').toLowerCase();
}

export function isMarkdownFilePath(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.has(getExtension(filePath));
}

export function isTextDocumentFilePath(filePath: string): boolean {
  return TEXT_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

export function isConvertibleDocumentFilePath(filePath: string): boolean {
  return CONVERTIBLE_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

export function isExtraDocumentFilePath(filePath: string): boolean {
  return EXTRA_DOCUMENT_EXTENSIONS.has(getExtension(filePath));
}

export function isSupportedFilePath(filePath: string, documentConversionEnabled = false): boolean {
  return (
    isMarkdownFilePath(filePath) ||
    isTextDocumentFilePath(filePath) ||
    (documentConversionEnabled && isConvertibleDocumentFilePath(filePath))
  );
}

export function isKnownSupportedFilePath(filePath: string): boolean {
  return ALL_SUPPORTED_EXTENSIONS.has(getExtension(filePath));
}

export function stripKnownExtension(fileName: string): string {
  const ext = path.extname(fileName);
  return ext ? fileName.slice(0, -ext.length) : fileName;
}

export function getFileTypeLabel(filePath: string): string {
  const ext = getExtension(filePath);
  return ext ? ext.slice(1).toUpperCase() : 'Document';
}

export function getConversionQuality(ext: string): { qualityCode: string; qualityWarning: string } {
  const normalized = (ext || '').toLowerCase();
  if (normalized === '.doc' || normalized === '.xls' || normalized === '.xlm') {
    return {
      qualityCode: 'legacy-best-effort',
      qualityWarning:
        'This preview was converted from a legacy binary Office format (DOC/XLS/XLM). Formatting, formulas, or embedded objects may be omitted.',
    };
  }
  return {
    qualityCode: 'converted-preview',
    qualityWarning:
      'This preview was converted to Markdown. Layout, images, tables, and styling may not perfectly match the original file.',
  };
}

export function normalizePreviewMarkdown(markdown: string, filePath: string): string {
  const trimmed = String(markdown || '').trim();
  const title = stripKnownExtension(path.basename(filePath))
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (!trimmed) {
    return `# ${title}\n\n_No readable content was found while preparing this preview._`;
  }
  if (/^#\s+.+$/m.test(trimmed)) {
    return trimmed;
  }
  return `# ${title}\n\n${trimmed}`;
}

export function createFailureMarkdown(filePath: string, err: unknown): string {
  const title = stripKnownExtension(path.basename(filePath))
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const message = err instanceof Error ? err.message : String(err || 'Unknown conversion error');
  return [
    `# ${title}`,
    '',
    `Markdown Them could not convert this ${getFileTypeLabel(filePath)} file.`,
    '',
    '```text',
    message,
    '```',
  ].join('\n');
}

export function classifyExtension(
  extOrPath: string,
): 'markdown' | 'text' | 'convertible' | 'unsupported' {
  let normalized = (extOrPath || '').toLowerCase();
  if (normalized.includes('.') && !normalized.startsWith('.')) {
    normalized = path.extname(normalized).toLowerCase();
  } else if (!normalized.startsWith('.')) {
    normalized = `.${normalized}`;
  }
  return MARKDOWN_EXTENSIONS.has(normalized)
    ? 'markdown'
    : TEXT_DOCUMENT_EXTENSIONS.has(normalized)
      ? 'text'
      : CONVERTIBLE_DOCUMENT_EXTENSIONS.has(normalized)
        ? 'convertible'
        : 'unsupported';
}

export async function getCachedConversionResult(
  cache: Map<string, CacheEntry>,
  filePath: string,
  stat: { mtimeMs: number; size: number },
): Promise<ReadMarkdownResult | null> {
  const cached = cache.get(filePath);
  if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
    return null;
  }
  const ext = getExtension(filePath);
  const quality = getConversionQuality(ext);
  return {
    markdown: cached.markdown,
    previewInfo: {
      kind: 'converted',
      sourceExtension: ext,
      sourceLabel: getFileTypeLabel(filePath),
      durationMs: cached.durationMs,
      fromCache: true,
      qualityCode: cached.qualityCode || quality.qualityCode,
      qualityWarning: cached.qualityWarning || quality.qualityWarning,
    },
  };
}

export async function readMarkdownFile(
  ext: string,
  filePath: string,
  resolveMarkdownThem:
    | (() => { generateMarkdown: (filePath: string) => Promise<string> })
    | ((filePath: string) => Promise<string>)
    | { generateMarkdown: (filePath: string) => Promise<string> },
  cache: Map<string, CacheEntry>,
): Promise<ReadMarkdownResult> {
  const fileType = classifyExtension(ext);

  if (fileType === 'unsupported') {
    throw new Error(`Unsupported file type: ${ext || path.basename(filePath)}`);
  }

  if (fileType === 'markdown') {
    return {
      markdown: await fs.readFile(filePath, 'utf8'),
      previewInfo: null,
    };
  }

  if (fileType === 'text') {
    return {
      markdown: normalizePreviewMarkdown(await fs.readFile(filePath, 'utf8'), filePath),
      previewInfo: {
        kind: 'text',
        sourceExtension: ext,
        sourceLabel: getFileTypeLabel(filePath),
      },
    };
  }

  const stat = await fs.stat(filePath);
  const cached = await getCachedConversionResult(cache, filePath, stat);
  if (cached) {
    return cached;
  }

  const startedAt = Date.now();
  let generator: (filePath: string) => Promise<string>;
  if (typeof resolveMarkdownThem === 'function') {
    const resolved = (resolveMarkdownThem as any)();
    if (resolved && typeof resolved.generateMarkdown === 'function') {
      generator = (fp) => resolved.generateMarkdown(fp);
    } else if (typeof resolved === 'function') {
      generator = resolved;
    } else {
      generator = (fp) => (resolveMarkdownThem as any)(fp);
    }
  } else if (resolveMarkdownThem && typeof resolveMarkdownThem.generateMarkdown === 'function') {
    generator = (fp) => resolveMarkdownThem.generateMarkdown(fp);
  } else {
    generator = generateMarkdown;
  }

  const markdown = normalizePreviewMarkdown(await generator(filePath), filePath);
  const durationMs = Date.now() - startedAt;
  const quality = getConversionQuality(ext);

  cache.set(filePath, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    markdown,
    durationMs,
    qualityCode: quality.qualityCode,
    qualityWarning: quality.qualityWarning,
  });

  return {
    markdown,
    previewInfo: {
      kind: 'converted',
      sourceExtension: ext,
      sourceLabel: getFileTypeLabel(filePath),
      durationMs,
      fromCache: false,
      qualityCode: quality.qualityCode,
      qualityWarning: quality.qualityWarning,
    },
  };
}

export class DocumentConverter {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly resolveMarkdownGenerator?: (filePath: string) => Promise<string>;
  private readonly injectedGetMarkdownThem?: () => {
    generateMarkdown: (filePath: string) => Promise<string>;
  };

  constructor(options?: {
    generateMarkdown?: (filePath: string) => Promise<string>;
    getMarkdownThem?: () => { generateMarkdown: (filePath: string) => Promise<string> };
  }) {
    this.resolveMarkdownGenerator = options?.generateMarkdown;
    this.injectedGetMarkdownThem = options?.getMarkdownThem;
  }

  async readMarkdown(filePath: string): Promise<ReadMarkdownResult> {
    const ext = getExtension(filePath);
    const resolver = this.resolveMarkdownGenerator
      ? this.resolveMarkdownGenerator
      : this.injectedGetMarkdownThem || getMarkdownThem;
    return readMarkdownFile(ext, filePath, resolver, this.cache);
  }

  createFailureMarkdown(filePath: string, err: unknown): string {
    return createFailureMarkdown(filePath, err);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export function createDocumentConverter(options?: {
  generateMarkdown?: (filePath: string) => Promise<string>;
  getMarkdownThem?: () => { generateMarkdown: (filePath: string) => Promise<string> };
}): DocumentConverter {
  return new DocumentConverter(options);
}
