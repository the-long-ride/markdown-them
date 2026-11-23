import type { Box, PositionedItem } from './types';
import { comparePosition } from './geometry';
import { hasLetter, markdownHeadingLevel } from '../shared/inline';
import { groupSections } from '../shared/sections';

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/[*_~`]/g, '');
}

export function itemText(item: PositionedItem): string {
  return stripMarkdown(item.markdown).replace(/\s+/g, ' ').trim();
}

export function boldRatio(markdown: string): number {
  const stripped = stripMarkdown(markdown);
  if (!stripped) {
    return 0;
  }

  const boldText = Array.from(markdown.matchAll(/\*\*([\s\S]*?)\*\*/g))
    .map((match) => match[1])
    .join('');
  return boldText.length / stripped.length;
}

export function isSectionTitleCandidate(item: PositionedItem): boolean {
  const text = itemText(item);
  return (
    item.kind === 'text' &&
    hasLetter(text) &&
    text.length <= 120 &&
    !/^[\d\s%.,:/-]+$/.test(text) &&
    (markdownHeadingLevel(item.markdown) !== undefined || boldRatio(item.markdown) > 0.4)
  );
}

export function promotePageHeading(
  items: PositionedItem[],
  pageSize: Box,
): PositionedItem | undefined {
  const textItems = items.filter((item) => item.kind === 'text' && hasLetter(itemText(item)));
  let topItems = textItems.filter((item) => item.y <= pageSize.height * 0.32);

  if (topItems.length === 0) {
    const highestItem = [...textItems].sort((a, b) => comparePosition(a, b, pageSize))[0];
    if (!highestItem || highestItem.y > pageSize.height * 0.55) {
      return undefined;
    }

    topItems = textItems.filter((item) => item.y <= highestItem.y + pageSize.height * 0.1);
  }

  if (topItems.length === 0) {
    return undefined;
  }

  const minY = Math.min(...topItems.map((item) => item.y));
  const topBand = topItems.filter((item) => item.y <= minY + pageSize.height * 0.08);
  topBand.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > pageSize.height * 0.015) {
      return yDiff;
    }

    return b.width - a.width || comparePosition(a, b, pageSize);
  });

  const heading = topBand[0];
  if (heading && markdownHeadingLevel(heading.markdown) === undefined) {
    heading.markdown = `## ${heading.markdown}`;
  }

  return heading;
}

export function groupPositionedSections(
  items: PositionedItem[],
  pageSize: Box,
  pageHeading?: PositionedItem,
): PositionedItem[] {
  const textItems = items.filter((item) => item.kind === 'text' && hasLetter(itemText(item)));
  const titles = textItems.filter((item) => item !== pageHeading && isSectionTitleCandidate(item));
  return groupSections(
    items,
    textItems,
    titles,
    pageSize,
    (a, b) => comparePosition(a, b, pageSize),
    pageHeading,
  );
}

export function structurePositionedText(items: PositionedItem[], pageSize: Box): PositionedItem[] {
  const structuredItems = items.map((item) => ({ ...item }));
  const heading = promotePageHeading(structuredItems, pageSize);
  return groupPositionedSections(structuredItems, pageSize, heading);
}
