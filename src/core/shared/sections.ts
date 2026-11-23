import type { PositionedBox, Size } from './geometry';
import { centerX, isSameVisualColumn, unionBoxes } from './geometry';

export interface SectionItem extends PositionedBox {
  markdown: string;
}

export function isBodyBelowTitle<T extends PositionedBox>(
  body: T,
  title: T,
  titles: T[],
  size: Size,
): boolean {
  if (body.y < title.y + Math.min(title.height * 0.45, size.height * 0.035)) {
    return false;
  }

  const verticalGap = Math.max(0, body.y - (title.y + title.height));
  if (verticalGap > size.height * 0.16 || !isSameVisualColumn(title, body)) {
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

export interface TitleCandidate<T> {
  title: T;
  centerDistance: number;
  verticalGap: number;
}

export type CandidateComparator = <T>(a: TitleCandidate<T>, b: TitleCandidate<T>) => number;

/** A NaN gap falls through to center distance. */
export const compareByGapThenCenter: CandidateComparator = (a, b) =>
  a.verticalGap - b.verticalGap || a.centerDistance - b.centerDistance;

/** A NaN gap (overflowed coordinates) returns NaN, so sort keeps document order. */
export const compareByGapStrict: CandidateComparator = (a, b) => {
  const gapDiff = a.verticalGap - b.verticalGap;
  if (gapDiff !== 0) {
    return gapDiff;
  }

  return a.centerDistance - b.centerDistance;
};

export function findNearestTitle<T extends PositionedBox>(
  body: T,
  titles: T[],
  size: Size,
  compareCandidates: CandidateComparator = compareByGapThenCenter,
): T | undefined {
  const candidates = titles
    .filter((title) => isBodyBelowTitle(body, title, titles, size))
    .map((title) => ({
      title,
      centerDistance: Math.abs(centerX(title) - centerX(body)),
      verticalGap: Math.max(0, body.y - (title.y + title.height)),
    }));

  candidates.sort(compareCandidates);
  return candidates[0]?.title;
}

export function combineSection<T extends SectionItem>(title: T, bodies: T[]): T {
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

/** Merges each body text item into the nearest section title above it. */
export function groupSections<T extends SectionItem>(
  items: T[],
  textItems: T[],
  titles: T[],
  size: Size,
  compare: (a: T, b: T) => number,
  heading?: T,
  compareCandidates?: CandidateComparator,
): T[] {
  const titleSet = new Set(titles);
  const assignments = new Map<T, T[]>();

  for (const body of textItems) {
    if (body === heading || titleSet.has(body)) {
      continue;
    }

    const title = findNearestTitle(body, titles, size, compareCandidates);
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

  const consumed = new Set<T>();
  const grouped: T[] = [];

  for (const item of items) {
    if (consumed.has(item)) {
      continue;
    }

    const bodies = assignments.get(item);
    if (bodies?.length) {
      bodies.sort(compare);
      bodies.forEach((body) => consumed.add(body));
      grouped.push(combineSection(item, bodies));
      continue;
    }

    grouped.push(item);
  }

  return grouped;
}
