export {
  convertFileToMarkdown,
  convertTextToMarkdown,
  generateMarkdown,
  inferOutputPath,
} from './converters';

export {
  appendMarkdownTable,
  cleanLine,
  decodeXmlEntities,
  escapeMarkdownTableCell,
  htmlToMarkdown,
  normalizeMarkdown,
  normalizeMarkdownHeading,
  officeAstToMarkdown,
} from './markdown-utils';

export {
  ALL_SUPPORTED_EXTENSIONS,
  CONVERTIBLE_DOCUMENT_EXTENSIONS,
  DocumentConverter,
  EXTRA_DOCUMENT_EXTENSIONS,
  MARKDOWN_EXTENSIONS,
  TEXT_DOCUMENT_EXTENSIONS,
  classifyExtension,
  createDocumentConverter,
  createFailureMarkdown,
  getCachedConversionResult,
  getConversionQuality,
  getExtension,
  getFileTypeLabel,
  getMarkdownThem,
  isConvertibleDocumentFilePath,
  isExtraDocumentFilePath,
  isKnownSupportedFilePath,
  isMarkdownFilePath,
  isSupportedFilePath,
  isTextDocumentFilePath,
  normalizePreviewMarkdown,
  readMarkdownFile,
  stripKnownExtension,
} from './document-converter';

export type {
  CacheEntry,
  DocumentPreviewInfo,
  DocumentPreviewKind,
  ReadMarkdownResult,
} from './document-converter';

export { convertOdfData } from './odf';
export { convertPptxData } from './pptx';
export { convertRtfToMarkdown } from './rtf';
export { convertXlsxData } from './xlsx';
