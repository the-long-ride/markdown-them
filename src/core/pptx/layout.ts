import type { RenderableItem, SlideSize } from './types';
import { comparePosition } from './geometry';
import { hasLetterOrNumber } from './text';
import { hasLetter, markdownHeadingLevel } from '../shared/inline';
import { groupSections } from '../shared/sections';

export function stripMarkdownHeading(markdown: string): string {
  return markdown.replace(/^#{1,6}\s+/, '').trim();
}

export function stripMarkdownInline(markdown: string): string {
  return stripMarkdownHeading(markdown)
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/[*_~`]/g, '')
    .trim();
}

export function itemTextContent(item: RenderableItem): string {
  return (item.plainText || stripMarkdownInline(item.markdown)).replace(/\s+/g, ' ').trim();
}

export function isMeaningfulTextItem(item: RenderableItem): boolean {
  const text = itemTextContent(item);
  return hasLetterOrNumber(text) && !/^[\s\-–—•·|]+$/.test(text);
}

export function isShapeTextItem(item: RenderableItem): boolean {
  return item.kind === 'text';
}

export function isSectionTitleCandidate(item: RenderableItem): boolean {
  const text = itemTextContent(item);

  if (
    !text ||
    !hasLetter(text) ||
    item.kind !== 'text' ||
    item.hasBullet ||
    (item.paragraphCount || 1) > 2 ||
    text.length > 120
  ) {
    return false;
  }

  const headingLevel = markdownHeadingLevel(item.markdown);
  if (headingLevel !== undefined && headingLevel >= 3) {
    return true;
  }

  return Boolean(item.allBold || (item.maxFontSize || 0) >= 1700);
}

export function findSlideHeading(
  items: RenderableItem[],
  slideSize: SlideSize,
): RenderableItem | undefined {
  const textItems = items.filter((item) => isShapeTextItem(item) && isMeaningfulTextItem(item));
  const topLimit = slideSize.height * 0.32;
  let topItems = textItems.filter((item) => item.y <= topLimit);

  if (topItems.length === 0) {
    const highestItem = [...textItems].sort((a, b) => comparePosition(a, b, slideSize))[0];
    if (
      !highestItem ||
      highestItem.y > slideSize.height * 0.55 ||
      (highestItem.maxFontSize || 0) < 2400
    ) {
      return undefined;
    }

    topItems = textItems.filter((item) => item.y <= highestItem.y + slideSize.height * 0.1);
  }

  const minY = Math.min(...topItems.map((item) => item.y));
  const topBand = topItems.filter((item) => item.y <= minY + slideSize.height * 0.08);

  topBand.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > slideSize.height * 0.015) {
      return yDiff;
    }

    const fontDiff = (b.maxFontSize || 0) - (a.maxFontSize || 0);
    if (fontDiff !== 0) {
      return fontDiff;
    }

    const widthDiff = b.width - a.width;
    if (widthDiff !== 0) {
      return widthDiff;
    }

    return comparePosition(a, b, slideSize);
  });

  return topBand[0];
}

export function promoteSlideHeading(
  items: RenderableItem[],
  slideSize: SlideSize,
): RenderableItem | undefined {
  const heading = findSlideHeading(items, slideSize);
  if (!heading) {
    return undefined;
  }

  const level = markdownHeadingLevel(heading.markdown);
  if (level === undefined || level > 2) {
    heading.markdown = `## ${stripMarkdownHeading(heading.markdown)}`;
    heading.headingLevel = 2;
  }

  return heading;
}

export function normalizeNonSlideHeadings(
  items: RenderableItem[],
  slideHeading: RenderableItem | undefined,
  slideSize: SlideSize,
): void {
  for (const item of items) {
    if (item === slideHeading || !isShapeTextItem(item)) {
      continue;
    }

    const headingLevel = markdownHeadingLevel(item.markdown);
    if (headingLevel === undefined || headingLevel > 2) {
      continue;
    }

    if (slideHeading && item.y <= slideHeading.y + slideSize.height * 0.18) {
      continue;
    }

    const content = stripMarkdownHeading(item.markdown);
    if (isSectionTitleCandidate({ ...item, markdown: content, headingLevel: undefined })) {
      item.markdown = `### ${content}`;
      item.headingLevel = 3;
      continue;
    }

    item.markdown = content;
    item.headingLevel = undefined;
  }
}

export function groupSectionTextItems(
  items: RenderableItem[],
  slideSize: SlideSize,
  slideHeading?: RenderableItem,
): RenderableItem[] {
  const textItems = items.filter((item) => isShapeTextItem(item) && isMeaningfulTextItem(item));
  const titles = textItems.filter((item) => item !== slideHeading && isSectionTitleCandidate(item));

  return groupSections(
    items,
    textItems,
    titles,
    slideSize,
    (a, b) => comparePosition(a, b, slideSize),
    slideHeading,
  );
}

export function structureTextItems(
  items: RenderableItem[],
  slideSize: SlideSize,
): RenderableItem[] {
  const structuredItems = items.map((item) => ({ ...item }));
  const slideHeading = promoteSlideHeading(structuredItems, slideSize);
  normalizeNonSlideHeadings(structuredItems, slideHeading, slideSize);
  return groupSectionTextItems(structuredItems, slideSize, slideHeading);
}
