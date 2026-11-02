import type { RtfRun } from './types';

export function plainText(runs: RtfRun[]): string {
  return runs.map((run) => run.text).join('');
}

export function boldRatio(runs: RtfRun[]): number {
  const text = plainText(runs).trim();
  if (!text) {
    return 0;
  }

  const boldLength = runs.filter((run) => run.bold).reduce((sum, run) => sum + run.text.length, 0);
  return boldLength / text.length;
}

export function wrapMarkdown(value: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match || !match[2]) {
    return value;
  }

  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

export function formatRun(run: RtfRun): string {
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

export function formatRuns(runs: RtfRun[]): string {
  return runs.map(formatRun).join('');
}

export function formatParagraph(runs: RtfRun[]): string {
  const text = plainText(runs).replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }

  const formatted = formatRuns(runs)
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  const maxFontSize = runs.reduce((max, run) => Math.max(max, run.fontSize), 0);
  const hasLetters = /\p{L}/u.test(text);

  if (hasLetters && text.length <= 140) {
    if (maxFontSize >= 56) {
      return `# ${formatted}`;
    }
    if (maxFontSize >= 44) {
      return `## ${formatted}`;
    }
    if (maxFontSize >= 34 && boldRatio(runs) > 0.6) {
      return `### ${formatted}`;
    }
  }

  const bulletMatch = formatted.match(/^[•·]\s*(.+)$/);
  if (bulletMatch) {
    return `- ${bulletMatch[1].trim()}`;
  }

  return formatted;
}
