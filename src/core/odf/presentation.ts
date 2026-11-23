import type { Box, OrderedXmlNode, PositionedItem, RenderContext } from './types';
import { DEFAULT_PAGE_SIZE } from './types';
import { childrenOf, directChildren, findFirst, nodeName, readAttr } from './xml';
import { comparePosition, readFrameBox, readPageBox } from './geometry';
import { normalizeOdfHref } from './styles';
import {
  collectPresentationImageCounts,
  imageByteLengthFromMarkdown,
  renderImageMarkdown,
  shouldIncludePresentationImage,
} from './images';
import { structurePositionedText } from './layout';
import { renderFlowNode, renderFlowNodes } from './flow';

export async function renderFrameItems(
  frame: OrderedXmlNode,
  context: RenderContext,
  order: number,
): Promise<PositionedItem[]> {
  const box = readFrameBox(frame);
  const items: PositionedItem[] = [];
  const frameChildren = childrenOf(frame);
  const image = findFirst(frameChildren, 'image');
  const href = image ? normalizeOdfHref(readAttr(image, 'href') || '') : '';

  if (href) {
    const markdown = await renderImageMarkdown(href, context);
    const byteLength = markdown ? imageByteLengthFromMarkdown(markdown) : 0;

    if (markdown && shouldIncludePresentationImage({ ...box, href, byteLength }, context)) {
      items.push({ kind: 'image', markdown, href, byteLength, order, ...box });
    }
  }

  const [textBox] = directChildren(frameChildren, 'text-box');
  const textNodes = textBox
    ? childrenOf(textBox)
    : frameChildren.filter((child) => nodeName(child) !== 'image');
  const elements = textNodes.filter((child) => nodeName(child) !== '#text');
  const table = elements.length === 1 && nodeName(elements[0]) === 'table';
  const markdown = (await renderFlowNodes(textNodes, context)).join('\n\n').trim();

  if (markdown) {
    items.push({ kind: table ? 'table' : 'text', markdown, order: order + items.length, ...box });
  }

  return items;
}

export async function renderFrameMarkdown(
  frame: OrderedXmlNode,
  context: RenderContext,
): Promise<string> {
  const items = await renderFrameItems(frame, context, 0);
  return items
    .map((item) => item.markdown)
    .filter(Boolean)
    .join('\n\n');
}

export async function collectPositionedChildren(
  node: OrderedXmlNode,
  context: RenderContext,
  startOrder: number,
): Promise<PositionedItem[]> {
  const items: PositionedItem[] = [];
  let order = startOrder;

  for (const child of childrenOf(node)) {
    const name = nodeName(child);
    if (name === 'frame') {
      const frameItems = await renderFrameItems(child, context, order);
      order += Math.max(1, frameItems.length);
      items.push(...frameItems);
    }
  }

  return items;
}

export async function collectPresentationItems(
  page: OrderedXmlNode,
  context: RenderContext,
): Promise<PositionedItem[]> {
  const items: PositionedItem[] = [];
  let order = 0;

  for (const child of childrenOf(page)) {
    const name = nodeName(child);

    if (name === 'frame') {
      const frameItems = await renderFrameItems(child, context, order);
      order += Math.max(1, frameItems.length);
      items.push(...frameItems);
      continue;
    }

    if (name === 'custom-shape' || name === 'g') {
      const nested = await collectPositionedChildren(child, context, order);
      order += Math.max(1, nested.length);
      items.push(...nested);
      continue;
    }

    if (name === 'p' || name === 'h' || name === 'list' || name === 'table') {
      const markdown = (await renderFlowNode(child, context)).trim();
      if (markdown) {
        items.push({
          kind: name === 'table' ? 'table' : 'text',
          markdown,
          order: order++,
          ...DEFAULT_PAGE_SIZE,
        });
      }
    }
  }

  return items;
}

export async function renderPresentation(
  presentation: OrderedXmlNode | undefined,
  context: RenderContext,
): Promise<string> {
  const pages = directChildren(childrenOf(presentation), 'page');
  context.pageCount = Math.max(1, pages.length);
  context.imagePageCounts = collectPresentationImageCounts(pages);

  const renderedPages: string[] = [];

  for (const page of pages) {
    const pageSize = readPageBox(page) || context.pageSize;
    const pageContext = { ...context, pageSize, presentationMode: true };
    const items = await collectPresentationItems(page, pageContext);
    const structuredItems = structurePositionedText(items, pageSize);
    structuredItems.sort((a, b) => comparePosition(a, b, pageSize));

    const markdown = structuredItems
      .map((item) => item.markdown)
      .filter(Boolean)
      .join('\n\n')
      .trim();
    if (!markdown) {
      continue;
    }

    renderedPages.push(markdown);
  }

  return renderedPages.join('\n\n---\n\n');
}
