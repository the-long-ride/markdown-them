import { appendMarkdownTable } from '../markdown-utils';
import { toArray } from './xml';
import { readTextBodyPlain } from './text';

export function readTableMarkdown(frame: any): string | undefined {
  const table = frame?.graphic?.graphicData?.tbl;
  if (!table) {
    return undefined;
  }

  const rows = toArray(table.tr)
    .map((row) => toArray(row?.tc).map((cell) => readTextBodyPlain(cell?.txBody)))
    .filter((row) => row.some((cell) => cell.trim()));

  if (rows.length === 0) {
    return undefined;
  }

  const markdown: string[] = [];
  appendMarkdownTable(markdown, rows);
  return markdown.join('\n');
}
