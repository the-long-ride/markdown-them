import * as XLSX from 'xlsx';
import {
  appendMarkdownTable,
  normalizeMarkdown,
  normalizeMarkdownHeading,
} from '../markdown-utils';

/**
 * Converts legacy Excel workbooks (BIFF .xls/.xlm in an OLE compound file, and the
 * other non-OOXML spreadsheet encodings SheetJS reads) to Markdown, one table per sheet.
 * Cells hold their formatted display values; formulas are not recalculated.
 */
export function convertXlsData(data: Uint8Array): string {
  const workbook = XLSX.read(data, {
    type: 'array',
    dense: true,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
  });
  const markdown: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) {
      continue;
    }
    const rows = trimEmptyColumns(
      XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false,
      }),
    );
    if (rows.length === 0) {
      continue;
    }
    if (markdown.length > 0) {
      markdown.push('');
    }
    markdown.push(`## ${normalizeMarkdownHeading(sheetName || 'Sheet')}`, '');
    appendMarkdownTable(markdown, rows);
  }

  return normalizeMarkdown(markdown.join('\n'));
}

function trimEmptyColumns(rows: unknown[][]): string[][] {
  const text = rows.map((row) => row.map((cell) => String(cell ?? '').trim()));
  const filled = text.filter((row) => row.some(Boolean));
  if (filled.length === 0) {
    return [];
  }
  const firstColumn = Math.min(...filled.map((row) => row.findIndex(Boolean)));
  const lastColumn = Math.max(...filled.map((row) => findLastFilled(row)));
  return filled.map((row) =>
    Array.from({ length: lastColumn - firstColumn + 1 }, (_, i) => row[firstColumn + i] ?? ''),
  );
}

function findLastFilled(row: string[]): number {
  for (let i = row.length - 1; i >= 0; i--) {
    if (row[i]) return i;
  }
  return -1;
}
