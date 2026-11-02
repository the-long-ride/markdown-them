import type { RenderableItem, SlideSize } from './types';
import { centerX, comparePosition, isSameVisualColumn, unionBoxes } from './geometry';
import { hasLetter, hasLetterOrNumber } from './text';

export function stripMarkdownHeading(markdown: string): string {
  return markdown.replace(/^#{1,6}\s+/, '').trim();
}

export function stripMarkdownInline(markdown: string): string {
  return stripMarkdownHeading(markdown)
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/[*_~`]/g, '')
    .trim();
}

export function markdownHeadingLevel(markdown: string): number | undefined {
  const match = markdown.match(/^(#{1,6})\s+/);
  return match ? match[1].length : undefined;
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

export function isBodyBelowTitle(
  body: RenderableItem,
  title: RenderableItem,
  titles: RenderableItem[],
  slideSize: SlideSize,
): boolean {
  if (body.y < title.y + Math.min(title.height * 0.45, slideSize.height * 0.035)) {
    return false;
  }

  const verticalGap = Math.max(0, body.y - (title.y + title.height));
  if (verticalGap > slideSize.height * 0.16) {
    return false;
  }

  if (!isSameVisualColumn(title, body)) {
    return false;
  }

  return !titles.some(
    (otherTitle) =>
      otherTitle !== title &&
      otherTitle.y > title.y &&
      otherTitle.y < body.y &&
      isSameVisualColumn(otherTitle, body),
  );
}

export function findNearestSectionTitle(
  body: RenderableItem,
  titles: RenderableItem[],
  slideSize: SlideSize,
): RenderableItem | undefined {
  const candidates = titles
    .filter((title) => isBodyBelowTitle(body, title, titles, slideSize))
    .map((title) => ({
      title,
      centerDistance: Math.abs(centerX(title) - centerX(body)),
      verticalGap: Math.max(0, body.y - (title.y + title.height)),
    }));

  candidates.sort((a, b) => {
    const gapDiff = a.verticalGap - b.verticalGap;
    if (gapDiff !== 0) {
      return gapDiff;
    }

    return a.centerDistance - b.centerDistance;
  });

  return candidates[0]?.title;
}

export function combineSectionTextItem(
  title: RenderableItem,
  bodies: RenderableItem[],
): RenderableItem {
  const sectionItems = [title, ...bodies];
  const bounds = unionBoxes(sectionItems);

  return {
    ...title,
    markdown: sectionItems
      .map((item) => item.markdown)
      .filter(Boolean)
      .join('\n\n'),
    x: bounds.x,
    y: title.y,
    width: bounds.width,
    height: Math.max(title.height, bounds.y + bounds.height - title.y),
    order: Math.min(...sectionItems.map((item) => item.order)),
  };
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

  if (titles.length === 0) {
    return items;
  }

  const titleSet = new Set(titles);
  const assignments = new Map<RenderableItem, RenderableItem[]>();

  for (const body of textItems) {
    if (body === slideHeading || titleSet.has(body)) {
      continue;
    }

    const title = findNearestSectionTitle(body, titles, slideSize);
    if (!title) {
      continue;
    }

    const bodies = assignments.get(title) || [];
    bodies.push(body);
    assignments.set(title, bodies);
  }

  if (assignments.size === 0) {
    return items;
  }

  const consumed = new Set<RenderableItem>();
  const groupedItems: RenderableItem[] = [];

  for (const item of items) {
    if (consumed.has(item)) {
      continue;
    }

    const sectionBodies = assignments.get(item);
    if (sectionBodies && sectionBodies.length > 0) {
      sectionBodies.sort((a, b) => comparePosition(a, b, slideSize));
      sectionBodies.forEach((body) => consumed.add(body));
      groupedItems.push(combineSectionTextItem(item, sectionBodies));
      continue;
    }

    groupedItems.push(item);
  }

  return groupedItems;
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
