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

function cellAddress(ref: string): CellAddress | undefined {
  const match = /^([A-Z]{1,3})[1-9][0-9]{0,6}$/.exec(ref);
  if (match) {
    return { column: columnIndexFromCellRef(ref), row: Number(ref.slice(match[1].length)) };
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

  const singleCells = new Map<string, CellHyperlink>();
  const ranges: { start: CellAddress; end: CellAddress; link: CellHyperlink }[] = [];
  for (const node of nodes) {
    const link = hyperlinkFromNode(node, targets);
    if (!link) {
      continue;
    }
    const [first, last] = String(node?.['@_ref'] ?? '')
      .replace(/\$/g, '')
      .toUpperCase()
      .split(':');
    const start = cellAddress(first);
    if (!start) {
      continue;
    }
    if (!last) {
      singleCells.set(first, link);
      continue;
    }
    const end = cellAddress(last);
    if (end) {
      ranges.push({ start, end, link });
    }
  }

  return (cellRef: string): CellHyperlink | undefined => {
    const ref = cellRef.replace(/\$/g, '').toUpperCase();
    const direct = singleCells.get(ref);
    if (direct || ranges.length === 0) {
      return direct;
    }
    const cell = cellAddress(ref);
    if (cell) {
      return ranges.find(
        ({ start, end }) =>
          cell.column >= start.column &&
          cell.column <= end.column &&
          cell.row >= start.row &&
          cell.row <= end.row,
      )?.link;
    }
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
