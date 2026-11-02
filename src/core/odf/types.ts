import type JSZip from 'jszip';

export type OdfKind = 'odt' | 'odp' | 'ods';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StyleInfo {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}

export interface RenderContext {
  zip: JSZip;
  styles: Map<string, StyleInfo>;
  manifest: Map<string, string>;
  imagePageCounts: Map<string, number>;
  pageCount: number;
  pageSize: Box;
  presentationMode: boolean;
}

export interface PositionedItem extends Box {
  kind: 'image' | 'text';
  markdown: string;
  order: number;
  href?: string;
  byteLength?: number;
}

export type OrderedXmlNode = Record<string, unknown>;

export const DEFAULT_PAGE_SIZE: Box = { x: 0, y: 0, width: 10, height: 7.5 };
