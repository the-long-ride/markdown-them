import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { readZipText } from './shared/zip';
import { isBlankTable } from './markdown/tables';
import {
  appendMarkdownTable,
  decodeXmlEntities,
  normalizeMarkdown,
  normalizeMarkdownHeading,
} from './markdown-utils';
import {
  cellAddress,
  columnIndexFromCellRef,
  formatCellHyperlink,
  indexCellHyperlinks,
} from './xlsx/hyperlinks';

function localTagName(tagName: string): string {
  const colonIndex = tagName.indexOf(':');
  return colonIndex === -1 ? tagName : tagName.slice(colonIndex + 1);
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  transformTagName: localTagName,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
});

export async function convertXlsxData(data: ArrayBuffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const workbookXml = await readZipText(zip, 'xl/workbook.xml');

  if (!workbookXml) {
    throw new Error('Invalid XLSX file: missing workbook.xml');
  }

  const workbook = xmlParser.parse(workbookXml);
  const relationships = await readWorkbookRelationships(zip);
  const sharedStrings = await readSharedStrings(zip);
  const sheets = toArray(workbook?.workbook?.sheets?.sheet);

  const markdown: string[] = [];

  for (const sheet of sheets) {
    const sheetName = normalizeMarkdownHeading(String(sheet?.['@_name'] || 'Sheet'));
    const relationshipId =
      sheet?.['@_r:id'] || sheet?.['@_id'] || sheet?.['@_r:Id'] || sheet?.['@_Id'];
    const sheetPath = relationshipId ? relationships.get(String(relationshipId)) : undefined;

    if (!sheetPath) {
      continue;
    }

    const worksheetXml = await readZipText(zip, sheetPath);
    if (!worksheetXml) {
      continue;
    }

    const worksheet = xmlParser.parse(worksheetXml)?.worksheet;
    const hyperlinks = toArray(worksheet?.hyperlinks?.hyperlink);
    const hyperlinkIndex = hyperlinks.length
      ? indexCellHyperlinks(hyperlinks, await readWorksheetRelationships(zip, sheetPath))
      : undefined;
    const rows = toArray(worksheet?.sheetData?.row);
    let nextRow = 1;
    const tableRows = new Map<number, string[]>();
    for (const row of rows) {
      const cells = toArray(row?.c);
      const rowNumber = Number(row?.['@_r'] || row?.['@_R']) || inferRowFromCells(cells) || nextRow;
      tableRows.set(rowNumber, readXlsxRow(cells, rowNumber, sharedStrings, hyperlinkIndex));
      nextRow = rowNumber + 1;
    }
    for (const rowNumber of hyperlinkIndex?.anchors.keys() ?? []) {
      if (!tableRows.has(rowNumber)) {
        tableRows.set(rowNumber, readXlsxRow([], rowNumber, sharedStrings, hyperlinkIndex));
      }
    }
    const orderedRows = [...tableRows].sort(([a], [b]) => a - b).map(([, row]) => row);

    if (isBlankTable(orderedRows)) {
      continue;
    }

    if (markdown.length > 0) {
      markdown.push('');
    }

    markdown.push(`## ${sheetName}`, '');
    appendMarkdownTable(markdown, orderedRows);
  }

  return normalizeMarkdown(markdown.join('\n'));
}

async function readWorksheetRelationships(zip: JSZip, sheetPath: string): Promise<any[]> {
  const basenameIndex = sheetPath.lastIndexOf('/') + 1;
  const directory = sheetPath.slice(0, basenameIndex);
  const basename = sheetPath.slice(basenameIndex);
  const xml = await readZipText(zip, `${directory}_rels/${basename}.rels`);
  return xml ? toArray(xmlParser.parse(xml)?.Relationships?.Relationship) : [];
}

async function readWorkbookRelationships(zip: JSZip): Promise<Map<string, string>> {
  const relationships = new Map<string, string>();
  const relsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels');

  if (!relsXml) {
    return relationships;
  }

  const rels = xmlParser.parse(relsXml);
  for (const relationship of toArray(rels?.Relationships?.Relationship)) {
    const id = relationship?.['@_Id'] || relationship?.['@_id'] || relationship?.['@_r:id'];
    const target = relationship?.['@_Target'] || relationship?.['@_target'];

    if (id && target) {
      relationships.set(String(id), resolveWorkbookTarget(String(target)));
    }
  }

  return relationships;
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const sharedStringsXml = await readZipText(zip, 'xl/sharedStrings.xml');

  if (!sharedStringsXml) {
    return [];
  }

  const sharedStrings = xmlParser.parse(sharedStringsXml);
  return toArray(sharedStrings?.sst?.si).map(readRichText);
}

function inferRowFromCells(cells: any[]): number | undefined {
  for (const cell of cells) {
    const address = cellAddress(String(cell?.['@_r'] || cell?.['@_R'] || ''));
    if (address) return address.row;
  }
}

function readXlsxRow(
  cells: any[],
  rowNumber: number,
  sharedStrings: string[],
  hyperlinks?: ReturnType<typeof indexCellHyperlinks>,
): string[] {
  const values: string[] = [];
  let nextColumn = 1;

  for (const cell of cells) {
    const cellRef = cell?.['@_r'] || cell?.['@_R'];
    const column = cellRef ? columnIndexFromCellRef(String(cellRef)) : nextColumn;

    while (values.length < column - 1) {
      values.push('');
    }

    const value = readXlsxCell(cell, sharedStrings);
    const link = hyperlinks?.find(rowNumber, column);
    values.push(link ? formatCellHyperlink(value, link) : value);
    nextColumn = column + 1;
  }

  for (const column of hyperlinks?.anchors.get(rowNumber) ?? []) {
    if (!values[column - 1]) {
      const link = hyperlinks?.find(rowNumber, column);
      if (!link) {
        continue;
      }
      while (values.length < column) {
        values.push('');
      }
      values[column - 1] = formatCellHyperlink('', link);
    }
  }

  return values;
}

function readXlsxCell(cell: any, sharedStrings: string[]): string {
  const type = cell?.['@_t'] || cell?.['@_T'];

  if (type === 'inlineStr') {
    return readRichText(cell?.is);
  }

  const rawValue = readRichText(cell?.v);

  if (type === 's') {
    const sharedStringIndex = rawValue.trim() === '' ? NaN : Number(rawValue);
    return Number.isInteger(sharedStringIndex) && sharedStringIndex >= 0
      ? sharedStrings[sharedStringIndex] || ''
      : '';
  }

  if (type === 'b') {
    return rawValue === '1' ? 'TRUE' : 'FALSE';
  }

  return rawValue;
}

function readRichText(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return decodeXmlEntities(String(value));
  }

  if (Array.isArray(value)) {
    return value.map(readRichText).join('');
  }

  if (value.t !== undefined) {
    return readRichText(value.t);
  }

  if (value.r !== undefined) {
    return toArray(value.r)
      .map((run) => readRichText(run.t))
      .join('');
  }

  if (value['#text'] !== undefined) {
    return decodeXmlEntities(String(value['#text']));
  }

  return '';
}

function resolveWorkbookTarget(target: string): string {
  const normalized = target.replace(/\\/g, '/');
  const base = normalized.startsWith('/') ? normalized.replace(/^\/+/, '') : `xl/${normalized}`;
  const resolved: string[] = [];

  for (const part of base.split('/')) {
    if (!part || part === '.') {
      continue;
    }

    if (part === '..') {
      if (resolved.length === 0) {
        throw new Error(`Invalid workbook relationship target escapes archive: ${target}`);
      }
      resolved.pop();
      continue;
    }

    resolved.push(part);
  }

  const result = resolved.join('/');
  if (!result.startsWith('xl/')) {
    throw new Error(`Invalid workbook relationship target outside xl/: ${target}`);
  }
  return result;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
