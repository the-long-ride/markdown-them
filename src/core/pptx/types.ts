export interface SlideSize {
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export interface Relationship {
  target: string;
  type: string;
  external: boolean;
}

export interface ContentTypes {
  defaults: Map<string, string>;
  overrides: Map<string, string>;
}

export interface TextParagraph {
  markdown: string;
  plainText: string;
  bullet?: 'ordered' | 'unordered';
  level: number;
  maxFontSize: number;
  allBold: boolean;
}

export interface PositionedItem extends Box {
  order: number;
}

export interface TextItem extends PositionedItem {
  kind: 'text' | 'table';
  markdown: string;
  plainText?: string;
  maxFontSize?: number;
  headingLevel?: number;
  hasBullet?: boolean;
  allBold?: boolean;
  paragraphCount?: number;
}

export interface ImageItem extends PositionedItem {
  kind: 'image';
  mediaPath: string;
  mimeType: string;
  altText: string;
  name: string;
  description: string;
}

export type SlideItem = TextItem | ImageItem;

export interface ParsedSlide {
  index: number;
  size: SlideSize;
  items: SlideItem[];
}

export interface CollectorContext {
  relationships: Map<string, Relationship>;
  contentTypes: ContentTypes;
  items: SlideItem[];
  nextOrder: number;
}

export interface TextBodyInfo {
  paragraphs: TextParagraph[];
  maxFontSize: number;
  plainText: string;
  hasBullet: boolean;
  allBold: boolean;
}

export interface TextRun {
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  lineBreak?: boolean;
}

export type RenderableItem = PositionedItem &
  Partial<
    Pick<
      TextItem,
      'allBold' | 'hasBullet' | 'headingLevel' | 'maxFontSize' | 'paragraphCount' | 'plainText'
    >
  > & {
    kind: SlideItem['kind'];
    markdown: string;
  };

export const DEFAULT_SLIDE_SIZE: SlideSize = { width: 9144000, height: 5143500 };
export const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
