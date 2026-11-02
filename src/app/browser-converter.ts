import { parseOffice, terminateOcr } from 'officeparser';
import { convertTextToMarkdown, htmlToMarkdown, officeAstToMarkdown } from '../core/markdown-utils';
import { convertOdfData } from '../core/odf';
import { convertPptxData } from '../core/pptx';
import { convertRtfToMarkdown } from '../core/rtf';
import { convertXlsxData } from '../core/xlsx';
import { getFileExtension, isSupportedFileName, markdownOutputName } from '../shared/formats';
import { convertFilesParallel } from './parallel-queue';
import type { FileResult, FileTask } from './parallel-queue';

export interface BrowserConversionResult {
  fileName: string;
  markdown: string;
  outputName: string;
}

const TEXT_FILE_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
  '.text',
]);

function resolvePdfWorkerSrc(): string | undefined {
  if (typeof window !== 'undefined' && window.location?.href) {
    try {
      return new URL('assets/pdf.worker.min.mjs', window.location.href).toString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function parseOfficeWithAst(buffer: Uint8Array, fileType?: string): Promise<string> {
  const workerSrc = resolvePdfWorkerSrc();
  const config: Record<string, any> = {
    extractAttachments: false,
    includeRawContent: false,
    ocr: false,
    outputErrorToConsole: false,
  };
  if (fileType) {
    config.fileType = fileType;
  }
  if (workerSrc) {
    config.pdfWorkerSrc = workerSrc;
  }

  try {
    const ast = await parseOffice(buffer, config);
    return officeAstToMarkdown(ast);
  } finally {
    await terminateOcr().catch(() => undefined);
  }
}

/**
 * Converts any supported document buffer to Markdown in-memory.
 *
 * Supported formats:
 * - HTML / HTM: TextDecoder + htmlToMarkdown
 * - Text / MD / Markdown: TextDecoder + convertTextToMarkdown
 * - XLSX / XLS / XLM: convertXlsxData with officeparser fallback
 * - PPTX: convertPptxData with officeparser fallback
 * - ODF (ODT / ODP / ODS): convertOdfData with officeparser fallback
 * - RTF: convertRtfToMarkdown with officeparser fallback
 * - DOCX / DOC / PDF: officeparser with pdfWorkerSrc
 *
 * Zero-byte text files resolve to "".
 * Zero-byte binary files reject gracefully with descriptive error.
 */
export async function convertBufferToMarkdown(name: string, buffer: Uint8Array): Promise<string> {
  const extension = getFileExtension(name);
  if (!isSupportedFileName(name)) {
    throw new Error(`Unsupported file type: ${extension || 'unknown'}`);
  }

  if (buffer.byteLength === 0) {
    if (TEXT_FILE_EXTENSIONS.has(extension)) {
      return '';
    }
    throw new Error(`Cannot convert empty ${extension} file: file is zero bytes`);
  }

  switch (extension) {
    case '.html':
    case '.htm': {
      const text = new TextDecoder('utf-8').decode(buffer);
      return htmlToMarkdown(text);
    }
    case '.md':
    case '.markdown':
    case '.mdx':
    case '.txt':
    case '.text': {
      const text = new TextDecoder('utf-8').decode(buffer);
      return convertTextToMarkdown(text);
    }
    case '.xlsx':
    case '.xls':
    case '.xlm': {
      try {
        const md = await convertXlsxData(buffer);
        if (md.trim()) {
          return md;
        }
      } catch {
        // Fall through to parseOfficeWithAst
      }
      return await parseOfficeWithAst(buffer, 'xlsx');
    }
    case '.pptx': {
      try {
        return await convertPptxData(buffer);
      } catch {
        return await parseOfficeWithAst(buffer, 'pptx');
      }
    }
    case '.odt':
    case '.odp':
    case '.ods': {
      const kind = extension.slice(1) as 'odt' | 'odp' | 'ods';
      try {
        const md = await convertOdfData(buffer, kind);
        if (md.trim()) {
          return md;
        }
      } catch {
        // Fall through to officeparser
      }
      return await parseOfficeWithAst(buffer, kind);
    }
    case '.rtf': {
      const text = new TextDecoder('utf-8').decode(buffer);
      if (!text.trimStart().startsWith('{\\rtf')) {
        throw new Error('Invalid RTF document: missing {\\rtf signature');
      }
      const md = convertRtfToMarkdown(buffer);
      if (md.trim()) {
        return md;
      }
      return await parseOfficeWithAst(buffer, 'rtf');
    }
    case '.docx':
    case '.doc': {
      return await parseOfficeWithAst(buffer, 'docx');
    }
    case '.pdf': {
      return await parseOfficeWithAst(buffer, 'pdf');
    }
    default:
      throw new Error(`Unsupported file type: ${extension || 'unknown'}`);
  }
}

/**
 * Converts a browser File object to Markdown, delegating to in-memory convertBufferToMarkdown.
 */
export async function convertBrowserFile(file: File): Promise<BrowserConversionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const markdown = await convertBufferToMarkdown(file.name, new Uint8Array(arrayBuffer));
  return {
    fileName: file.name,
    markdown,
    outputName: markdownOutputName(file.name),
  };
}

export { convertTextToMarkdown, convertFilesParallel };
export type { FileTask, FileResult };
