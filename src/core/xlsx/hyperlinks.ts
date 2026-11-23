interface CellHyperlink {
  target: string;
  display: string;
  clickable: boolean;
}

interface CellAddress {
  column: number;
  row: number;
}

export function columnIndexFromCellRef(cellRef: string): number {
  const letters = cellRef.match(/^\$?([A-Z]+)/i)?.[1]?.toUpperCase() ?? 'A';
  return [...letters].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0);
}

export function cellAddress(ref: string): CellAddress | undefined {
  const match = /^\$?([A-Z]{1,3})\$?([1-9][0-9]{0,6})$/i.exec(ref);
  if (match) {
    const column = columnIndexFromCellRef(match[1]);
    const row = Number(match[2]);
    if (column <= 16384 && row <= 1048576) {
      return { column, row };
    }
  }
}

function hyperlinkFromNode(node: any, targets: Map<string, string>): CellHyperlink | undefined {
  const location = String(node?.['@_location'] ?? '').trim();
  const id = node?.['@_r:id'] ?? node?.['@_id'];
  const external = id ? targets.get(String(id)) : undefined;
  if (id && !external) {
    return undefined;
  }
  const target = external ? [external, location].filter(Boolean).join('#') : location;
  if (target) {
    return {
      target,
      display: String(node?.['@_display'] ?? ''),
      clickable: Boolean(external && /^(?:https?|ftp|mailto|tel):/i.test(external)),
    };
  }
}

export function indexCellHyperlinks(nodes: any[], relationships: any[]) {
  const targets = new Map<string, string>();
  for (const rel of relationships) {
    const id = rel?.['@_Id'];
    const url = rel?.['@_Target'];
    if (id && url && rel['@_Type']?.endsWith('/hyperlink') && rel['@_TargetMode'] === 'External') {
      targets.set(String(id), String(url).trim());
    }
  }

  const singleCells = new Map<number, Map<number, CellHyperlink>>();
  const anchors = new Map<number, Set<number>>();
  const ranges: { start: CellAddress; end: CellAddress; link: CellHyperlink }[] = [];
  for (const node of nodes) {
    const link = hyperlinkFromNode(node, targets);
    if (!link) {
      continue;
    }
    const [first, last] = String(node?.['@_ref'] ?? '').split(':');
    const start = cellAddress(first);
    const end = last ? cellAddress(last) : undefined;
    if (!start || (last && !end)) {
      continue;
    }
    if (end) {
      ranges.push({ start, end, link });
    } else {
      const row = singleCells.get(start.row) ?? new Map();
      row.set(start.column, link);
      singleCells.set(start.row, row);
    }
    // Anchor the range without materializing potentially millions of blank cells.
    const columns = anchors.get(start.row) ?? new Set();
    columns.add(start.column);
    anchors.set(start.row, columns);
  }

  return {
    anchors,
    find: (row: number, column: number): CellHyperlink | undefined =>
      singleCells.get(row)?.get(column) ??
      ranges.find(
        ({ start, end }) =>
          column >= start.column && column <= end.column && row >= start.row && row <= end.row,
      )?.link,
  };
}

function markdownLiteral(value: string): string {
  return value.replace(/[&<>[\]\\*_`~]/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function formatCellHyperlink(value: string, link: CellHyperlink): string {
  const label = markdownLiteral(value.trim() || link.display.trim());
  if (!link.clickable) {
    // The Markdown has no corresponding workbook cells or local files to link to.
    const target = markdownLiteral(link.target);
    return label && label !== target ? `${label} (target: ${target})` : target;
  }

  // Keep URL escapes intact while encoding pipe-table and Markdown destination delimiters.
  const destination = link.target.replace(
    /[ \t\r\n<>()\\|]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  );
  return `[${label || markdownLiteral(link.target)}](${destination})`;
}
