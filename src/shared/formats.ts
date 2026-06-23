export const SUPPORTED_FILE_EXTENSIONS = [
  ".docx",
  ".doc",
  ".pdf",
  ".html",
  ".htm",
  ".xlsx",
  ".xls",
  ".xlm",
  ".pptx",
  ".odt",
  ".odp",
  ".ods",
  ".rtf",
] as const;

export const WEB_DIRECT_FILE_EXTENSIONS = [".html", ".htm", ".md", ".markdown", ".txt", ".xlsx", ".xls", ".xlm"] as const;

export const WEB_OFFICE_FILE_EXTENSIONS = [".docx", ".doc", ".pdf", ".pptx", ".odt", ".odp", ".ods", ".rtf"] as const;

export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function isSupportedFileName(fileName: string): boolean {
  return SUPPORTED_FILE_EXTENSIONS.includes(getFileExtension(fileName) as (typeof SUPPORTED_FILE_EXTENSIONS)[number]);
}

export function markdownOutputName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName || "converted";
  return getFileExtension(fileName) === ".md" ? `${baseName}_converted.md` : `${baseName}.md`;
}
