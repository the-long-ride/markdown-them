import TurndownService from 'turndown';
import { normalizeMarkdown } from './normalization';

const turndownService = new TurndownService({ headingStyle: 'atx' });
turndownService.remove(['style', 'script', 'noscript', 'meta', 'link', 'title', 'template']);

turndownService.addRule('table', {
  filter: 'table',
  replacement: function (_content, node) {
    const element = node as any;
    const allTr = Array.from(element.getElementsByTagName('tr')) as any[];
    // Filter to only rows directly belonging to this table, not child/nested tables
    const trElements = allTr.filter((tr) => {
      let parent = tr.parentNode;
      while (parent && parent.nodeName !== 'TABLE') {
        parent = parent.parentNode;
      }
      return parent === element;
    });

    if (trElements.length === 0) {
      return '';
    }

    const rows: string[][] = [];
    trElements.forEach((tr) => {
      const cells: string[] = [];
      const childNodes = Array.from(tr.childNodes) as any[];
      const cellNodes = childNodes.filter((c) => c.nodeName === 'TH' || c.nodeName === 'TD');
      cellNodes.forEach((cell) => {
        const cellHtml = cell.innerHTML !== undefined ? cell.innerHTML : cell.textContent || '';
        const cellMd = turndownService.turndown(cellHtml);
        // Do not escape here; appendMarkdownTable escapes cells cleanly without double-escaping
        cells.push(cellMd);
      });
      if (cells.length > 0) {
        rows.push(cells);
      }
    });

    if (rows.length === 0) {
      return '';
    }

    const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
    if (columnCount === 0) {
      return '';
    }

    const markdownTable: string[] = [];
    rows.forEach((row, rowIndex) => {
      const cells = Array.from({ length: columnCount }, (_, index) => {
        const val = row[index] || '';
        return val
          .replace(/\|/g, '\\|')
          .replace(/\r\n|\r|\n/g, '<br>')
          .replace(/(?:\s*<br>\s*)+/g, '<br>')
          .replace(/(?:<br>)+$/, '')
          .replace(/^(?:<br>)+/, '')
          .trim();
      });
      markdownTable.push(`| ${cells.join(' | ')} |`);
      if (rowIndex === 0) {
        markdownTable.push(`| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`);
      }
    });

    return `\n\n${markdownTable.join('\n')}\n\n`;
  },
});

export function htmlToMarkdown(html: string): string {
  return normalizeMarkdown(turndownService.turndown(html));
}
