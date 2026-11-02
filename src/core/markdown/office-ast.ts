import { decodeXmlEntities } from './xml';
import { normalizeMarkdown, normalizeMarkdownHeading } from './normalization';
import { appendMarkdownTable, escapeMarkdownTableCell } from './tables';

function clampHeadingLevel(value: number): number {
  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.min(6, Math.max(1, Math.floor(value)));
}

function stringifyFallback(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) || '';
  } catch {
    return String(value);
  }
}

export function officeAstToMarkdown(ast: any): string {
  if (!ast || !ast.content || !Array.isArray(ast.content)) {
    return typeof ast?.toText === 'function' ? ast.toText() : stringifyFallback(ast);
  }

  const markdown: string[] = [];

  function processFormatting(text: string, formatting?: any): string {
    if (!text) {
      return text;
    }

    let result = text;
    if (formatting?.bold) {
      result = `**${result}**`;
    }
    if (formatting?.italic) {
      result = `*${result}*`;
    }
    if (formatting?.strikethrough) {
      result = `~~${result}~~`;
    }

    return result;
  }

  function safeGetText(node: any): string {
    try {
      return node.text ? decodeXmlEntities(String(node.text)) : '';
    } catch {
      return '';
    }
  }

  function processNode(node: any): string {
    if (!node) {
      return '';
    }

    switch (node.type) {
      case 'text':
        return processFormatting(safeGetText(node), node.formatting);
      case 'heading': {
        const text = node.children?.length
          ? node.children.map(processNode).join('')
          : safeGetText(node);
        const level = clampHeadingLevel(Number(node.metadata?.level) || 2);
        return `\n${'#'.repeat(level)} ${text.trim()}\n`;
      }
      case 'paragraph': {
        const pText = node.children?.length
          ? node.children.map(processNode).join('')
          : safeGetText(node);
        const sizeStr = node.children?.[0]?.formatting?.size || node.formatting?.size;
        if (sizeStr) {
          const sizeMatch = String(sizeStr).match(/(\d+)/);
          if (sizeMatch) {
            const size = Number(sizeMatch[1]);
            if (size >= 36) {
              return `\n# ${pText}\n`;
            }
            if (size >= 24) {
              return `\n## ${pText}\n`;
            }
            if (size >= 18) {
              return `\n### ${pText}\n`;
            }
          }
        }

        return `\n${pText}\n`;
      }
      case 'list': {
        const children = node.children || [];
        return (
          '\n' +
          children
            .map((child: any, index: number) => {
              const text =
                processNode(child)
                  .replace(/\r\n|\r|\n/g, ' ')
                  .trim() || safeGetText(child);
              const listType = child.metadata?.listType || node.metadata?.listType;
              return listType === 'ordered' ? `${index + 1}. ${text}` : `- ${text}`;
            })
            .join('\n') +
          '\n'
        );
      }
      case 'image':
      case 'chart':
      case 'drawing':
        return safeGetText(node);
      case 'page':
        return `\n${(node.children || []).map(processNode).join('').trim()}\n`;
      case 'sheet': {
        const sheetName = normalizeMarkdownHeading(
          String(node.metadata?.sheetName || safeGetText(node) || 'Sheet'),
        );
        const sheetContent = (node.children || []).map(processNode).join('').trim();
        return `\n## ${sheetName}\n\n${sheetContent}\n`;
      }
      case 'slide': {
        const slideContent = (node.children || []).map(processNode).join('').trim();
        return `\n---\n\n${slideContent}\n`;
      }
      case 'table': {
        if (!node.children || node.children.length === 0) {
          return '';
        }

        const tableMd = [''];
        const rows = node.children.map((row: any) => {
          return (row.children || []).map((cell: any) =>
            processNode(cell)
              .replace(/\r\n|\r|\n/g, ' ')
              .trim(),
          );
        });

        appendMarkdownTable(tableMd, rows);
        return `${tableMd.join('\n')}\n`;
      }
      case 'row':
        return `| ${(node.children || [])
          .map((child: any) =>
            escapeMarkdownTableCell(
              processNode(child)
                .replace(/\r\n|\r|\n/g, ' ')
                .trim(),
            ),
          )
          .join(' | ')} |\n`;
      case 'cell':
        return (
          (node.children || [])
            .map(processNode)
            .join(' ')
            .replace(/\r\n|\r|\n/g, ' ')
            .trim() || safeGetText(node)
        );
      default:
        if (node.children) {
          return node.children.map(processNode).join('');
        }
        return safeGetText(node);
    }
  }

  ast.content.forEach((node: any) => {
    markdown.push(processNode(node));
  });

  return normalizeMarkdown(markdown.join(''));
}
