import type JSZip from 'jszip';
import type { CollectorContext, ContentTypes, ParsedSlide, SlideSize, Transform } from './types';
import { IDENTITY_TRANSFORM } from './types';
import { parseXml, readAnyAttr, readAttr, toArray } from './xml';
import { dirname, readRelationships, readZipText, relationshipsPathForPart } from './package';
import { applyTransform, composeGroupTransform, readElementBox } from './geometry';
import { formatTextBody, inferHeadingLevel, normalizeInlineText, readTextBody } from './text';
import { readTableMarkdown } from './table';
import { isImagePart, mimeTypeForPart, preferredAltText } from './image';

export function collectPicture(
  picture: any,
  context: CollectorContext,
  transform: Transform,
): void {
  const relId = readAnyAttr(picture?.blipFill?.blip, ['r:embed', 'embed']);
  const relationship = relId ? context.relationships.get(relId) : undefined;

  if (!relationship || relationship.external || !isImagePart(relationship.target)) {
    return;
  }

  const nonVisualProps = picture?.nvPicPr?.cNvPr;
  const name = normalizeInlineText(readAttr(nonVisualProps, 'name') || '');
  const description = normalizeInlineText(readAttr(nonVisualProps, 'descr') || '');
  const altText = preferredAltText(name, description);

  context.items.push({
    kind: 'image',
    mediaPath: relationship.target,
    mimeType: mimeTypeForPart(context.contentTypes, relationship.target),
    altText,
    name,
    description,
    order: context.nextOrder++,
    ...applyTransform(transform, readElementBox(picture?.spPr?.xfrm)),
  });
}

export function collectGraphicFrame(
  frame: any,
  context: CollectorContext,
  transform: Transform,
): void {
  const tableMarkdown = readTableMarkdown(frame);
  if (!tableMarkdown) {
    return;
  }

  context.items.push({
    kind: 'table',
    markdown: tableMarkdown,
    order: context.nextOrder++,
    ...applyTransform(transform, readElementBox(frame?.xfrm)),
  });
}

export function collectTextShape(
  shape: any,
  context: CollectorContext,
  transform: Transform,
): void {
  const textBody = readTextBody(shape?.txBody);
  if (textBody.paragraphs.length === 0) {
    return;
  }

  const headingLevel = inferHeadingLevel(shape, textBody);
  const markdown = formatTextBody(textBody.paragraphs, headingLevel);
  if (!markdown.trim()) {
    return;
  }

  context.items.push({
    kind: 'text',
    markdown,
    plainText: textBody.plainText,
    maxFontSize: textBody.maxFontSize,
    headingLevel,
    hasBullet: textBody.hasBullet,
    allBold: textBody.allBold,
    paragraphCount: textBody.paragraphs.length,
    order: context.nextOrder++,
    ...applyTransform(transform, readElementBox(shape?.spPr?.xfrm)),
  });
}

export function collectGroup(group: any, context: CollectorContext, transform: Transform): void {
  const groupTransform = composeGroupTransform(transform, group?.grpSpPr?.xfrm);
  collectShapeTree(group, context, groupTransform);
}

export function collectShapeTree(
  shapeTree: any,
  context: CollectorContext,
  transform: Transform,
): void {
  if (!shapeTree || typeof shapeTree !== 'object') {
    return;
  }

  for (const [tagName, value] of Object.entries(shapeTree)) {
    if (tagName.startsWith('@_') || tagName === '#text') {
      continue;
    }

    switch (tagName) {
      case 'sp':
        toArray(value).forEach((shape) => collectTextShape(shape, context, transform));
        break;
      case 'pic':
        toArray(value).forEach((picture) => collectPicture(picture, context, transform));
        break;
      case 'graphicFrame':
        toArray(value).forEach((frame) => collectGraphicFrame(frame, context, transform));
        break;
      case 'grpSp':
        toArray(value).forEach((group) => collectGroup(group, context, transform));
        break;
      default:
        break;
    }
  }
}

export async function readSlide(
  zip: JSZip,
  slidePath: string,
  slideIndex: number,
  slideSize: SlideSize,
  contentTypes: ContentTypes,
): Promise<ParsedSlide | undefined> {
  const slideXml = await readZipText(zip, slidePath);

  if (!slideXml) {
    return undefined;
  }

  const relationships = await readRelationships(
    zip,
    relationshipsPathForPart(slidePath),
    dirname(slidePath),
  );
  const slide = parseXml(slideXml, slidePath)?.sld;
  const spTree = slide?.cSld?.spTree;
  const context: CollectorContext = {
    relationships,
    contentTypes,
    items: [],
    nextOrder: 0,
  };

  collectShapeTree(spTree, context, IDENTITY_TRANSFORM);

  return {
    index: slideIndex,
    size: slideSize,
    items: context.items,
  };
}
