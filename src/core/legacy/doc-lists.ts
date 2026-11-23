interface TableRange {
  fc: number;
  lcb: number;
}

interface ListLevel {
  ordered: boolean;
  start: number;
  startOverride?: number;
  restartLimit?: number;
}

interface ListInstance {
  lsid: number;
  levels: ListLevel[];
}

export type DocLists = Map<number, ListInstance>;

const LSTF_SIZE = 28;
const LVLF_SIZE = 28;
const LFO_SIZE = 16;
const LFOLVL_SIZE = 8;

function readStart(view: DataView, offset: number): number {
  const start = view.getUint32(offset, true);
  return start <= 0x7fff ? start : 1;
}

function readLevel(view: DataView, offset: number, end: number) {
  if (offset + LVLF_SIZE + 2 > end) return undefined;
  const textOffset = offset + LVLF_SIZE + view.getUint8(offset + 24) + view.getUint8(offset + 25);
  if (textOffset + 2 > end) return undefined;
  const next = textOffset + 2 + 2 * view.getUint16(textOffset, true);
  if (next > end) return undefined;
  const format = view.getUint8(offset + 4);
  return {
    next,
    level: {
      ordered: format !== 0x17 && format !== 0xff,
      start: readStart(view, offset),
      restartLimit: view.getUint8(offset + 5) & 8 ? view.getUint8(offset + 26) : undefined,
    },
  };
}

// [MS-DOC]: PlfLst headers are followed by the LVLs (outside lcbPlfLst).
function readDefinitions(view: DataView, { fc, lcb }: TableRange): Map<number, ListLevel[]> {
  const definitions = new Map<number, ListLevel[]>();
  if (lcb < 2 || fc + lcb > view.byteLength) return definitions;
  const count = view.getUint16(fc, true);
  if (2 + count * LSTF_SIZE > lcb) return definitions;
  let cursor = fc + lcb;
  for (let index = 0; index < count; index++) {
    const header = fc + 2 + index * LSTF_SIZE;
    const levels: ListLevel[] = [];
    const levelCount = view.getUint8(header + 26) & 1 ? 1 : 9;
    for (let level = 0; level < levelCount; level++) {
      const result = readLevel(view, cursor, view.byteLength);
      if (!result) return definitions;
      levels.push(result.level);
      cursor = result.next;
    }
    definitions.set(view.getUint32(header, true), levels);
  }
  return definitions;
}

export function readDocLists(
  view: DataView,
  listRange: TableRange,
  overrideRange: TableRange,
): DocLists {
  const lists: DocLists = new Map();
  const { fc, lcb } = overrideRange;
  const end = fc + lcb;
  if (lcb < 4 || end > view.byteLength) return lists;
  const definitions = readDefinitions(view, listRange);
  const count = view.getUint32(fc, true);
  let cursor = fc + 4 + count * LFO_SIZE;
  for (let id = 1; id <= count && cursor + 4 <= end; id++) {
    const header = fc + 4 + (id - 1) * LFO_SIZE;
    const lsid = view.getUint32(header, true);
    const levels = [...(definitions.get(lsid) ?? [])];
    cursor += 4; // LFOData begins with the character position.
    for (let remaining = view.getUint8(header + 12); remaining > 0; remaining--) {
      if (cursor + LFOLVL_SIZE > end) return lists;
      const start = readStart(view, cursor);
      const flags = view.getUint8(cursor + 4);
      const index = flags & 0xf;
      cursor += LFOLVL_SIZE;
      if (flags & 0x20) {
        const result = readLevel(view, cursor, end);
        if (!result) return lists;
        const startOverride = flags & 0x10 ? result.level.start : undefined;
        levels[index] = {
          ...result.level,
          start: startOverride ?? levels[index]?.start ?? 1,
          startOverride,
        };
        cursor = result.next;
      } else if (flags & 0x10 && levels[index]) {
        levels[index] = { ...levels[index], startOverride: start };
      }
    }
    lists.set(id, { lsid, levels });
  }
  return lists;
}

interface ListItem {
  key: number;
  number?: number;
  contentColumn: number;
}

export class DocListFormatter {
  private counters = new Map<number, number[]>();
  private usedOverrides = new Set<number>();
  private items: ListItem[] = [];

  constructor(private lists: DocLists) {}

  resetIndent(): void {
    this.items = [];
  }

  formatItem(lines: string[], id: number, depth: number): string {
    const list = this.lists.get(id);
    const key = list?.lsid ?? -id;
    const levels = list?.levels;
    const level = levels?.[depth];
    let number: number | undefined;
    if (levels) {
      const counters = this.counters.get(key) ?? [];
      for (let i = depth + 1; i < levels.length; i++) {
        if (depth < (levels[i]?.restartLimit ?? i)) delete counters[i];
      }
      if (level?.ordered) {
        const override = id * 9 + depth;
        number = counters[depth] ?? level.start;
        if (level.startOverride !== undefined && !this.usedOverrides.has(override)) {
          number = level.startOverride;
          this.usedOverrides.add(override);
        }
        counters[depth] = number + 1;
      }
      this.counters.set(key, counters);
    }

    const parent = this.items[depth - 1];
    const previous = this.items[depth];
    const indent = ' '.repeat(parent?.contentColumn ?? 0);
    const marker = number === undefined ? '- ' : `${number}. `;
    const contentColumn = indent.length + marker.length;
    this.items[depth] = { key, number, contentColumn };
    this.items.length = depth + 1;

    let separator = '';
    if (previous?.number !== undefined && number !== undefined) {
      if (previous.key !== key || previous.number + 1 !== number) {
        // Blank lines alone don't split adjacent CommonMark lists of the same kind.
        separator = `\n${indent}<!-- -->\n\n`;
      }
    } else if ((parent || previous) && (!previous || number !== previous.number)) {
      if ((number !== undefined && number !== 1) || !lines[0]) separator = '\n';
    }
    return `${separator}${indent}${marker}${lines.join(`  \n${' '.repeat(contentColumn)}`)}`;
  }
}
