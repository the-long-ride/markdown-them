import { appendMarkdownTable, normalizeMarkdown } from '../markdown-utils';
import { ParagraphProps, readWordBinary, WordBinaryDocument } from './doc-binary';
import { DocListFormatter, DocLists } from './doc-lists';

const FIELD_BEGIN = '\x13';
const FIELD_SEPARATOR = '\x14';
const FIELD_END = '\x15';
const CELL_MARK = '\x07';
const PARAGRAPH_BREAKS = new Set(['\r', '\x0c', '\x0e']);
const DROPPED_CHARACTERS = /[\x00-\x06\x08\x10-\x12\x16-\x1d\x1f]/g;
const BLOCK_SYNTAX = /^(#{1,6}\s|[-*+]\s|>|([-*_])\s*(\2\s*){2,}$)/;
const HYPERLINK_FIELD = /^\s*HYPERLINK\s+"([^"]+)"/;

interface Field {
  instruction: string;
  inResult: boolean;
  link?: { url: string; start: number; paragraph: number };
}

interface Block {
  kind: 'paragraph' | 'list' | 'table';
  text: string;
}

interface DocTable {
  depth: number;
  rows: string[][];
  row: string[];
  cell: string[];
}

/**
 * Converts a Word 97-2003 binary (.doc, OLE compound file) document to Markdown.
 * Paragraphs, headings, list items, tables and hyperlinks of the main document
 * story are kept; character formatting, headers, footers and embedded objects are not.
 */
export function convertDocData(data: Uint8Array): string {
  return renderWordDocument(readWordBinary(data));
}

export function renderWordDocument(document: WordBinaryDocument): string {
  const builder = new DocMarkdownBuilder(document.lists);
  const fields: Field[] = [];

  for (let cp = 0; cp < document.text.length; cp++) {
    const ch = document.text[cp];
    if (ch === FIELD_BEGIN) {
      fields.push({ instruction: '', inResult: false });
    } else if (ch === FIELD_SEPARATOR && fields.length > 0) {
      const field = fields[fields.length - 1];
      field.inResult = true;
      const url = field.instruction.match(HYPERLINK_FIELD)?.[1];
      if (url && !url.startsWith('#')) {
        field.link = { url, start: builder.current.length, paragraph: builder.paragraphCount };
      }
    } else if (ch === FIELD_END && fields.length > 0) {
      const field = fields.pop() as Field;
      if (field.link && field.link.paragraph === builder.paragraphCount) {
        builder.wrapLink(field.link.start, field.link.url);
      }
    } else if (fields.some((field) => !field.inResult)) {
      const field = fields[fields.length - 1];
      if (!field.inResult) field.instruction += ch;
    } else if (ch === CELL_MARK || PARAGRAPH_BREAKS.has(ch)) {
      builder.endParagraph(ch, document.propsAt(cp));
    } else {
      builder.current += ch;
    }
  }
  builder.endParagraph('\r', undefined);
  return builder.toMarkdown();
}

class DocMarkdownBuilder {
  current = '';
  paragraphCount = 0;
  private blocks: Block[] = [];
  private tables: DocTable[] = [];
  private lastMarkWasCell = false;
  private readonly listFormatter: DocListFormatter;

  constructor(lists: DocLists) {
    this.listFormatter = new DocListFormatter(lists);
  }

  wrapLink(start: number, url: string): void {
    const label = this.current.slice(start).trim();
    if (label) {
      const destination = url.replace(/[<>\r\n\\|]/g, (ch) => encodeURIComponent(ch));
      const target = /[\s()]/.test(destination) ? `<${destination}>` : destination;
      this.current = `${this.current.slice(0, start)}[${label.replace(/[[\]]/g, '\\$&')}](${target})`;
    }
  }

  endParagraph(mark: string, props: ParagraphProps | undefined): void {
    const text = cleanText(this.current);
    this.current = '';
    this.paragraphCount++;

    const outerMark = mark === CELL_MARK;
    const innerMark = props?.innerCell || props?.innerRowEnd;
    const depth = outerMark
      ? 1
      : Math.max(props?.tableDepth ?? 0, innerMark ? 2 : Number(props?.inTable ?? false));
    const rowEnd = props
      ? props.tableRowEnd || props.innerRowEnd
      : outerMark && this.lastMarkWasCell && !text;
    this.lastMarkWasCell = outerMark;

    if (depth > 0) {
      let index = this.tables.length - 1;
      while (index >= 0 && this.tables[index].depth > depth) index--;
      let table = this.tables[index];
      if (table?.depth !== depth) {
        table = { depth, rows: [], row: [], cell: [] };
        // A parent cell can start with a nested table and have no earlier paragraph.
        this.tables.splice(index + 1, 0, table);
      }
      this.flushTables(depth);
      if (rowEnd) {
        this.finishRow(table);
      } else if (outerMark || innerMark) {
        table.cell.push(text);
        this.finishCell(table);
      } else if (text) {
        table.cell.push(text);
      }
      return;
    }
    this.flushTables(0);
    const block = formatParagraph(text, props, this.listFormatter);
    if (block) this.blocks.push(block);
  }

  toMarkdown(): string {
    this.flushTables(0);
    const lines: string[] = [];
    this.blocks.forEach((block, index) => {
      const previous = this.blocks[index - 1];
      if (previous && !(previous.kind === 'list' && block.kind === 'list')) {
        lines.push('');
      }
      lines.push(block.text);
    });
    return normalizeMarkdown(lines.join('\n'));
  }

  private finishCell(table: DocTable): void {
    table.row.push(table.cell.filter(Boolean).join('\n'));
    table.cell = [];
  }

  private finishRow(table: DocTable): void {
    if (table.cell.length) this.finishCell(table);
    if (table.row.length) table.rows.push(table.row);
    table.row = [];
  }

  private flushTables(depth: number): void {
    let table = this.tables.at(-1);
    while (table && table.depth > depth) {
      this.tables.pop();
      this.finishRow(table);
      const parent = this.tables.at(-1);
      if (parent) {
        // Markdown tables cannot nest; keep inner columns visible and put each row on its own line.
        for (const row of table.rows) parent.cell.push(row.join(' | '));
      } else {
        const lines: string[] = [];
        appendMarkdownTable(lines, table.rows);
        if (lines.length) {
          this.listFormatter.resetIndent();
          this.blocks.push({ kind: 'table', text: lines.join('\n') });
        }
      }
      table = parent;
    }
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\x1e/g, '-')
    .replace(DROPPED_CHARACTERS, '')
    .replace(/[\t\u00a0]+/g, ' ')
    .split('\x0b')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function headingLevel(props: ParagraphProps | undefined): number {
  if (!props) return 0;
  if (props.sti >= 1 && props.sti <= 9) return props.sti;
  if (props.sti === 62) return 1;
  return props.outlineLevel >= 0 ? props.outlineLevel + 1 : 0;
}

function formatParagraph(
  text: string,
  props: ParagraphProps | undefined,
  lists: DocListFormatter,
): Block | undefined {
  const level = headingLevel(props);
  if (level > 0 && text && !text.includes('\n')) {
    lists.resetIndent();
    return { kind: 'paragraph', text: `${'#'.repeat(Math.min(level, 6))} ${text}` };
  }
  const lines = text
    .split('\n')
    .map((line) =>
      BLOCK_SYNTAX.test(line) ? `\\${line}` : line.replace(/^(\d{1,9})([.)])(?=\s)/, '$1\\$2'),
    );
  if (props?.listId && props.listLevel <= 8) {
    return { kind: 'list', text: lists.formatItem(lines, props.listId, props.listLevel) };
  }
  if (!text) return undefined;
  lists.resetIndent();
  return { kind: 'paragraph', text: lines.join('  \n') };
}
