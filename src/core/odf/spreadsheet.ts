import { appendMarkdownTable, decodeXmlEntities } from '../markdown-utils';
import type { OrderedXmlNode, RenderContext } from './types';
import { childrenOf, clampRepeat, directChildren, nodeName, readAttr, readRepeat } from './xml';
import { normalizeHeading } from './styles';
import { renderFlowNodes } from './flow';

export async function renderTableCell(
  cell: OrderedXmlNode,
  context: RenderContext,
): Promise<string> {
  const value = readAttr(cell, 'value') || readAttr(cell, 'string-value');
  const parts = await renderFlowNodes(childrenOf(cell), context);
  const text = parts
    .filter(Boolean)
    .join('<br>')
    .replace(/(?:<br>)+$/, '')
    .trim();
  return decodeXmlEntities(text || value || '');
}

export async function readOdsCells(row: OrderedXmlNode, context: RenderContext): Promise<string[]> {
  const cells: string[] = [];

  for (const cell of childrenOf(row).filter((child) =>
    ['table-cell', 'covered-table-cell'].includes(nodeName(child) || ''),
  )) {
    const repeatedColumns = clampRepeat(readRepeat(cell, 'number-columns-repeated'));
    const cellText = await renderTableCell(cell, context);

    for (let index = 0; index < repeatedColumns; index += 1) {
      cells.push(cellText);
    }
  }

  while (cells.length > 0 && !cells[cells.length - 1]) {
    cells.pop();
  }

  return cells;
}

export async function readOdsRows(
  table: OrderedXmlNode,
  context: RenderContext,
): Promise<string[][]> {
  const rows: string[][] = [];

  for (const row of directChildren(childrenOf(table), 'table-row')) {
    const repeatedRows = clampRepeat(readRepeat(row, 'number-rows-repeated'));
    const cells = await readOdsCells(row, context);

    if (cells.length === 0 || !cells.some((cell) => cell.trim())) {
      continue;
    }

    for (let index = 0; index < repeatedRows; index += 1) {
      rows.push([...cells]);
    }
  }

  return rows;
}

export async function renderOdfTable(
  table: OrderedXmlNode,
  context: RenderContext,
): Promise<string> {
  const rows = await readOdsRows(table, context);
  if (rows.length === 0) {
    return '';
  }

  const markdown: string[] = [];
  appendMarkdownTable(markdown, rows);
  return markdown.join('\n');
}

export async function renderSpreadsheet(
  spreadsheet: OrderedXmlNode | undefined,
  context: RenderContext,
): Promise<string> {
  const tables = directChildren(childrenOf(spreadsheet), 'table');
  const markdown: string[] = [];

  for (const [index, table] of tables.entries()) {
    const sheetName = normalizeHeading(readAttr(table, 'name') || `Sheet ${index + 1}`);
    const rows = await readOdsRows(table, context);
    const isAllEmpty = rows.every((row) =>
      row.every((cell) => cell === null || cell === undefined || String(cell).trim() === ''),
    );
    if (rows.length === 0 || isAllEmpty) {
      continue;
    }

    if (markdown.length > 0) {
      markdown.push('');
    }

    markdown.push(`## ${sheetName}`, '');
    appendMarkdownTable(markdown, rows);
  }

  return markdown.join('\n').trimEnd();
}
