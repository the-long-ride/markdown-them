import type JSZip from 'jszip';
import type { CollectorContext, ContentTypes, ParsedSlide, SlideSize, Transform } from './types';
import { IDENTITY_TRANSFORM } from './types';
import { parseXml, readAnyAttr, readAttr, toArray } from './xml';
import { dirname, readRelationships, readZipText, relationshipsPathForPart } from './package';
import { applyTransform, composeGroupTransform, readElementBox } from './geometry';
import { formatTextBody, inferHeadingLevel, normalizeInlineText, readTextBody } from './text';
import { readTableMarkdown } from './table';
import { isImagePart, mimeTypeForPart, preferredAltText } from './image';

type SlideCollectorContext = CollectorContext & { zip: JSZip };

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

async function readDiagramMarkdown(frame: any, context: SlideCollectorContext): Promise<string> {
  const id = readAnyAttr(frame?.graphic?.graphicData?.relIds, ['r:dm', 'dm']);
  const relationship = id ? context.relationships.get(id) : undefined;
  if (!relationship || relationship.external || !relationship.type.endsWith('/diagramData')) {
    return '';
  }

  const xml = await readZipText(context.zip, relationship.target);
  if (!xml) {
    return '';
  }

  const points = toArray(parseXml(xml, relationship.target)?.dataModel?.ptLst?.pt);
  return points
    .filter((point) => {
      const type = readAttr(point, 'type') ?? 'node';
      return type === 'node' || type === 'asst';
    })
    .map((point) => formatTextBody(readTextBody(point?.t).paragraphs))
    .filter(Boolean)
    .join('\n\n');
}

export async function collectGraphicFrame(
  frame: any,
  context: SlideCollectorContext,
  transform: Transform,
): Promise<void> {
  const tableMarkdown = readTableMarkdown(frame);
  const markdown = tableMarkdown ?? (await readDiagramMarkdown(frame, context));
  if (!markdown) {
    return;
  }

  context.items.push({
    kind: tableMarkdown ? 'table' : 'diagram',
    markdown,
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

export async function collectGroup(
  group: any,
  context: SlideCollectorContext,
  transform: Transform,
): Promise<void> {
  const groupTransform = composeGroupTransform(transform, group?.grpSpPr?.xfrm);
  await collectShapeTree(group, context, groupTransform);
}

export async function collectShapeTree(
  shapeTree: any,
  context: SlideCollectorContext,
  transform: Transform,
): Promise<void> {
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
        for (const frame of toArray(value)) {
          await collectGraphicFrame(frame, context, transform);
        }
        break;
      case 'grpSp':
        for (const group of toArray(value)) {
          await collectGroup(group, context, transform);
        }
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
  const context: SlideCollectorContext = {
    zip,
    relationships,
    contentTypes,
    items: [],
    nextOrder: 0,
  };

  await collectShapeTree(spTree, context, IDENTITY_TRANSFORM);

  return {
    index: slideIndex,
    size: slideSize,
    items: context.items,
  };
}
