import { readOleStreams } from './ole';

// Readers for the Word 97-2003 binary format, following [MS-DOC] "Retrieving Text"
// (piece table in the CLX) and the paragraph property FKPs used to find tables.

export interface ParagraphProps {
  sti: number;
  inTable: boolean;
  tableRowEnd: boolean;
  innerCell: boolean;
  innerRowEnd: boolean;
  listLevel: number;
  outlineLevel: number;
}

export interface WordBinaryDocument {
  text: string;
  propsAt(cp: number): ParagraphProps | undefined;
}

interface Piece {
  cpStart: number;
  cpEnd: number;
  fc: number;
  compressed: boolean;
}

interface PapxRun {
  fcStart: number;
  fcEnd: number;
  props: ParagraphProps;
}

const WORD_IDENT = 0xa5ec;
const WORD97_NFIB = 0x00c1;
const FIB_FLAG_ENCRYPTED = 0x0100;
const FIB_FLAG_TABLE1 = 0x0200;
const FC_STSHF = 1;
const FC_PLCF_BTE_PAPX = 13;
const FC_CLX = 33;
const ISTD_HEADING_STI_MAX = 9;
const SPRM_P_HUGE_PAPX = 0x6646;

const cp1252 = new TextDecoder('windows-1252');
const utf16 = new TextDecoder('utf-16le');

export function readWordBinary(data: Uint8Array): WordBinaryDocument {
  const streams = readOleStreams(data);
  const word = streams.get('WordDocument');
  if (!word || word.length < 0x200) {
    throw new Error('Invalid DOC file: missing WordDocument stream');
  }
  const view = new DataView(word.buffer, word.byteOffset, word.byteLength);
  if (view.getUint16(0, true) !== WORD_IDENT) {
    throw new Error('Invalid DOC file: unrecognized Word binary header');
  }
  if (view.getUint16(2, true) < WORD97_NFIB) {
    throw new Error('Unsupported DOC file: Word 6/95 binary documents are not supported');
  }
  const flags = view.getUint16(0x0a, true);
  if (flags & FIB_FLAG_ENCRYPTED) {
    throw new Error('Cannot convert DOC file: the document is password-protected');
  }
  const table = streams.get(flags & FIB_FLAG_TABLE1 ? '1Table' : '0Table');
  if (!table) {
    throw new Error('Invalid DOC file: missing table stream');
  }
  const tableView = new DataView(table.buffer, table.byteOffset, table.byteLength);

  const csw = view.getUint16(32, true);
  const lwStart = 32 + 2 + csw * 2 + 2;
  const cslw = view.getUint16(lwStart - 2, true);
  const ccpText = view.getUint32(lwStart + 3 * 4, true);
  const fcLcbStart = lwStart + cslw * 4 + 2;
  const fcLcb = (index: number) => ({
    fc: view.getUint32(fcLcbStart + index * 8, true),
    lcb: view.getUint32(fcLcbStart + index * 8 + 4, true),
  });

  const pieces = readPieces(tableView, fcLcb(FC_CLX));
  const text = readText(word, pieces, ccpText);
  const styles = readStyleIdentifiers(tableView, fcLcb(FC_STSHF));
  const dataStream = streams.get('Data');
  const dataView = dataStream
    ? new DataView(dataStream.buffer, dataStream.byteOffset, dataStream.byteLength)
    : undefined;
  const runs = readPapxRuns(view, tableView, fcLcb(FC_PLCF_BTE_PAPX), styles, dataView);

  return {
    text,
    propsAt(cp: number) {
      const fc = cpToFc(pieces, cp);
      return fc === undefined ? undefined : findRun(runs, fc)?.props;
    },
  };
}

function readPieces(table: DataView, { fc, lcb }: { fc: number; lcb: number }): Piece[] {
  let offset = fc;
  const end = fc + lcb;
  while (offset < end && table.getUint8(offset) === 0x01) {
    offset += 3 + table.getUint16(offset + 1, true);
  }
  if (offset >= end || table.getUint8(offset) !== 0x02) {
    throw new Error('Invalid DOC file: missing piece table');
  }
  const plcLength = table.getUint32(offset + 1, true);
  const plcStart = offset + 5;
  const count = (plcLength - 4) / 12;
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const fcValue = table.getUint32(plcStart + (count + 1) * 4 + i * 8 + 2, true);
    const compressed = (fcValue & 0x40000000) !== 0;
    const rawFc = fcValue & 0x3fffffff;
    pieces.push({
      cpStart: table.getUint32(plcStart + i * 4, true),
      cpEnd: table.getUint32(plcStart + (i + 1) * 4, true),
      fc: compressed ? rawFc / 2 : rawFc,
      compressed,
    });
  }
  return pieces;
}

function readText(word: Uint8Array, pieces: Piece[], ccpText: number): string {
  let text = '';
  for (const piece of pieces) {
    if (piece.cpStart >= ccpText) {
      break;
    }
    const length = Math.min(piece.cpEnd, ccpText) - piece.cpStart;
    const bytes = word.subarray(piece.fc, piece.fc + length * (piece.compressed ? 1 : 2));
    text += (piece.compressed ? cp1252 : utf16).decode(bytes);
  }
  return text;
}

function cpToFc(pieces: Piece[], cp: number): number | undefined {
  const piece = pieces.find((p) => cp >= p.cpStart && cp < p.cpEnd);
  if (!piece) {
    return undefined;
  }
  return piece.fc + (cp - piece.cpStart) * (piece.compressed ? 1 : 2);
}

function readStyleIdentifiers(table: DataView, { fc, lcb }: { fc: number; lcb: number }) {
  const styles: number[] = [];
  if (lcb < 4) {
    return styles;
  }
  const cbStshi = table.getUint16(fc, true);
  const count = table.getUint16(fc + 2, true);
  let offset = fc + 2 + cbStshi;
  for (let istd = 0; istd < count && offset + 2 <= fc + lcb; istd++) {
    const cbStd = table.getUint16(offset, true);
    styles.push(cbStd >= 2 ? table.getUint16(offset + 2, true) & 0x0fff : -1);
    offset += 2 + cbStd;
  }
  return styles;
}

function readPapxRuns(
  word: DataView,
  table: DataView,
  { fc, lcb }: { fc: number; lcb: number },
  styles: number[],
  data: DataView | undefined,
): PapxRun[] {
  const runs: PapxRun[] = [];
  const count = lcb >= 4 ? (lcb - 4) / 8 : 0;
  for (let i = 0; i < count; i++) {
    const pageStart = (table.getUint32(fc + (count + 1) * 4 + i * 4, true) & 0x3fffff) * 512;
    if (pageStart + 512 > word.byteLength) {
      continue;
    }
    const crun = word.getUint8(pageStart + 511);
    for (let run = 0; run < crun; run++) {
      const bOffset = word.getUint8(pageStart + (crun + 1) * 4 + run * 13);
      runs.push({
        fcStart: word.getUint32(pageStart + run * 4, true),
        fcEnd: word.getUint32(pageStart + (run + 1) * 4, true),
        props:
          bOffset === 0
            ? defaultProps(styles, 0)
            : readPapx(word, pageStart + bOffset * 2, styles, data),
      });
    }
  }
  return runs.sort((a, b) => a.fcStart - b.fcStart);
}

function defaultProps(styles: number[], istd: number): ParagraphProps {
  return {
    sti: styles[istd] ?? -1,
    inTable: false,
    tableRowEnd: false,
    innerCell: false,
    innerRowEnd: false,
    listLevel: -1,
    outlineLevel: -1,
  };
}

function readPapx(
  word: DataView,
  offset: number,
  styles: number[],
  data: DataView | undefined,
): ParagraphProps {
  const cb = word.getUint8(offset);
  const start = cb === 0 ? offset + 2 : offset + 1;
  const end = start + (cb === 0 ? word.getUint8(offset + 1) * 2 : cb * 2 - 1);
  const props = defaultProps(styles, word.getUint16(start, true));
  const list = { has: false, level: 0 };
  applySprms(word, start + 2, end, props, list, data);
  props.listLevel = list.has ? list.level : -1;
  return props;
}

function applySprms(
  view: DataView,
  pos: number,
  end: number,
  props: ParagraphProps,
  list: { has: boolean; level: number },
  data?: DataView,
): void {
  while (pos + 2 <= end) {
    const sprm = view.getUint16(pos, true);
    pos += 2;
    const size = operandSize(view, sprm, pos);
    if (size < 0 || pos + size > end) {
      break;
    }
    const operand = size >= 1 ? view.getUint8(pos) : 0;
    if (sprm === 0x2416) props.inTable = operand !== 0;
    else if (sprm === 0x2417) props.tableRowEnd = operand !== 0;
    else if (sprm === 0x244b) props.innerCell = operand !== 0;
    else if (sprm === 0x244c) props.innerRowEnd = operand !== 0;
    else if (sprm === 0x6649) props.inTable ||= view.getUint32(pos, true) > 0;
    else if (sprm === 0x460b) list.has = view.getUint16(pos, true) > 0;
    else if (sprm === 0x260a) list.level = operand;
    else if (sprm === 0x2640) props.outlineLevel = operand < 9 ? operand : -1;
    else if (sprm === SPRM_P_HUGE_PAPX && data) {
      // Oversized paragraph properties live in the Data stream as cbGrpprl + grpprl.
      const at = view.getUint32(pos, true);
      if (at + 2 <= data.byteLength) {
        const hugeEnd = Math.min(at + 2 + data.getUint16(at, true), data.byteLength);
        applySprms(data, at + 2, hugeEnd, props, list);
      }
    }
    pos += size;
  }
}

function operandSize(word: DataView, sprm: number, pos: number): number {
  switch (sprm >> 13) {
    case 0:
    case 1:
      return 1;
    case 2:
    case 4:
    case 5:
      return 2;
    case 3:
      return 4;
    case 7:
      return 3;
    default:
      if (sprm === 0xd608 || sprm === 0xd606) {
        return 2 + word.getUint16(pos, true) - 1;
      }
      if (sprm === 0xc615 && word.getUint8(pos) === 255) {
        return -1;
      }
      return 1 + word.getUint8(pos);
  }
}

function findRun(runs: PapxRun[], fc: number): PapxRun | undefined {
  let low = 0;
  let high = runs.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (fc < runs[mid].fcStart) high = mid - 1;
    else if (fc >= runs[mid].fcEnd) low = mid + 1;
    else return runs[mid];
  }
  return undefined;
}

export function headingLevel(props: ParagraphProps | undefined): number {
  if (!props) return 0;
  if (props.sti >= 1 && props.sti <= ISTD_HEADING_STI_MAX) return props.sti;
  if (props.sti === 62) return 1;
  return props.outlineLevel >= 0 ? props.outlineLevel + 1 : 0;
}
