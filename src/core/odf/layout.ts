import type { Box, PositionedItem } from './types';
import { centerX, comparePosition, isSameVisualColumn, unionBoxes } from './geometry';
import { hasLetter } from './styles';

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

export function markdownHeadingLevel(markdown: string): number | undefined {
  const match = markdown.match(/^(#{1,6})\s+/);
  return match ? match[1].length : undefined;
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

export function findNearestTitle(
  body: PositionedItem,
  titles: PositionedItem[],
  pageSize: Box,
): PositionedItem | undefined {
  const candidates = titles
    .filter((title) => {
      if (body.y < title.y + Math.min(title.height * 0.45, pageSize.height * 0.035)) {
        return false;
      }

      const verticalGap = Math.max(0, body.y - (title.y + title.height));
      if (verticalGap > pageSize.height * 0.16 || !isSameVisualColumn(title, body)) {
        return false;
      }

      return !titles.some(
        (otherTitle) =>
          otherTitle !== title &&
          otherTitle.y > title.y &&
          otherTitle.y < body.y &&
          isSameVisualColumn(otherTitle, body),
      );
    })
    .map((title) => ({
      title,
      centerDistance: Math.abs(centerX(title) - centerX(body)),
      verticalGap: Math.max(0, body.y - (title.y + title.height)),
    }));

  candidates.sort((a, b) => a.verticalGap - b.verticalGap || a.centerDistance - b.centerDistance);
  return candidates[0]?.title;
}

export function combineSection(title: PositionedItem, bodies: PositionedItem[]): PositionedItem {
  const allItems = [title, ...bodies];
  const bounds = unionBoxes(allItems);

  return {
    ...title,
    markdown: allItems
      .map((item) => item.markdown)
      .filter(Boolean)
      .join('\n\n'),
    x: bounds.x,
    y: title.y,
    width: bounds.width,
    height: Math.max(title.height, bounds.y + bounds.height - title.y),
    order: Math.min(...allItems.map((item) => item.order)),
  };
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
  const titleSet = new Set(titles);
  const assignments = new Map<PositionedItem, PositionedItem[]>();

  for (const body of textItems) {
    if (body === pageHeading || titleSet.has(body)) {
      continue;
    }

    const title = findNearestTitle(body, titles, pageSize);
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

  const consumed = new Set<PositionedItem>();
  const grouped: PositionedItem[] = [];

  for (const item of items) {
    if (consumed.has(item)) {
      continue;
    }

    const bodies = assignments.get(item);
    if (bodies?.length) {
      bodies.sort((a, b) => comparePosition(a, b, pageSize));
      bodies.forEach((body) => consumed.add(body));
      grouped.push(combineSection(item, bodies));
      continue;
    }

    grouped.push(item);
  }

  return grouped;
}

export function structurePositionedText(items: PositionedItem[], pageSize: Box): PositionedItem[] {
  const structuredItems = items.map((item) => ({ ...item }));
  const heading = promotePageHeading(structuredItems, pageSize);
  return groupPositionedSections(structuredItems, pageSize, heading);
}
