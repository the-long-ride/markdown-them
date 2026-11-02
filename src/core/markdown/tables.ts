export function escapeMarkdownTableCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = typeof value === 'string' ? value : String(value);
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/(?:\s*<br>\s*)+/g, '<br>')
    .replace(/(?:<br>)+$/, '')
    .replace(/^(?:<br>)+/, '')
    .trim();
}

export function normalizeMarkdownTableRow(
  row: (string | unknown)[],
  columnCount: number,
): string[] {
  return Array.from({ length: columnCount }, (_, index) =>
    escapeMarkdownTableCell(row[index] ?? ''),
  );
}

export function appendMarkdownTable(markdown: string[], rows: (string | unknown)[][]): void {
  if (rows.length === 0) {
    return;
  }

  const isAllEmpty = rows.every((row) =>
    row.every((cell) => cell === null || cell === undefined || String(cell).trim() === ''),
  );
  if (isAllEmpty) {
    return;
  }

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (columnCount === 0) {
    return;
  }

  rows.forEach((row, rowIndex) => {
    const cells = normalizeMarkdownTableRow(row, columnCount);
    markdown.push(`| ${cells.join(' | ')} |`);

    if (rowIndex === 0) {
      markdown.push(`| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`);
    }
  });
}
