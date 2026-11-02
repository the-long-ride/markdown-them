import {
  convertTextToMarkdown,
  convertFileToMarkdown as convertFromPath,
  generateMarkdown,
  inferOutputPath,
  DocumentConverter,
  createDocumentConverter,
  MARKDOWN_EXTENSIONS,
  TEXT_DOCUMENT_EXTENSIONS,
  CONVERTIBLE_DOCUMENT_EXTENSIONS,
  EXTRA_DOCUMENT_EXTENSIONS,
  ALL_SUPPORTED_EXTENSIONS,
  getExtension,
  isMarkdownFilePath,
  isTextDocumentFilePath,
  isConvertibleDocumentFilePath,
  isExtraDocumentFilePath,
  isSupportedFilePath,
  isKnownSupportedFilePath,
  stripKnownExtension,
  getFileTypeLabel,
  classifyExtension,
  normalizePreviewMarkdown,
  createFailureMarkdown,
  getCachedConversionResult,
  getConversionQuality,
  getMarkdownThem,
  readMarkdownFile,
  appendMarkdownTable,
  cleanLine,
  decodeXmlEntities,
  escapeMarkdownTableCell,
  htmlToMarkdown,
  normalizeMarkdown,
  normalizeMarkdownHeading,
  officeAstToMarkdown,
  convertOdfData,
  convertPptxData,
  convertRtfToMarkdown,
  convertXlsxData,
} from '../core';
import type {
  CacheEntry,
  DocumentPreviewInfo,
  DocumentPreviewKind,
  ReadMarkdownResult,
} from '../core';
import {
  convertDirectory,
  convertSingleFile,
  parseCliArgs,
  isSupportedFileName,
  SUPPORTED_EXTENSIONS,
  BatchStats,
  CliOptions,
} from './cli';

export interface ConvertOptions {
  outputPath?: string;
}

export async function convertFileToMarkdown(
  filePath: string,
  options: ConvertOptions = {},
): Promise<string> {
  return convertFromPath(filePath, options.outputPath);
}

export async function convertAndReturnMarkdown(filePath: string): Promise<string> {
  return generateMarkdown(filePath);
}

export {
  convertTextToMarkdown,
  generateMarkdown,
  inferOutputPath,
  convertDirectory,
  convertSingleFile,
  parseCliArgs,
  isSupportedFileName,
  SUPPORTED_EXTENSIONS,
  BatchStats,
  CliOptions,
  DocumentConverter,
  createDocumentConverter,
  MARKDOWN_EXTENSIONS,
  TEXT_DOCUMENT_EXTENSIONS,
  CONVERTIBLE_DOCUMENT_EXTENSIONS,
  EXTRA_DOCUMENT_EXTENSIONS,
  ALL_SUPPORTED_EXTENSIONS,
  getExtension,
  isMarkdownFilePath,
  isTextDocumentFilePath,
  isConvertibleDocumentFilePath,
  isExtraDocumentFilePath,
  isSupportedFilePath,
  isKnownSupportedFilePath,
  stripKnownExtension,
  getFileTypeLabel,
  classifyExtension,
  normalizePreviewMarkdown,
  createFailureMarkdown,
  getCachedConversionResult,
  getConversionQuality,
  getMarkdownThem,
  readMarkdownFile,
  appendMarkdownTable,
  cleanLine,
  decodeXmlEntities,
  escapeMarkdownTableCell,
  htmlToMarkdown,
  normalizeMarkdown,
  normalizeMarkdownHeading,
  officeAstToMarkdown,
  convertOdfData,
  convertPptxData,
  convertRtfToMarkdown,
  convertXlsxData,
};

export type { CacheEntry, DocumentPreviewInfo, DocumentPreviewKind, ReadMarkdownResult };
