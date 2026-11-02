import type { OrderedXmlNode, RenderContext, StyleInfo } from './types';
import {
  childrenOf,
  decodePredefinedXmlEntities,
  directChildren,
  findFirst,
  nodeName,
  readAttr,
  readRepeat,
} from './xml';
import { applyInlineStyle, mergeStyles, normalizeInlineMarkdown } from './styles';
import { renderOdfTable } from './spreadsheet';
import { renderFrameMarkdown } from './presentation';

export async function renderInlineNodes(
  nodes: OrderedXmlNode[],
  context: RenderContext,
  style?: StyleInfo,
): Promise<string> {
  const parts: string[] = [];

  for (const node of nodes) {
    const name = nodeName(node);

    if (name === '#text') {
      parts.push(applyInlineStyle(decodePredefinedXmlEntities(String(node['#text'] || '')), style));
      continue;
    }

    if (name === 's') {
      parts.push(' '.repeat(Math.max(1, readRepeat(node, 'c'))));
      continue;
    }

    if (name === 'tab') {
      parts.push('\t');
      continue;
    }

    if (name === 'line-break') {
      parts.push('\n');
      continue;
    }

    if (name === 'span' || name === 'a') {
      const childStyle = mergeStyles(style, context.styles.get(readAttr(node, 'style-name') || ''));
      parts.push(await renderInlineNodes(childrenOf(node), context, childStyle));
      continue;
    }

    if (name === 'frame') {
      const frameMarkdown = await renderFrameMarkdown(node, context);
      if (frameMarkdown) {
        parts.push(`\n${frameMarkdown}\n`);
      }
      continue;
    }

    parts.push(await renderInlineNodes(childrenOf(node), context, style));
  }

  return parts.join('');
}

export async function renderHeading(node: OrderedXmlNode, context: RenderContext): Promise<string> {
  const outlineLevel = Number(readAttr(node, 'outline-level') || '2');
  const level = Number.isFinite(outlineLevel)
    ? Math.min(6, Math.max(1, Math.floor(outlineLevel)))
    : 2;
  const text = (await renderInlineNodes(childrenOf(node), context)).trim();
  return text ? `${'#'.repeat(level)} ${text}` : '';
}

export async function renderParagraph(
  node: OrderedXmlNode,
  context: RenderContext,
): Promise<string> {
  return normalizeInlineMarkdown(await renderInlineNodes(childrenOf(node), context));
}

export async function renderList(
  node: OrderedXmlNode,
  context: RenderContext,
  depth: number,
): Promise<string> {
  const lines: string[] = [];
  const ordered = Boolean(findFirst(childrenOf(node), 'list-level-style-number'));
  let index = 1;

  for (const item of directChildren(childrenOf(node), 'list-item')) {
    const itemParts = await renderFlowNodes(childrenOf(item), context, depth + 1);
    const firstLine = itemParts.shift();
    if (!firstLine) {
      continue;
    }

    const marker = ordered ? `${index++}.` : '-';
    const indent = '  '.repeat(depth);
    lines.push(`${indent}${marker} ${firstLine.replace(/\n+/g, ' ')}`);

    for (const extra of itemParts) {
      lines.push(`${indent}  ${extra.replace(/\n+/g, ' ')}`);
    }
  }

  return lines.join('\n');
}

export async function renderFlowNode(
  node: OrderedXmlNode,
  context: RenderContext,
  listDepth = 0,
): Promise<string> {
  const name = nodeName(node);

  switch (name) {
    case '#text':
      return decodePredefinedXmlEntities(String(node['#text'] || '')).trim();
    case 'h':
      return renderHeading(node, context);
    case 'p':
      return renderParagraph(node, context);
    case 'list':
      return renderList(node, context, listDepth);
    case 'table':
      return renderOdfTable(node, context);
    case 'section':
      return (await renderFlowNodes(childrenOf(node), context, listDepth)).join('\n\n');
    case 'frame':
      return renderFrameMarkdown(node, context);
    default:
      return (await renderFlowNodes(childrenOf(node), context, listDepth)).join('\n\n');
  }
}

export async function renderFlowNodes(
  nodes: OrderedXmlNode[],
  context: RenderContext,
  listDepth = 0,
): Promise<string[]> {
  const markdown: string[] = [];

  for (const node of nodes) {
    const rendered = await renderFlowNode(node, context, listDepth);
    if (rendered.trim()) {
      markdown.push(rendered.trim());
    }
  }

  return markdown;
}
