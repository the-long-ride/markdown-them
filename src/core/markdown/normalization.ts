import { decodeXmlEntities } from './xml';
import { htmlToMarkdown } from './turndown';

export function cleanLine(line: string): string {
  const trimmed = line.trimEnd();
  if (trimmed.length > 0 && line.slice(trimmed.length).startsWith('  ')) {
    return line.slice(0, trimmed.length + 2);
  }
  return trimmed;
}

export function normalizeMarkdown(markdown: string): string {
  const normalized = (markdown || '').replace(/\r\n|\r/g, '\n');
  const lines = normalized.split('\n');
  const output: string[] = [];
  let blankLines = 0;

  for (const line of lines) {
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

  return output.join('\n').trim();
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
