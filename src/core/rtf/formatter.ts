import { applyInlineMarks } from '../shared/inline';
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

export function formatRun(run: RtfRun): string {
  return applyInlineMarks(run.text, run);
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
