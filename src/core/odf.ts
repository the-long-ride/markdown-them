import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { appendMarkdownTable } from "./markdown-utils";

type OdfKind = "odt" | "odp" | "ods";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StyleInfo {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}

interface RenderContext {
  zip: JSZip;
  styles: Map<string, StyleInfo>;
  manifest: Map<string, string>;
  imagePageCounts: Map<string, number>;
  pageCount: number;
  pageSize: Box;
  presentationMode: boolean;
}

interface PositionedItem extends Box {
  kind: "image" | "text";
  markdown: string;
  order: number;
  href?: string;
  byteLength?: number;
}

type OrderedXmlNode = Record<string, unknown>;

const DEFAULT_PAGE_SIZE: Box = { x: 0, y: 0, width: 10, height: 7.5 };

const odfParser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseAttributeValue: false,
  parseTagValue: false,
  preserveOrder: true,
  processEntities: false,
  textNodeName: "#text",
  transformAttributeName: localName,
  transformTagName: localName,
  trimValues: false,
});

export async function convertOdfData(data: ArrayBuffer | Uint8Array, kind?: OdfKind): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const contentXml = await readZipText(zip, "content.xml");

  if (!contentXml) {
    throw new Error("Invalid OpenDocument file: missing content.xml");
  }

  const root = parseOdfXml(contentXml, "content.xml");
  const documentContent = findFirst(root, "document-content") || findFirst(root, "document");
  const documentChildren = childrenOf(documentContent);
  const body = findFirst(documentChildren, "body");
  const bodyChildren = childrenOf(body);
  const styles = readStyles(documentChildren);
  const manifest = await readManifest(zip);
  const context: RenderContext = {
    zip,
    styles,
    manifest,
    imagePageCounts: new Map(),
    pageCount: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    presentationMode: false,
  };

  const spreadsheet = findFirst(bodyChildren, "spreadsheet");
  const presentation = findFirst(bodyChildren, "presentation");
  const textDocument = findFirst(bodyChildren, "text");

  if (kind === "ods" || spreadsheet) {
    return (await renderSpreadsheet(spreadsheet || body, context)).trim();
  }

  if (kind === "odp" || presentation) {
    return (await renderPresentation(presentation || body, context)).trim();
  }

  return (await renderFlowNodes(childrenOf(textDocument || body), context)).join("\n\n").trim();
}

async function renderPresentation(presentation: OrderedXmlNode | undefined, context: RenderContext): Promise<string> {
  const pages = directChildren(childrenOf(presentation), "page");
  context.pageCount = Math.max(1, pages.length);
  context.imagePageCounts = collectPresentationImageCounts(pages);

  const renderedPages: string[] = [];

  for (const page of pages) {
    const pageSize = readPageBox(page) || context.pageSize;
    const pageContext = { ...context, pageSize, presentationMode: true };
    const items = await collectPresentationItems(page, pageContext);
    const structuredItems = structurePositionedText(items, pageSize);
    structuredItems.sort((a, b) => comparePosition(a, b, pageSize));

    const markdown = structuredItems.map((item) => item.markdown).filter(Boolean).join("\n\n").trim();
    if (!markdown) {
      continue;
    }

    renderedPages.push(markdown);
  }

  return renderedPages.join("\n\n---\n\n");
}

async function collectPresentationItems(page: OrderedXmlNode, context: RenderContext): Promise<PositionedItem[]> {
  const items: PositionedItem[] = [];
  let order = 0;

  for (const child of childrenOf(page)) {
    const name = nodeName(child);

    if (name === "frame") {
      const frameItems = await renderFrameItems(child, context, order);
      order += Math.max(1, frameItems.length);
      items.push(...frameItems);
      continue;
    }

    if (name === "custom-shape" || name === "g") {
      const nested = await collectPositionedChildren(child, context, order);
      order += Math.max(1, nested.length);
      items.push(...nested);
      continue;
    }

    if (name === "p" || name === "h" || name === "list" || name === "table") {
      const markdown = (await renderFlowNode(child, context)).trim();
      if (markdown) {
        items.push({ kind: "text", markdown, order: order++, ...DEFAULT_PAGE_SIZE });
      }
    }
  }

  return items;
}

async function collectPositionedChildren(
  node: OrderedXmlNode,
  context: RenderContext,
  startOrder: number,
): Promise<PositionedItem[]> {
  const items: PositionedItem[] = [];
  let order = startOrder;

  for (const child of childrenOf(node)) {
    const name = nodeName(child);
    if (name === "frame") {
      const frameItems = await renderFrameItems(child, context, order);
      order += Math.max(1, frameItems.length);
      items.push(...frameItems);
    }
  }

  return items;
}

async function renderFrameItems(
  frame: OrderedXmlNode,
  context: RenderContext,
  order: number,
): Promise<PositionedItem[]> {
  const box = readFrameBox(frame);
  const items: PositionedItem[] = [];
  const image = findFirst(childrenOf(frame), "image");
  const href = image ? normalizeOdfHref(readAttr(image, "href") || "") : "";

  if (href) {
    const markdown = await renderImageMarkdown(href, context);
    const byteLength = markdown ? imageByteLengthFromMarkdown(markdown) : 0;

    if (markdown && shouldIncludePresentationImage({ ...box, href, byteLength }, context)) {
      items.push({ kind: "image", markdown, href, byteLength, order, ...box });
    }
  }

  const textBox = findFirst(childrenOf(frame), "text-box");
  const textNodes = textBox ? childrenOf(textBox) : childrenOf(frame).filter((child) => nodeName(child) !== "image");
  const textMarkdown = (await renderFlowNodes(textNodes, context)).join("\n\n").trim();

  if (textMarkdown) {
    items.push({ kind: "text", markdown: textMarkdown, order: order + items.length, ...box });
  }

  return items;
}

function structurePositionedText(items: PositionedItem[], pageSize: Box): PositionedItem[] {
  const structuredItems = items.map((item) => ({ ...item }));
  const heading = promotePageHeading(structuredItems, pageSize);
  return groupPositionedSections(structuredItems, pageSize, heading);
}

function promotePageHeading(items: PositionedItem[], pageSize: Box): PositionedItem | undefined {
  const textItems = items.filter((item) => item.kind === "text" && hasLetter(itemText(item)));
  let topItems = textItems.filter((item) => item.y <= pageSize.height * 0.32);

  if (topItems.length === 0) {
    const highestItem = [...textItems].sort((a, b) => comparePosition(a, b, pageSize))[0];
    if (!highestItem || highestItem.y > pageSize.height * 0.55) {
      return undefined;
    }

    topItems = textItems.filter((item) => item.y <= highestItem.y + pageSize.height * 0.1);
  }

  if (topItems.length === 0) {
    return undefined;
  }

  const minY = Math.min(...topItems.map((item) => item.y));
  const topBand = topItems.filter((item) => item.y <= minY + pageSize.height * 0.08);
  topBand.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > pageSize.height * 0.015) {
      return yDiff;
    }

    return b.width - a.width || comparePosition(a, b, pageSize);
  });

  const heading = topBand[0];
  if (heading && markdownHeadingLevel(heading.markdown) === undefined) {
    heading.markdown = `## ${heading.markdown}`;
  }

  return heading;
}

function groupPositionedSections(
  items: PositionedItem[],
  pageSize: Box,
  pageHeading?: PositionedItem,
): PositionedItem[] {
  const textItems = items.filter((item) => item.kind === "text" && hasLetter(itemText(item)));
  const titles = textItems.filter((item) => item !== pageHeading && isSectionTitleCandidate(item));
  const titleSet = new Set(titles);
  const assignments = new Map<PositionedItem, PositionedItem[]>();

  for (const body of textItems) {
    if (body === pageHeading || titleSet.has(body)) {
      continue;
    }

    const title = findNearestTitle(body, titles, pageSize);
    if (!title) {
      continue;
    }

    const bodies = assignments.get(title) || [];
    bodies.push(body);
    assignments.set(title, bodies);
  }

  if (assignments.size === 0) {
    return items;
  }

  const consumed = new Set<PositionedItem>();
  const grouped: PositionedItem[] = [];

  for (const item of items) {
    if (consumed.has(item)) {
      continue;
    }

    const bodies = assignments.get(item);
    if (bodies?.length) {
      bodies.sort((a, b) => comparePosition(a, b, pageSize));
      bodies.forEach((body) => consumed.add(body));
      grouped.push(combineSection(item, bodies));
      continue;
    }

    grouped.push(item);
  }

  return grouped;
}

function findNearestTitle(
  body: PositionedItem,
  titles: PositionedItem[],
  pageSize: Box,
): PositionedItem | undefined {
  const candidates = titles
    .filter((title) => {
      if (body.y < title.y + Math.min(title.height * 0.45, pageSize.height * 0.035)) {
        return false;
      }

      const verticalGap = Math.max(0, body.y - (title.y + title.height));
      if (verticalGap > pageSize.height * 0.16 || !isSameVisualColumn(title, body)) {
        return false;
      }

      return !titles.some(
        (otherTitle) =>
          otherTitle !== title &&
          otherTitle.y > title.y &&
          otherTitle.y < body.y &&
          isSameVisualColumn(otherTitle, body),
      );
    })
    .map((title) => ({
      title,
      centerDistance: Math.abs(centerX(title) - centerX(body)),
      verticalGap: Math.max(0, body.y - (title.y + title.height)),
    }));

  candidates.sort((a, b) => a.verticalGap - b.verticalGap || a.centerDistance - b.centerDistance);
  return candidates[0]?.title;
}

function combineSection(title: PositionedItem, bodies: PositionedItem[]): PositionedItem {
  const allItems = [title, ...bodies];
  const bounds = unionBoxes(allItems);

  return {
    ...title,
    markdown: allItems.map((item) => item.markdown).filter(Boolean).join("\n\n"),
    x: bounds.x,
    y: title.y,
    width: bounds.width,
    height: Math.max(title.height, bounds.y + bounds.height - title.y),
    order: Math.min(...allItems.map((item) => item.order)),
  };
}

async function renderSpreadsheet(spreadsheet: OrderedXmlNode | undefined, context: RenderContext): Promise<string> {
  const tables = directChildren(childrenOf(spreadsheet), "table");
  const markdown: string[] = [];

  for (const [index, table] of tables.entries()) {
    const sheetName = normalizeHeading(readAttr(table, "name") || `Sheet ${index + 1}`);
    const rows = await readOdsRows(table, context);

    if (markdown.length > 0) {
      markdown.push("");
    }

    markdown.push(`## ${sheetName}`, "");
    appendMarkdownTable(markdown, rows);
  }

  return markdown.join("\n").trimEnd();
}

async function readOdsRows(table: OrderedXmlNode, context: RenderContext): Promise<string[][]> {
  const rows: string[][] = [];

  for (const row of directChildren(childrenOf(table), "table-row")) {
    const repeatedRows = clampRepeat(readRepeat(row, "number-rows-repeated"));
    const cells = await readOdsCells(row, context);

    if (cells.length === 0 || !cells.some((cell) => cell.trim())) {
      continue;
    }

    for (let index = 0; index < repeatedRows; index += 1) {
      rows.push([...cells]);
    }
  }

  return rows;
}

async function readOdsCells(row: OrderedXmlNode, context: RenderContext): Promise<string[]> {
  const cells: string[] = [];

  for (const cell of childrenOf(row).filter((child) => ["table-cell", "covered-table-cell"].includes(nodeName(child) || ""))) {
    const repeatedColumns = clampRepeat(readRepeat(cell, "number-columns-repeated"));
    const cellText = await renderTableCell(cell, context);

    for (let index = 0; index < repeatedColumns; index += 1) {
      cells.push(cellText);
    }
  }

  while (cells.length > 0 && !cells[cells.length - 1]) {
    cells.pop();
  }

  return cells;
}

async function renderFlowNodes(nodes: OrderedXmlNode[], context: RenderContext, listDepth = 0): Promise<string[]> {
  const markdown: string[] = [];

  for (const node of nodes) {
    const rendered = await renderFlowNode(node, context, listDepth);
    if (rendered.trim()) {
      markdown.push(rendered.trim());
    }
  }

  return markdown;
}

async function renderFlowNode(node: OrderedXmlNode, context: RenderContext, listDepth = 0): Promise<string> {
  const name = nodeName(node);

  switch (name) {
    case "#text":
      return decodePredefinedXmlEntities(String(node["#text"] || "")).trim();
    case "h":
      return renderHeading(node, context);
    case "p":
      return renderParagraph(node, context);
    case "list":
      return renderList(node, context, listDepth);
    case "table":
      return renderOdfTable(node, context);
    case "section":
      return (await renderFlowNodes(childrenOf(node), context, listDepth)).join("\n\n");
    case "frame":
      return renderFrameMarkdown(node, context);
    default:
      return (await renderFlowNodes(childrenOf(node), context, listDepth)).join("\n\n");
  }
}

async function renderHeading(node: OrderedXmlNode, context: RenderContext): Promise<string> {
  const outlineLevel = Number(readAttr(node, "outline-level") || "2");
  const level = Number.isFinite(outlineLevel) ? Math.min(6, Math.max(1, Math.floor(outlineLevel))) : 2;
  const text = (await renderInlineNodes(childrenOf(node), context)).trim();
  return text ? `${"#".repeat(level)} ${text}` : "";
}

async function renderParagraph(node: OrderedXmlNode, context: RenderContext): Promise<string> {
  return normalizeInlineMarkdown(await renderInlineNodes(childrenOf(node), context));
}

async function renderList(node: OrderedXmlNode, context: RenderContext, depth: number): Promise<string> {
  const lines: string[] = [];
  const ordered = Boolean(findFirst(childrenOf(node), "list-level-style-number"));
  let index = 1;

  for (const item of directChildren(childrenOf(node), "list-item")) {
    const itemParts = await renderFlowNodes(childrenOf(item), context, depth + 1);
    const firstLine = itemParts.shift();
    if (!firstLine) {
      continue;
    }

    const marker = ordered ? `${index++}.` : "-";
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${marker} ${firstLine.replace(/\n+/g, " ")}`);

    for (const extra of itemParts) {
      lines.push(`${indent}  ${extra.replace(/\n+/g, " ")}`);
    }
  }

  return lines.join("\n");
}

async function renderOdfTable(table: OrderedXmlNode, context: RenderContext): Promise<string> {
  const rows = await readOdsRows(table, context);
  if (rows.length === 0) {
    return "";
  }

  const markdown: string[] = [];
  appendMarkdownTable(markdown, rows);
  return markdown.join("\n");
}

async function renderTableCell(cell: OrderedXmlNode, context: RenderContext): Promise<string> {
  const value = readAttr(cell, "value") || readAttr(cell, "string-value");
  const parts = await renderFlowNodes(childrenOf(cell), context);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text || value || "";
}

async function renderInlineNodes(nodes: OrderedXmlNode[], context: RenderContext, style?: StyleInfo): Promise<string> {
  const parts: string[] = [];

  for (const node of nodes) {
    const name = nodeName(node);

    if (name === "#text") {
      parts.push(applyInlineStyle(decodePredefinedXmlEntities(String(node["#text"] || "")), style));
      continue;
    }

    if (name === "s") {
      parts.push(" ".repeat(Math.max(1, readRepeat(node, "c"))));
      continue;
    }

    if (name === "tab") {
      parts.push("\t");
      continue;
    }

    if (name === "line-break") {
      parts.push("\n");
      continue;
    }

    if (name === "span" || name === "a") {
      const childStyle = mergeStyles(style, context.styles.get(readAttr(node, "style-name") || ""));
      parts.push(await renderInlineNodes(childrenOf(node), context, childStyle));
      continue;
    }

    if (name === "frame") {
      const frameMarkdown = await renderFrameMarkdown(node, context);
      if (frameMarkdown) {
        parts.push(`\n${frameMarkdown}\n`);
      }
      continue;
    }

    parts.push(await renderInlineNodes(childrenOf(node), context, style));
  }

  return parts.join("");
}

async function renderFrameMarkdown(frame: OrderedXmlNode, context: RenderContext): Promise<string> {
  const items = await renderFrameItems(frame, context, 0);
  return items.map((item) => item.markdown).filter(Boolean).join("\n\n");
}

async function renderImageMarkdown(href: string, context: RenderContext): Promise<string> {
  const filePath = normalizeOdfHref(href);
  const file = context.zip.file(filePath);

  if (!file || !isImagePath(filePath)) {
    return "";
  }

  const base64 = await file.async("base64");
  const mimeType = context.manifest.get(filePath) || fallbackMimeType(extensionName(filePath));
  return `![${escapeImageAlt(basename(filePath))}](data:${mimeType};base64,${base64})`;
}

function shouldIncludePresentationImage(
  image: Box & { href?: string; byteLength?: number },
  context: RenderContext,
): boolean {
  if (!image.href) {
    return false;
  }

  const areaRatio = (image.width * image.height) / Math.max(1, context.pageSize.width * context.pageSize.height);
  const fullPage = areaRatio > 0.9 && image.x <= context.pageSize.width * 0.05 && image.y <= context.pageSize.height * 0.05;
  const tiny = areaRatio < 0.006 || image.width < context.pageSize.width * 0.035 || image.height < context.pageSize.height * 0.035;

  if (!context.presentationMode) {
    return !tiny;
  }

  const small = areaRatio < 0.018 || image.width < context.pageSize.width * 0.075 || image.height < context.pageSize.height * 0.075;
  const repeated = (context.imagePageCounts.get(image.href) || 0) >= Math.max(2, Math.ceil(context.pageCount * 0.5));
  const lowInformationLargeImage = Boolean(image.byteLength && image.byteLength < 16384 && areaRatio >= 0.08);

  if (fullPage || tiny || lowInformationLargeImage) {
    return false;
  }

  if (repeated && small) {
    return false;
  }

  return true;
}

function collectPresentationImageCounts(pages: OrderedXmlNode[]): Map<string, number> {
  const imagePages = new Map<string, Set<number>>();

  pages.forEach((page, pageIndex) => {
    for (const image of findAll(page, "image")) {
      const href = normalizeOdfHref(readAttr(image, "href") || "");
      if (!href) {
        continue;
      }

      const pageSet = imagePages.get(href) || new Set<number>();
      pageSet.add(pageIndex);
      imagePages.set(href, pageSet);
    }
  });

  return new Map(Array.from(imagePages.entries()).map(([href, pageSet]) => [href, pageSet.size]));
}

function readStyles(documentChildren: OrderedXmlNode[]): Map<string, StyleInfo> {
  const styles = new Map<string, StyleInfo>();
  const styleParents = [
    ...directChildren(documentChildren, "automatic-styles"),
    ...directChildren(documentChildren, "styles"),
  ];

  for (const parent of styleParents) {
    for (const styleNode of directChildren(childrenOf(parent), "style")) {
      const name = readAttr(styleNode, "name");
      if (!name) {
        continue;
      }

      const textProperties = findFirst(childrenOf(styleNode), "text-properties");
      const attrs = attrsOf(textProperties);
      styles.set(name, {
        bold: isBold(attrs["font-weight"]),
        italic: attrs["font-style"] === "italic" || attrs["font-style-asian"] === "italic",
        strikethrough: Boolean(attrs["text-line-through-style"] && attrs["text-line-through-style"] !== "none"),
      });
    }
  }

  return styles;
}

async function readManifest(zip: JSZip): Promise<Map<string, string>> {
  const manifest = new Map<string, string>();
  const manifestXml = await readZipText(zip, "META-INF/manifest.xml");

  if (!manifestXml) {
    return manifest;
  }

  const root = parseOdfXml(manifestXml, "META-INF/manifest.xml");
  for (const fileEntry of findAllInNodes(root, "file-entry")) {
    const fullPath = normalizeOdfHref(readAttr(fileEntry, "full-path") || "");
    const mediaType = readAttr(fileEntry, "media-type");
    if (fullPath && mediaType) {
      manifest.set(fullPath, mediaType);
    }
  }

  return manifest;
}

async function readZipText(zip: JSZip, filePath: string): Promise<string | undefined> {
  const file = zip.file(filePath);
  return file ? file.async("text") : undefined;
}

function parseOdfXml(xml: string, partPath: string): OrderedXmlNode[] {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error(`Unsupported XML doctype in OpenDocument part: ${partPath}`);
  }

  return odfParser.parse(xml) as OrderedXmlNode[];
}

function nodeName(node: OrderedXmlNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(node, "#text")) {
    return "#text";
  }

  return Object.keys(node).find((key) => key !== ":@" && key !== "#text");
}

function childrenOf(node: OrderedXmlNode | undefined): OrderedXmlNode[] {
  const name = nodeName(node);
  const value = name ? node?.[name] : undefined;
  return Array.isArray(value) ? (value as OrderedXmlNode[]) : [];
}

function directChildren(nodes: OrderedXmlNode[], name: string): OrderedXmlNode[] {
  return nodes.filter((node) => nodeName(node) === name);
}

function findFirst(nodes: OrderedXmlNode[] | OrderedXmlNode | undefined, name: string): OrderedXmlNode | undefined {
  const list = Array.isArray(nodes) ? nodes : nodes ? [nodes] : [];

  for (const node of list) {
    if (nodeName(node) === name) {
      return node;
    }

    const nested = findFirst(childrenOf(node), name);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function findAll(node: OrderedXmlNode, name: string): OrderedXmlNode[] {
  return findAllInNodes([node], name);
}

function findAllInNodes(nodes: OrderedXmlNode[], name: string): OrderedXmlNode[] {
  const matches: OrderedXmlNode[] = [];

  for (const node of nodes) {
    if (nodeName(node) === name) {
      matches.push(node);
    }

    matches.push(...findAllInNodes(childrenOf(node), name));
  }

  return matches;
}

function attrsOf(node: OrderedXmlNode | undefined): Record<string, string> {
  const attrs = node?.[":@"] as Record<string, unknown> | undefined;
  if (!attrs) {
    return {};
  }

  return Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key, String(value)]));
}

function readAttr(node: OrderedXmlNode | undefined, name: string): string | undefined {
  const value = attrsOf(node)[name];
  return value === undefined ? undefined : decodePredefinedXmlEntities(value);
}

function readRepeat(node: OrderedXmlNode, name: string): number {
  const value = Number(readAttr(node, name) || "1");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function clampRepeat(value: number): number {
  return Math.min(1000, Math.max(1, value));
}

function readFrameBox(frame: OrderedXmlNode): Box {
  return {
    x: readUnit(readAttr(frame, "x")),
    y: readUnit(readAttr(frame, "y")),
    width: readUnit(readAttr(frame, "width")),
    height: readUnit(readAttr(frame, "height")),
  };
}

function readPageBox(page: OrderedXmlNode): Box | undefined {
  const width = readUnit(readAttr(page, "width"));
  const height = readUnit(readAttr(page, "height"));
  return width > 0 && height > 0 ? { x: 0, y: 0, width, height } : undefined;
}

function readUnit(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(cm|in|mm|pt|px)?$/i);
  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);
  const unit = (match[2] || "in").toLowerCase();
  if (!Number.isFinite(amount)) {
    return 0;
  }

  switch (unit) {
    case "cm":
      return amount / 2.54;
    case "mm":
      return amount / 25.4;
    case "pt":
      return amount / 72;
    case "px":
      return amount / 96;
    default:
      return amount;
  }
}

function comparePosition(a: PositionedItem, b: PositionedItem, pageSize: Box): number {
  const yTolerance = Math.max(0.01, pageSize.height * 0.025);
  const xTolerance = Math.max(0.01, pageSize.width * 0.015);
  const yDiff = a.y - b.y;

  if (Math.abs(yDiff) > yTolerance) {
    return yDiff;
  }

  const xDiff = a.x - b.x;
  if (Math.abs(xDiff) > xTolerance) {
    return xDiff;
  }

  return a.order - b.order;
}

function isSectionTitleCandidate(item: PositionedItem): boolean {
  const text = itemText(item);
  return (
    item.kind === "text" &&
    hasLetter(text) &&
    text.length <= 120 &&
    !/^[\d\s%.,:/-]+$/.test(text) &&
    (markdownHeadingLevel(item.markdown) !== undefined || boldRatio(item.markdown) > 0.4)
  );
}

function itemText(item: PositionedItem): string {
  return stripMarkdown(item.markdown).replace(/\s+/g, " ").trim();
}

function boldRatio(markdown: string): number {
  const stripped = stripMarkdown(markdown);
  if (!stripped) {
    return 0;
  }

  const boldText = Array.from(markdown.matchAll(/\*\*([\s\S]*?)\*\*/g)).map((match) => match[1]).join("");
  return boldText.length / stripped.length;
}

function markdownHeadingLevel(markdown: string): number | undefined {
  const match = markdown.match(/^(#{1,6})\s+/);
  return match ? match[1].length : undefined;
}

function stripMarkdown(markdown: string): string {
  return markdown.replace(/^#{1,6}\s+/, "").replace(/!\[[^\]]*]\([^)]*\)/g, "").replace(/[*_~`]/g, "");
}

function isSameVisualColumn(left: PositionedItem, right: PositionedItem): boolean {
  const overlap = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const minWidth = Math.min(left.width, right.width);
  const overlapRatio = minWidth > 0 ? overlap / minWidth : 0;
  const centerDistance = Math.abs(centerX(left) - centerX(right));
  return overlapRatio >= 0.35 || centerDistance <= Math.max(left.width, right.width) * 0.42;
}

function centerX(item: PositionedItem): number {
  return item.x + item.width / 2;
}

function unionBoxes(items: PositionedItem[]): Box {
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function applyInlineStyle(text: string, style?: StyleInfo): string {
  if (!text || !style) {
    return text;
  }

  let markdown = text;
  if (style.bold) {
    markdown = wrapMarkdown(markdown, "**");
  }
  if (style.italic) {
    markdown = wrapMarkdown(markdown, "*");
  }
  if (style.strikethrough) {
    markdown = wrapMarkdown(markdown, "~~");
  }

  return markdown;
}

function mergeStyles(parent: StyleInfo | undefined, child: StyleInfo | undefined): StyleInfo | undefined {
  if (!parent && !child) {
    return undefined;
  }

  return { ...parent, ...child };
}

function wrapMarkdown(value: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match || !match[2]) {
    return value;
  }

  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

function normalizeInlineMarkdown(value: string): string {
  return value.replace(/\r\n|\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeHeading(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ").trim() || "Sheet";
}

function decodePredefinedXmlEntities(value: string): string {
  return value.replace(/&(amp|apos|gt|lt|quot);/g, (_, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "apos":
        return "'";
      case "gt":
        return ">";
      case "lt":
        return "<";
      case "quot":
        return '"';
      default:
        return `&${entity};`;
    }
  });
}

function normalizeOdfHref(href: string): string {
  return href.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function escapeImageAlt(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ").replace(/]/g, "\\]").trim() || "Image";
}

function isImagePath(filePath: string): boolean {
  return /\.(avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf)$/i.test(filePath);
}

function fallbackMimeType(extension: string): string {
  switch (extension) {
    case "avif":
      return "image/avif";
    case "bmp":
      return "image/bmp";
    case "emf":
      return "image/x-emf";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "webp":
      return "image/webp";
    case "wmf":
      return "image/wmf";
    default:
      return "application/octet-stream";
  }
}

function extensionName(filePath: string): string {
  const name = basename(filePath);
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
}

function basename(filePath: string): string {
  const normalized = normalizeOdfHref(filePath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

function imageByteLengthFromMarkdown(markdown: string): number {
  const match = markdown.match(/;base64,([^)]*)\)/);
  if (!match) {
    return 0;
  }

  const base64 = match[1];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function isBold(value: string | undefined): boolean {
  return value === "bold" || value === "700" || value === "800" || value === "900";
}

function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

function localName(name: string): string {
  const colonIndex = name.indexOf(":");
  return colonIndex >= 0 ? name.slice(colonIndex + 1) : name;
}
