import { restoreWorker } from './polyfill';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as mammoth from 'mammoth';
import {
  convertTextToMarkdown,
  htmlToMarkdown,
  normalizeMarkdown,
  officeAstToMarkdown,
} from './markdown-utils';
import { convertOdfData } from './odf';
import { convertPptxData } from './pptx';
import { convertRtfToMarkdown } from './rtf';
import { convertXlsxData } from './xlsx';

const pdf2md = require('@opendocsg/pdf2md');
const officeParser = require('officeparser');

restoreWorker();

const ZERO_BYTE_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.text',
  '.md',
  '.markdown',
  '.mdx',
  '.html',
  '.htm',
]);

export async function generateMarkdown(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  const stat = await fs.stat(filePath);
  if (stat.size === 0) {
    if (ZERO_BYTE_TEXT_EXTENSIONS.has(ext)) {
      return '';
    }
    throw new Error(
      `Cannot convert empty ${ext || path.basename(filePath)} file: file is zero bytes`,
    );
  }

  const raw = await convertByExtension(filePath, ext);
  return normalizeMarkdown(raw);
}

async function convertByExtension(filePath: string, ext: string): Promise<string> {
  switch (ext) {
    case '.doc': {
      try {
        const md = await runWithRenamedExtension(filePath, '.docx');
        if (md.trim()) {
          return md;
        }
      } catch {
        // Fall back to officeparser for binary Compound Document / CFB format
      }
      return await convertOfficeFallback(filePath);
    }
    case '.docx': {
      try {
        const result = await mammoth.convertToHtml({ path: filePath });
        const md = htmlToMarkdown(result.value);
        if (md.trim()) {
          return md;
        }
      } catch {
        // Fall back to officeparser for complex or corrupted docx
      }
      return await convertOfficeFallback(filePath);
    }
    case '.xls':
    case '.xlm': {
      try {
        const md = await runWithRenamedExtension(filePath, '.xlsx');
        if (md.trim()) {
          return md;
        }
      } catch {
        // Fall back to officeparser for binary Compound Document XLS format
      }
      return await convertOfficeFallback(filePath);
    }
    case '.html':
    case '.htm': {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      return htmlToMarkdown(htmlContent);
    }
    case '.txt':
    case '.text':
    case '.md':
    case '.markdown':
    case '.mdx': {
      const textContent = await fs.readFile(filePath, 'utf-8');
      return convertTextToMarkdown(textContent);
    }
    case '.pdf': {
      try {
        const dataBuffer = await fs.readFile(filePath);
        try {
          const md = await pdf2md(dataBuffer);
          if (md && md.trim()) {
            return md;
          }
        } catch {
          // Fall through to convertOfficeFallback
        } finally {
          delete (globalThis as any).pdfjsWorker;
          delete (globalThis as any).pdfjsLib;
        }
        return await convertOfficeFallback(filePath);
      } finally {
        delete (globalThis as any).pdfjsWorker;
        delete (globalThis as any).pdfjsLib;
      }
    }
    case '.xlsx': {
      try {
        const md = await convertXlsx(filePath);
        if (md.trim()) {
          return md;
        }
      } catch {
        // Fall through to convertOfficeFallback
      }
      return await convertOfficeFallback(filePath);
    }
    case '.pptx': {
      const data = await fs.readFile(filePath);
      try {
        const md = await convertPptxData(data);
        if (md.trim()) {
          return md;
        }
      } catch {
        // Fall through to convertOfficeFallback
      }
      return await convertOfficeFallback(filePath);
    }
    case '.odt':
    case '.odp':
    case '.ods':
      return await convertOdf(filePath, ext.slice(1) as 'odt' | 'odp' | 'ods');
    case '.rtf':
      return await convertRtf(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

export { convertTextToMarkdown };

export async function convertFileToMarkdown(
  filePath: string,
  outputPath?: string,
): Promise<string> {
  const mdContent = await generateMarkdown(filePath);

  if (!outputPath) {
    outputPath = inferOutputPath(filePath);
  }

  await fs.writeFile(outputPath, mdContent, 'utf-8');
  return outputPath;
}

export function inferOutputPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);
  const lowerExt = ext.toLowerCase();
  const isMarkdown = lowerExt === '.md' || lowerExt === '.markdown' || lowerExt === '.mdx';
  return path.join(dir, isMarkdown ? `${basename}_converted.md` : `${basename}.md`);
}

async function convertXlsx(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return convertXlsxData(data);
}

async function convertOdf(filePath: string, kind: 'odt' | 'odp' | 'ods'): Promise<string> {
  const data = await fs.readFile(filePath);

  try {
    const markdown = await convertOdfData(data, kind);
    if (markdown.trim()) {
      return markdown;
    }
  } catch {
    // Fall through to the generic Office parser for unusual OpenDocument files.
  }

  return convertOfficeFallback(filePath);
}

async function convertRtf(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  const text = data.toString('utf8');
  if (!text.trimStart().startsWith('{\\rtf')) {
    throw new Error('Invalid RTF document: missing {\\rtf signature');
  }

  const markdown = convertRtfToMarkdown(data);
  if (markdown.trim()) {
    return markdown;
  }

  return convertOfficeFallback(filePath);
}

async function convertOfficeFallback(filePath: string): Promise<string> {
  const officeResult: unknown = await officeParser.parseOffice(filePath);
  return officeAstToMarkdown(officeResult as any);
}

async function runWithRenamedExtension(filePath: string, newExt: string): Promise<string> {
  const tempDir = os.tmpdir();
  const randomId = Math.random().toString(36).substring(2, 15);
  const tempFilePath = path.join(tempDir, `temp_${randomId}${newExt}`);
  try {
    await fs.copyFile(filePath, tempFilePath);
    return await generateMarkdown(tempFilePath);
  } finally {
    await fs.rm(tempFilePath, { force: true }).catch(() => {});
  }
}
