import { decodeXmlEntities } from './xml';
import { htmlToMarkdown } from './turndown';

export function cleanLine(line: string): string {
  const trimmed = line.trimEnd();
  if (trimmed.length > 0 && line.slice(trimmed.length).startsWith('  ')) {
    return line.slice(0, trimmed.length + 2);
  }
  return trimmed;
}

type MarkdownContainer = 'quote' | number;
const thematicBreak = /^ {0,3}([-*_]) *(?:\1 *){2,}$/;

function expandTabs(line: string): string {
  let extraColumns = 0;
  return line.replace(/\t/g, (_tab, index: number) => {
    const width = 4 - ((index + extraColumns) % 4);
    extraColumns += width - 1;
    return ' '.repeat(width);
  });
}

function quotePrefixLength(line: string): number {
  return /^ {0,3}> ?/.exec(line)?.[0].length ?? 0;
}

function listPrefixLength(line: string, continuesParagraph: boolean): number {
  const marker = /^ {0,3}([-+*]|\d{1,9}[.)])( +|$)/.exec(line);
  if (!marker || thematicBreak.test(line)) return 0;

  if (
    continuesParagraph &&
    (marker[0].length === line.length ||
      (marker[1].length > 1 && Number.parseInt(marker[1], 10) !== 1))
  ) {
    return 0;
  }

  const padding = marker[2].length;
  return marker[0].length - padding + (padding >= 1 && padding <= 4 ? padding : 1);
}

function isParagraph(line: string, continuesParagraph: boolean): boolean {
  if (/^ *$|^ {0,3}#{1,6}(?: |$)/.test(line) || thematicBreak.test(line)) return false;
  return continuesParagraph ? !/^ {0,3}(?:=+|-+) *$/.test(line) : !line.startsWith('    ');
}

export function normalizeMarkdown(markdown: string): string {
  const normalized = (markdown || '').replace(/\r\n|\r/g, '\n');
  const lines = normalized.split('\n');
  const output: string[] = [];
  const containers: MarkdownContainer[] = [];
  let blankLines = 0;
  let fence: string | undefined;
  let paragraphDepth: number | undefined;

  for (const line of lines) {
    let content = expandTabs(line);
    let depth = 0;
    for (const container of containers) {
      const prefix = container === 'quote' ? quotePrefixLength(content) : container;
      if (
        !prefix ||
        (container !== 'quote' && !content.startsWith(' '.repeat(prefix)) && !/^ *$/.test(content))
      ) {
        break;
      }
      content = content.slice(prefix);
      depth += 1;
    }

    if (depth < containers.length) {
      containers.length = depth;
      fence = undefined;
      paragraphDepth = undefined;
    }

    if (!fence) {
      for (;;) {
        const quote = quotePrefixLength(content);
        const prefix = quote || listPrefixLength(content, paragraphDepth === containers.length);
        if (!prefix) break;

        containers.push(quote ? 'quote' : prefix);
        content = content.slice(prefix);
      }
    }

    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/s.exec(content);
    if (fence) {
      paragraphDepth = undefined;
      if (
        delimiter &&
        delimiter[1][0] === fence[0] &&
        delimiter[1].length >= fence.length &&
        /^ *$/.test(delimiter[2])
      ) {
        fence = undefined;
      } else {
        output.push(line);
        continue;
      }
    } else if (delimiter && (delimiter[1][0] === '~' || !delimiter[2].includes('`'))) {
      fence = delimiter[1];
      paragraphDepth = undefined;
    } else {
      paragraphDepth = isParagraph(content, paragraphDepth === containers.length)
        ? containers.length
        : undefined;
    }

    const clean = cleanLine(line);
    if (clean.length === 0) {
      blankLines += 1;
      if (blankLines <= 2 && output.length > 0) {
        output.push('');
      }
    } else {
      blankLines = 0;
      output.push(clean);
    }
  }

  const result = output.join('\n');
  return fence ? result.trimStart() : result.trim();
}

export function normalizeMarkdownHeading(value: string): string {
  return (
    decodeXmlEntities(value)
      .replace(/\r\n|\r|\n/g, ' ')
      .trim() || 'Sheet'
  );
}

export function looksLikeHtml(value: string): boolean {
  const trimmed = value.trim();
  if (/^<!DOCTYPE\s+html/i.test(trimmed)) {
    return true;
  }
  if (/^<html[\s>]/i.test(trimmed)) {
    return true;
  }
  return /^\s*<(?:div|p|span|section|article|header|footer|nav|h[1-6]|table|ul|ol|main|body)[\s>]/i.test(
    trimmed,
  );
}

export function convertTextToMarkdown(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  if (looksLikeHtml(trimmed)) {
    return htmlToMarkdown(trimmed);
  }

  return normalizeMarkdown(input);
}
