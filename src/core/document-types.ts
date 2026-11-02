export type DocumentPreviewKind = 'converted' | 'text';

export interface DocumentPreviewInfo {
  readonly kind: DocumentPreviewKind;
  readonly sourceExtension: string;
  readonly sourceLabel: string;
  readonly durationMs?: number;
  readonly fromCache?: boolean;
  readonly qualityCode?: string;
  readonly qualityWarning?: string;
}

export interface ReadMarkdownResult {
  readonly markdown: string;
  readonly previewInfo: DocumentPreviewInfo | null;
}

export interface CacheEntry {
  readonly mtimeMs: number;
  readonly size: number;
  readonly markdown: string;
  readonly durationMs: number;
  readonly qualityCode?: string;
  readonly qualityWarning?: string;
}
