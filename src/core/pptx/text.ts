import type { TextBodyInfo, TextParagraph, TextRun } from './types';
import {
  clampInteger,
  isStruck,
  isTruthy,
  readAttr,
  readNumberAttr,
  textValue,
  toArray,
} from './xml';

export function readFontSize(runProperties: any): number {
  return readNumberAttr(runProperties, 'sz');
}

export function readPlaceholderType(shape: any): string {
  return String(readAttr(shape?.nvSpPr?.nvPr?.ph, 'type') || '');
}

export function readBulletKind(paragraphProperties: any): 'ordered' | 'unordered' | undefined {
  if (!paragraphProperties || paragraphProperties.buNone) {
    return undefined;
  }
  if (paragraphProperties.buAutoNum) {
    return 'ordered';
  }
  if (paragraphProperties.buChar) {
    return 'unordered';
  }

  return undefined;
}

export function wrapMarkdown(value: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match || !match[2]) {
    return value;
  }

  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

export function normalizeInlineText(value: string): string {
  return value.replace(/\r\n|\r/g, '\n').replace(/\u000b/g, '\n');
}

export function normalizeParagraphText(value: string): string {
  return normalizeInlineText(value)
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

export function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

export function hasLetterOrNumber(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

export function canMergeRuns(left: TextRun, right: TextRun): boolean {
  return (
    !left.lineBreak &&
    !right.lineBreak &&
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.strikethrough === right.strikethrough
  );
}

export function formatRun(run: TextRun): string {
  if (run.lineBreak) {
    return '\n';
  }

  let markdown = run.text;
  if (run.bold) {
    markdown = wrapMarkdown(markdown, '**');
  }
  if (run.italic) {
    markdown = wrapMarkdown(markdown, '*');
  }
  if (run.strikethrough) {
    markdown = wrapMarkdown(markdown, '~~');
  }

  return markdown;
}

export function mergeAdjacentRuns(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = [];

  for (const run of runs) {
    const previous = merged[merged.length - 1];

    if (previous && canMergeRuns(previous, run)) {
      previous.text += run.text;
      previous.fontSize = Math.max(previous.fontSize, run.fontSize);
      continue;
    }

    merged.push({ ...run });
  }

  return merged;
}

export function formatRuns(runs: TextRun[]): string {
  return mergeAdjacentRuns(runs).map(formatRun).join('');
}

export function readRun(run: any): TextRun {
  const text = normalizeInlineText(textValue(run?.t));
  const runProperties = run?.rPr;

  return {
    text,
    fontSize: readFontSize(runProperties),
    bold: isTruthy(readAttr(runProperties, 'b')),
    italic: isTruthy(readAttr(runProperties, 'i')),
    strikethrough: isStruck(runProperties),
  };
}

export function readParagraph(paragraph: any): TextParagraph | undefined {
  if (!paragraph || typeof paragraph !== 'object') {
    return undefined;
  }

  const runs: TextRun[] = [];

  for (const [tagName, value] of Object.entries(paragraph)) {
    switch (tagName) {
      case 'r':
        toArray(value).forEach((run) => runs.push(readRun(run)));
        break;
      case 'fld':
        toArray(value).forEach((field) => runs.push(readRun(field)));
        break;
      case 'br':
        toArray(value).forEach(() =>
          runs.push({
            text: '\n',
            fontSize: 0,
            bold: false,
            italic: false,
            strikethrough: false,
            lineBreak: true,
          }),
        );
        break;
      default:
        break;
    }
  }

  const markdown = normalizeParagraphText(formatRuns(runs));
  const plainText = normalizeParagraphText(runs.map((run) => run.text).join(''));
  if (!markdown.trim()) {
    return undefined;
  }

  const paragraphProperties = paragraph?.pPr;
  const bullet = readBulletKind(paragraphProperties);
  const level = clampInteger(readNumberAttr(paragraphProperties, 'lvl'), 0, 8);
  const defaultFontSize = readFontSize(paragraphProperties?.defRPr);
  const maxFontSize = runs.reduce((max, run) => Math.max(max, run.fontSize), defaultFontSize);
  const textRuns = runs.filter((run) => !run.lineBreak && run.text.trim());
  const allBold = textRuns.length > 0 && textRuns.every((run) => run.bold);

  return { markdown, plainText, bullet, level, maxFontSize, allBold };
}

export function readTextBody(textBody: any): TextBodyInfo {
  const paragraphs = toArray(textBody?.p)
    .map(readParagraph)
    .filter((paragraph): paragraph is TextParagraph => Boolean(paragraph?.markdown.trim()));
  const maxFontSize = paragraphs.reduce(
    (max, paragraph) => Math.max(max, paragraph.maxFontSize),
    0,
  );
  const plainText = paragraphs
    .map((paragraph) => paragraph.plainText)
    .join('\n')
    .trim();
  const hasBullet = paragraphs.some((paragraph) => Boolean(paragraph.bullet));
  const allBold = paragraphs.length > 0 && paragraphs.every((paragraph) => paragraph.allBold);

  return { paragraphs, maxFontSize, plainText, hasBullet, allBold };
}

export function readTextBodyPlain(textBody: any): string {
  return readTextBody(textBody)
    .paragraphs.map((paragraph) => paragraph.markdown.replace(/\n+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

export function formatTextBody(paragraphs: TextParagraph[], headingLevel?: number): string {
  const lines: string[] = [];
  let orderedIndex = 1;
  let headingApplied = false;

  for (const paragraph of paragraphs) {
    const text = paragraph.markdown.replace(/\n+/g, ' ').trim();
    if (!text) {
      continue;
    }

    if (paragraph.bullet) {
      const indent = '  '.repeat(paragraph.level);
      const marker = paragraph.bullet === 'ordered' ? `${orderedIndex++}.` : '-';
      lines.push(`${indent}${marker} ${text}`);
      continue;
    }

    orderedIndex = 1;

    if (headingLevel && !headingApplied) {
      lines.push(`${'#'.repeat(headingLevel)} ${text}`);
      headingApplied = true;
      continue;
    }

    lines.push(text);
  }

  return lines.join('\n');
}

export function inferHeadingLevel(shape: any, textBody: TextBodyInfo): number | undefined {
  const placeholderType = readPlaceholderType(shape);

  if (placeholderType === 'title' || placeholderType === 'ctrTitle') {
    return 1;
  }
  if (placeholderType === 'subTitle') {
    return 2;
  }

  if (textBody.paragraphs.length > 2 || textBody.paragraphs.some((paragraph) => paragraph.bullet)) {
    return undefined;
  }

  if (!hasLetter(textBody.plainText)) {
    return undefined;
  }

  if (textBody.maxFontSize >= 3600) {
    return 1;
  }
  if (textBody.maxFontSize >= 2400) {
    return 2;
  }
  if (textBody.maxFontSize >= 1800) {
    return 3;
  }

  return undefined;
}
