import { appendMarkdownTable, normalizeMarkdown } from '../markdown-utils';
import { headingLevel, ParagraphProps, readWordBinary } from './doc-binary';

const FIELD_BEGIN = '\x13';
const FIELD_SEPARATOR = '\x14';
const FIELD_END = '\x15';
const CELL_MARK = '\x07';
const PARAGRAPH_BREAKS = new Set(['\r', '\x0c', '\x0e']);
const DROPPED_CHARACTERS = /[\x00-\x06\x08\x10-\x12\x16-\x1d\x1f]/g;
const BLOCK_SYNTAX = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|([-*_])\s*(\2\s*){2,}$)/;
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

/**
 * Converts a Word 97-2003 binary (.doc, OLE compound file) document to Markdown.
 * Paragraphs, headings, list items, tables and hyperlinks of the main document
 * story are kept; character formatting, headers, footers and embedded objects are not.
 */
export function convertDocData(data: Uint8Array): string {
  const document = readWordBinary(data);
  const builder = new DocMarkdownBuilder();
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
  private rows: string[][] = [];
  private row: string[] = [];
  private cell: string[] = [];
  private lastMarkWasCell = false;

  wrapLink(start: number, url: string): void {
    const label = this.current.slice(start).trim();
    if (label) {
      this.current = `${this.current.slice(0, start)}[${label.replace(/[[\]]/g, '\\$&')}](${url})`;
    }
  }

  endParagraph(mark: string, props: ParagraphProps | undefined): void {
    const text = cleanText(this.current);
    this.current = '';
    this.paragraphCount++;

    if (mark === CELL_MARK) {
      const rowEnd = props ? props.tableRowEnd : this.lastMarkWasCell && !text;
      this.lastMarkWasCell = true;
      if (rowEnd) {
        this.rows.push(this.row);
        this.row = [];
      } else {
        this.cell.push(text);
        this.row.push(this.cell.filter(Boolean).join('\n'));
        this.cell = [];
      }
      return;
    }
    this.lastMarkWasCell = false;

    if (props?.innerRowEnd) {
      return;
    }
    if (props?.inTable || props?.innerCell) {
      this.cell.push(text);
      return;
    }
    this.flushTable();
    if (text) {
      this.blocks.push(formatParagraph(text, props));
    }
  }

  toMarkdown(): string {
    this.flushTable();
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

  private flushTable(): void {
    if (this.row.length > 0 || this.cell.length > 0) {
      if (this.cell.length > 0) this.row.push(this.cell.filter(Boolean).join('\n'));
      this.rows.push(this.row);
      this.row = [];
      this.cell = [];
    }
    if (this.rows.length === 0) {
      return;
    }
    const table: string[] = [];
    appendMarkdownTable(table, this.rows);
    this.rows = [];
    if (table.length > 0) {
      this.blocks.push({ kind: 'table', text: table.join('\n') });
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

function formatParagraph(text: string, props: ParagraphProps | undefined): Block {
  const level = headingLevel(props);
  if (level > 0 && !text.includes('\n')) {
    return { kind: 'paragraph', text: `${'#'.repeat(Math.min(level, 6))} ${text}` };
  }
  const lines = text.split('\n').map((line) => (BLOCK_SYNTAX.test(line) ? `\\${line}` : line));
  if (props && props.listLevel >= 0) {
    const indent = '  '.repeat(props.listLevel);
    return { kind: 'list', text: `${indent}- ${lines.join(`  \n${indent}  `)}` };
  }
  return { kind: 'paragraph', text: lines.join('  \n') };
}
