import JSZip from 'jszip';
import { normalizeMarkdown } from './markdown-utils';
import type { ParsedSlide } from './pptx/types';
import { parseXml, readAttr, toArray } from './pptx/xml';
import { readSlideSize } from './pptx/geometry';
import { readContentTypes, readRelationships, readZipText } from './pptx/package';
import { readSlide } from './pptx/collector';
import { renderSlides } from './pptx/renderer';

export type {
  Box,
  CollectorContext,
  ContentTypes,
  ImageItem,
  ParsedSlide,
  PositionedItem,
  Relationship,
  RenderableItem,
  SlideItem,
  SlideSize,
  TextBodyInfo,
  TextItem,
  TextParagraph,
  TextRun,
  Transform,
} from './pptx/types';

export async function convertPptxData(data: ArrayBuffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const presentationXml = await readZipText(zip, 'ppt/presentation.xml');

  if (!presentationXml) {
    throw new Error('Invalid PPTX file: missing ppt/presentation.xml');
  }

  const presentation = parseXml(presentationXml, 'ppt/presentation.xml')?.presentation;
  const slideSize = readSlideSize(presentation?.sldSz);
  const contentTypes = await readContentTypes(zip);
  const presentationRelationships = await readRelationships(
    zip,
    'ppt/_rels/presentation.xml.rels',
    'ppt',
  );
  const slideRefs = toArray(presentation?.sldIdLst?.sldId);
  const slides: ParsedSlide[] = [];

  for (const [index, slideRef] of slideRefs.entries()) {
    const relationshipId =
      readAttr(slideRef, 'r:id') ||
      readAttr(slideRef, 'id') ||
      readAttr(slideRef, 'r:Id') ||
      readAttr(slideRef, 'Id');
    const relationship = relationshipId ? presentationRelationships.get(relationshipId) : undefined;

    if (!relationship || relationship.external) {
      continue;
    }

    const slide = await readSlide(zip, relationship.target, index + 1, slideSize, contentTypes);
    if (slide) {
      slides.push(slide);
    }
  }

  return normalizeMarkdown(await renderSlides(zip, slides));
}
