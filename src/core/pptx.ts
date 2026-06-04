import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { appendMarkdownTable } from "./markdown-utils";

interface SlideSize {
  width: number;
  height: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

interface Relationship {
  target: string;
  type: string;
  external: boolean;
}

interface ContentTypes {
  defaults: Map<string, string>;
  overrides: Map<string, string>;
}

interface TextParagraph {
  markdown: string;
  plainText: string;
  bullet?: "ordered" | "unordered";
  level: number;
  maxFontSize: number;
  allBold: boolean;
}

interface PositionedItem extends Box {
  order: number;
}

interface TextItem extends PositionedItem {
  kind: "text" | "table";
  markdown: string;
  plainText?: string;
  maxFontSize?: number;
  headingLevel?: number;
  hasBullet?: boolean;
  allBold?: boolean;
  paragraphCount?: number;
}

interface ImageItem extends PositionedItem {
  kind: "image";
  mediaPath: string;
  mimeType: string;
  altText: string;
  name: string;
  description: string;
}

type SlideItem = TextItem | ImageItem;

interface ParsedSlide {
  index: number;
  size: SlideSize;
  items: SlideItem[];
}

interface CollectorContext {
  relationships: Map<string, Relationship>;
  contentTypes: ContentTypes;
  items: SlideItem[];
  nextOrder: number;
}

interface TextBodyInfo {
  paragraphs: TextParagraph[];
  maxFontSize: number;
  plainText: string;
  hasBullet: boolean;
  allBold: boolean;
}

interface TextRun {
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  lineBreak?: boolean;
}

type RenderableItem = PositionedItem &
  Partial<Pick<TextItem, "allBold" | "hasBullet" | "headingLevel" | "maxFontSize" | "paragraphCount" | "plainText">> & {
    kind: SlideItem["kind"];
    markdown: string;
  };

const DEFAULT_SLIDE_SIZE: SlideSize = { width: 9144000, height: 5143500 };
const IDENTITY_TRANSFORM: Transform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };

const xmlParser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: false,
  textNodeName: "#text",
  transformTagName: localTagName,
  trimValues: false,
});

export async function convertPptxData(data: ArrayBuffer | Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const presentationXml = await readZipText(zip, "ppt/presentation.xml");

  if (!presentationXml) {
    throw new Error("Invalid PPTX file: missing ppt/presentation.xml");
  }

  const presentation = parseXml(presentationXml, "ppt/presentation.xml")?.presentation;
  const slideSize = readSlideSize(presentation?.sldSz);
  const contentTypes = await readContentTypes(zip);
  const presentationRelationships = await readRelationships(zip, "ppt/_rels/presentation.xml.rels", "ppt");
  const slideRefs = toArray(presentation?.sldIdLst?.sldId);
  const slides: ParsedSlide[] = [];

  for (const [index, slideRef] of slideRefs.entries()) {
    const relationshipId = readAttr(slideRef, "r:id");
    const relationship = relationshipId ? presentationRelationships.get(relationshipId) : undefined;

    if (!relationship || relationship.external) {
      continue;
    }

    const slide = await readSlide(zip, relationship.target, index + 1, slideSize, contentTypes);
    if (slide) {
      slides.push(slide);
    }
  }

  return renderSlides(zip, slides);
}

async function readSlide(
  zip: JSZip,
  slidePath: string,
  slideIndex: number,
  slideSize: SlideSize,
  contentTypes: ContentTypes,
): Promise<ParsedSlide | undefined> {
  const slideXml = await readZipText(zip, slidePath);

  if (!slideXml) {
    return undefined;
  }

  const relationships = await readRelationships(zip, relationshipsPathForPart(slidePath), dirname(slidePath));
  const slide = parseXml(slideXml, slidePath)?.sld;
  const spTree = slide?.cSld?.spTree;
  const context: CollectorContext = {
    relationships,
    contentTypes,
    items: [],
    nextOrder: 0,
  };

  collectShapeTree(spTree, context, IDENTITY_TRANSFORM);

  return {
    index: slideIndex,
    size: slideSize,
    items: context.items,
  };
}

function collectShapeTree(shapeTree: any, context: CollectorContext, transform: Transform): void {
  if (!shapeTree || typeof shapeTree !== "object") {
    return;
  }

  for (const [tagName, value] of Object.entries(shapeTree)) {
    if (tagName.startsWith("@_") || tagName === "#text") {
      continue;
    }

    switch (tagName) {
      case "sp":
        toArray(value).forEach((shape) => collectTextShape(shape, context, transform));
        break;
      case "pic":
        toArray(value).forEach((picture) => collectPicture(picture, context, transform));
        break;
      case "graphicFrame":
        toArray(value).forEach((frame) => collectGraphicFrame(frame, context, transform));
        break;
      case "grpSp":
        toArray(value).forEach((group) => collectGroup(group, context, transform));
        break;
      default:
        break;
    }
  }
}

function collectGroup(group: any, context: CollectorContext, transform: Transform): void {
  const groupTransform = composeGroupTransform(transform, group?.grpSpPr?.xfrm);
  collectShapeTree(group, context, groupTransform);
}

function collectTextShape(shape: any, context: CollectorContext, transform: Transform): void {
  const textBody = readTextBody(shape?.txBody);
  if (textBody.paragraphs.length === 0) {
    return;
  }

  const headingLevel = inferHeadingLevel(shape, textBody);
  const markdown = formatTextBody(textBody.paragraphs, headingLevel);
  if (!markdown.trim()) {
    return;
  }

  context.items.push({
    kind: "text",
    markdown,
    plainText: textBody.plainText,
    maxFontSize: textBody.maxFontSize,
    headingLevel,
    hasBullet: textBody.hasBullet,
    allBold: textBody.allBold,
    paragraphCount: textBody.paragraphs.length,
    order: context.nextOrder++,
    ...applyTransform(transform, readElementBox(shape?.spPr?.xfrm)),
  });
}

function collectGraphicFrame(frame: any, context: CollectorContext, transform: Transform): void {
  const tableMarkdown = readTableMarkdown(frame);
  if (!tableMarkdown) {
    return;
  }

  context.items.push({
    kind: "table",
    markdown: tableMarkdown,
    order: context.nextOrder++,
    ...applyTransform(transform, readElementBox(frame?.xfrm)),
  });
}

function collectPicture(picture: any, context: CollectorContext, transform: Transform): void {
  const relId = readAnyAttr(picture?.blipFill?.blip, ["r:embed", "embed"]);
  const relationship = relId ? context.relationships.get(relId) : undefined;

  if (!relationship || relationship.external || !isImagePart(relationship.target)) {
    return;
  }

  const nonVisualProps = picture?.nvPicPr?.cNvPr;
  const name = normalizeInlineText(readAttr(nonVisualProps, "name") || "");
  const description = normalizeInlineText(readAttr(nonVisualProps, "descr") || "");
  const altText = preferredAltText(name, description);

  context.items.push({
    kind: "image",
    mediaPath: relationship.target,
    mimeType: mimeTypeForPart(context.contentTypes, relationship.target),
    altText,
    name,
    description,
    order: context.nextOrder++,
    ...applyTransform(transform, readElementBox(picture?.spPr?.xfrm)),
  });
}

function readTextBody(textBody: any): TextBodyInfo {
  const paragraphs = toArray(textBody?.p)
    .map(readParagraph)
    .filter((paragraph): paragraph is TextParagraph => Boolean(paragraph?.markdown.trim()));
  const maxFontSize = paragraphs.reduce((max, paragraph) => Math.max(max, paragraph.maxFontSize), 0);
  const plainText = paragraphs.map((paragraph) => paragraph.plainText).join("\n").trim();
  const hasBullet = paragraphs.some((paragraph) => Boolean(paragraph.bullet));
  const allBold = paragraphs.length > 0 && paragraphs.every((paragraph) => paragraph.allBold);

  return { paragraphs, maxFontSize, plainText, hasBullet, allBold };
}

function readParagraph(paragraph: any): TextParagraph | undefined {
  if (!paragraph || typeof paragraph !== "object") {
    return undefined;
  }

  const runs: TextRun[] = [];

  for (const [tagName, value] of Object.entries(paragraph)) {
    switch (tagName) {
      case "r":
        toArray(value).forEach((run) => runs.push(readRun(run)));
        break;
      case "fld":
        toArray(value).forEach((field) => runs.push(readRun(field)));
        break;
      case "br":
        toArray(value).forEach(() =>
          runs.push({ text: "\n", fontSize: 0, bold: false, italic: false, strikethrough: false, lineBreak: true }),
        );
        break;
      default:
        break;
    }
  }

  const markdown = normalizeParagraphText(formatRuns(runs));
  const plainText = normalizeParagraphText(runs.map((run) => run.text).join(""));
  if (!markdown.trim()) {
    return undefined;
  }

  const paragraphProperties = paragraph?.pPr;
  const bullet = readBulletKind(paragraphProperties);
  const level = clampInteger(readNumberAttr(paragraphProperties, "lvl"), 0, 8);
  const defaultFontSize = readFontSize(paragraphProperties?.defRPr);
  const maxFontSize = runs.reduce((max, run) => Math.max(max, run.fontSize), defaultFontSize);
  const textRuns = runs.filter((run) => !run.lineBreak && run.text.trim());
  const allBold = textRuns.length > 0 && textRuns.every((run) => run.bold);

  return { markdown, plainText, bullet, level, maxFontSize, allBold };
}

function readRun(run: any): TextRun {
  const text = normalizeInlineText(textValue(run?.t));
  const runProperties = run?.rPr;

  return {
    text,
    fontSize: readFontSize(runProperties),
    bold: isTruthy(readAttr(runProperties, "b")),
    italic: isTruthy(readAttr(runProperties, "i")),
    strikethrough: isStruck(runProperties),
  };
}

function formatRuns(runs: TextRun[]): string {
  return mergeAdjacentRuns(runs).map(formatRun).join("");
}

function mergeAdjacentRuns(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = [];

  for (const run of runs) {
    const previous = merged[merged.length - 1];

    if (previous && canMergeRuns(previous, run)) {
      previous.text += run.text;
      previous.fontSize = Math.max(previous.fontSize, run.fontSize);
      continue;
    }

    merged.push({ ...run });
  }

  return merged;
}

function canMergeRuns(left: TextRun, right: TextRun): boolean {
  return (
    !left.lineBreak &&
    !right.lineBreak &&
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.strikethrough === right.strikethrough
  );
}

function formatRun(run: TextRun): string {
  if (run.lineBreak) {
    return "\n";
  }

  let markdown = run.text;
  if (run.bold) {
    markdown = wrapMarkdown(markdown, "**");
  }
  if (run.italic) {
    markdown = wrapMarkdown(markdown, "*");
  }
  if (run.strikethrough) {
    markdown = wrapMarkdown(markdown, "~~");
  }

  return markdown;
}

function formatTextBody(paragraphs: TextParagraph[], headingLevel?: number): string {
  const lines: string[] = [];
  let orderedIndex = 1;
  let headingApplied = false;

  for (const paragraph of paragraphs) {
    const text = paragraph.markdown.replace(/\n+/g, " ").trim();
    if (!text) {
      continue;
    }

    if (paragraph.bullet) {
      const indent = "  ".repeat(paragraph.level);
      const marker = paragraph.bullet === "ordered" ? `${orderedIndex++}.` : "-";
      lines.push(`${indent}${marker} ${text}`);
      continue;
    }

    orderedIndex = 1;

    if (headingLevel && !headingApplied) {
      lines.push(`${"#".repeat(headingLevel)} ${text}`);
      headingApplied = true;
      continue;
    }

    lines.push(text);
  }

  return lines.join("\n");
}

function inferHeadingLevel(shape: any, textBody: TextBodyInfo): number | undefined {
  const placeholderType = readPlaceholderType(shape);

  if (placeholderType === "title" || placeholderType === "ctrTitle") {
    return 1;
  }
  if (placeholderType === "subTitle") {
    return 2;
  }

  if (textBody.paragraphs.length > 2 || textBody.paragraphs.some((paragraph) => paragraph.bullet)) {
    return undefined;
  }

  if (!hasLetter(textBody.plainText)) {
    return undefined;
  }

  if (textBody.maxFontSize >= 3600) {
    return 1;
  }
  if (textBody.maxFontSize >= 2400) {
    return 2;
  }
  if (textBody.maxFontSize >= 1800) {
    return 3;
  }

  return undefined;
}

function readTableMarkdown(frame: any): string | undefined {
  const table = frame?.graphic?.graphicData?.tbl;
  if (!table) {
    return undefined;
  }

  const rows = toArray(table.tr)
    .map((row) => toArray(row?.tc).map((cell) => readTextBodyPlain(cell?.txBody)))
    .filter((row) => row.some((cell) => cell.trim()));

  if (rows.length === 0) {
    return undefined;
  }

  const markdown: string[] = [];
  appendMarkdownTable(markdown, rows);
  return markdown.join("\n");
}

function readTextBodyPlain(textBody: any): string {
  return readTextBody(textBody)
    .paragraphs.map((paragraph) => paragraph.markdown.replace(/\n+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

async function renderSlides(zip: JSZip, slides: ParsedSlide[]): Promise<string> {
  const imageSlideCounts = collectImageSlideCounts(slides);
  const slideMarkdown: string[] = [];

  for (const slide of slides) {
    const renderedItems = await renderSlideItems(zip, slide, imageSlideCounts, slides.length);
    if (renderedItems.length === 0) {
      continue;
    }

    if (slideMarkdown.length > 0) {
      slideMarkdown.push("", "---", "");
    }

    slideMarkdown.push(renderedItems.join("\n\n"));
  }

  return slideMarkdown.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

async function renderSlideItems(
  zip: JSZip,
  slide: ParsedSlide,
  imageSlideCounts: Map<string, number>,
  slideCount: number,
): Promise<string[]> {
  const hasTextContent = slide.items.some((item) => item.kind !== "image" && item.markdown.trim());
  const positionedItems: RenderableItem[] = [];

  for (const item of slide.items) {
    if (item.kind === "image") {
      if (
        !shouldIncludeImage(item, slide.size, imageSlideCounts.get(item.mediaPath) || 0, slideCount, hasTextContent, 0)
      ) {
        continue;
      }

      const base64 = await readImageBase64(zip, item);
      if (!base64) {
        continue;
      }

      if (
        !shouldIncludeImage(
          item,
          slide.size,
          imageSlideCounts.get(item.mediaPath) || 0,
          slideCount,
          hasTextContent,
          base64ByteLength(base64),
        )
      ) {
        continue;
      }

      positionedItems.push({ ...item, markdown: renderImageMarkdown(item, base64) });
      continue;
    }

    positionedItems.push({ ...item, markdown: item.markdown.trim() });
  }

  const structuredItems = structureTextItems(positionedItems, slide.size);
  structuredItems.sort((a, b) => comparePosition(a, b, slide.size));
  return structuredItems.map((item) => item.markdown).filter(Boolean);
}

async function readImageBase64(zip: JSZip, image: ImageItem): Promise<string> {
  const file = zip.file(image.mediaPath);
  if (!file) {
    return "";
  }

  return file.async("base64");
}

function renderImageMarkdown(image: ImageItem, base64: string): string {
  return `![${escapeImageAlt(image.altText)}](data:${image.mimeType};base64,${base64})`;
}

function structureTextItems(items: RenderableItem[], slideSize: SlideSize): RenderableItem[] {
  const structuredItems = items.map((item) => ({ ...item }));
  const slideHeading = promoteSlideHeading(structuredItems, slideSize);
  normalizeNonSlideHeadings(structuredItems, slideHeading, slideSize);
  return groupSectionTextItems(structuredItems, slideSize, slideHeading);
}

function promoteSlideHeading(items: RenderableItem[], slideSize: SlideSize): RenderableItem | undefined {
  const heading = findSlideHeading(items, slideSize);
  if (!heading) {
    return undefined;
  }

  const level = markdownHeadingLevel(heading.markdown);
  if (level === undefined || level > 2) {
    heading.markdown = `## ${stripMarkdownHeading(heading.markdown)}`;
    heading.headingLevel = 2;
  }

  return heading;
}

function findSlideHeading(items: RenderableItem[], slideSize: SlideSize): RenderableItem | undefined {
  const textItems = items.filter((item) => isShapeTextItem(item) && isMeaningfulTextItem(item));
  const topLimit = slideSize.height * 0.32;
  let topItems = textItems.filter((item) => item.y <= topLimit);

  if (topItems.length === 0) {
    const highestItem = [...textItems].sort((a, b) => comparePosition(a, b, slideSize))[0];
    if (!highestItem || highestItem.y > slideSize.height * 0.55 || (highestItem.maxFontSize || 0) < 2400) {
      return undefined;
    }

    topItems = textItems.filter((item) => item.y <= highestItem.y + slideSize.height * 0.1);
  }

  const minY = Math.min(...topItems.map((item) => item.y));
  const topBand = topItems.filter((item) => item.y <= minY + slideSize.height * 0.08);

  topBand.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > slideSize.height * 0.015) {
      return yDiff;
    }

    const fontDiff = (b.maxFontSize || 0) - (a.maxFontSize || 0);
    if (fontDiff !== 0) {
      return fontDiff;
    }

    const widthDiff = b.width - a.width;
    if (widthDiff !== 0) {
      return widthDiff;
    }

    return comparePosition(a, b, slideSize);
  });

  return topBand[0];
}

function normalizeNonSlideHeadings(
  items: RenderableItem[],
  slideHeading: RenderableItem | undefined,
  slideSize: SlideSize,
): void {
  for (const item of items) {
    if (item === slideHeading || !isShapeTextItem(item)) {
      continue;
    }

    const headingLevel = markdownHeadingLevel(item.markdown);
    if (headingLevel === undefined || headingLevel > 2) {
      continue;
    }

    if (slideHeading && item.y <= slideHeading.y + slideSize.height * 0.18) {
      continue;
    }

    const content = stripMarkdownHeading(item.markdown);
    if (isSectionTitleCandidate({ ...item, markdown: content, headingLevel: undefined })) {
      item.markdown = `### ${content}`;
      item.headingLevel = 3;
      continue;
    }

    item.markdown = content;
    item.headingLevel = undefined;
  }
}

function groupSectionTextItems(
  items: RenderableItem[],
  slideSize: SlideSize,
  slideHeading?: RenderableItem,
): RenderableItem[] {
  const textItems = items.filter((item) => isShapeTextItem(item) && isMeaningfulTextItem(item));
  const titles = textItems.filter((item) => item !== slideHeading && isSectionTitleCandidate(item));

  if (titles.length === 0) {
    return items;
  }

  const titleSet = new Set(titles);
  const assignments = new Map<RenderableItem, RenderableItem[]>();

  for (const body of textItems) {
    if (body === slideHeading || titleSet.has(body)) {
      continue;
    }

    const title = findNearestSectionTitle(body, titles, slideSize);
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

  const consumed = new Set<RenderableItem>();
  const groupedItems: RenderableItem[] = [];

  for (const item of items) {
    if (consumed.has(item)) {
      continue;
    }

    const sectionBodies = assignments.get(item);
    if (sectionBodies && sectionBodies.length > 0) {
      sectionBodies.sort((a, b) => comparePosition(a, b, slideSize));
      sectionBodies.forEach((body) => consumed.add(body));
      groupedItems.push(combineSectionTextItem(item, sectionBodies));
      continue;
    }

    groupedItems.push(item);
  }

  return groupedItems;
}

function findNearestSectionTitle(
  body: RenderableItem,
  titles: RenderableItem[],
  slideSize: SlideSize,
): RenderableItem | undefined {
  const candidates = titles
    .filter((title) => isBodyBelowTitle(body, title, titles, slideSize))
    .map((title) => ({
      title,
      centerDistance: Math.abs(centerX(title) - centerX(body)),
      verticalGap: Math.max(0, body.y - (title.y + title.height)),
    }));

  candidates.sort((a, b) => {
    const gapDiff = a.verticalGap - b.verticalGap;
    if (gapDiff !== 0) {
      return gapDiff;
    }

    return a.centerDistance - b.centerDistance;
  });

  return candidates[0]?.title;
}

function isBodyBelowTitle(
  body: RenderableItem,
  title: RenderableItem,
  titles: RenderableItem[],
  slideSize: SlideSize,
): boolean {
  if (body.y < title.y + Math.min(title.height * 0.45, slideSize.height * 0.035)) {
    return false;
  }

  const verticalGap = Math.max(0, body.y - (title.y + title.height));
  if (verticalGap > slideSize.height * 0.16) {
    return false;
  }

  if (!isSameVisualColumn(title, body)) {
    return false;
  }

  return !titles.some(
    (otherTitle) =>
      otherTitle !== title &&
      otherTitle.y > title.y &&
      otherTitle.y < body.y &&
      isSameVisualColumn(otherTitle, body),
  );
}

function combineSectionTextItem(title: RenderableItem, bodies: RenderableItem[]): RenderableItem {
  const sectionItems = [title, ...bodies];
  const bounds = unionBoxes(sectionItems);

  return {
    ...title,
    markdown: sectionItems.map((item) => item.markdown).filter(Boolean).join("\n\n"),
    x: bounds.x,
    y: title.y,
    width: bounds.width,
    height: Math.max(title.height, bounds.y + bounds.height - title.y),
    order: Math.min(...sectionItems.map((item) => item.order)),
  };
}

function isSectionTitleCandidate(item: RenderableItem): boolean {
  const text = itemTextContent(item);

  if (
    !text ||
    !hasLetter(text) ||
    item.kind !== "text" ||
    item.hasBullet ||
    (item.paragraphCount || 1) > 2 ||
    text.length > 120
  ) {
    return false;
  }

  const headingLevel = markdownHeadingLevel(item.markdown);
  if (headingLevel !== undefined && headingLevel >= 3) {
    return true;
  }

  return Boolean(item.allBold || (item.maxFontSize || 0) >= 1700);
}

function isShapeTextItem(item: RenderableItem): boolean {
  return item.kind === "text";
}

function isMeaningfulTextItem(item: RenderableItem): boolean {
  const text = itemTextContent(item);
  return hasLetterOrNumber(text) && !/^[\s\-–—•·|]+$/.test(text);
}

function itemTextContent(item: RenderableItem): string {
  return (item.plainText || stripMarkdownInline(item.markdown)).replace(/\s+/g, " ").trim();
}

function stripMarkdownHeading(markdown: string): string {
  return markdown.replace(/^#{1,6}\s+/, "").trim();
}

function stripMarkdownInline(markdown: string): string {
  return stripMarkdownHeading(markdown)
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/[*_~`]/g, "")
    .trim();
}

function markdownHeadingLevel(markdown: string): number | undefined {
  const match = markdown.match(/^(#{1,6})\s+/);
  return match ? match[1].length : undefined;
}

function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

function hasLetterOrNumber(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

function isSameVisualColumn(left: PositionedItem, right: PositionedItem): boolean {
  const overlap = horizontalOverlap(left, right);
  const minWidth = Math.min(left.width, right.width);
  const overlapRatio = minWidth > 0 ? overlap / minWidth : 0;
  const centerDistance = Math.abs(centerX(left) - centerX(right));

  return overlapRatio >= 0.35 || centerDistance <= Math.max(left.width, right.width) * 0.42;
}

function horizontalOverlap(left: PositionedItem, right: PositionedItem): number {
  return Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
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

function shouldIncludeImage(
  image: ImageItem,
  slideSize: SlideSize,
  imageSlideCount: number,
  slideCount: number,
  hasTextContent: boolean,
  imageByteLength: number,
): boolean {
  if (image.width <= 0 || image.height <= 0) {
    return !looksDecorativeImage(image) || hasContentAltText(image);
  }

  const slideArea = Math.max(1, slideSize.width * slideSize.height);
  const areaRatio = (image.width * image.height) / slideArea;
  const widthRatio = image.width / Math.max(1, slideSize.width);
  const heightRatio = image.height / Math.max(1, slideSize.height);
  const tiny = areaRatio < 0.006 || widthRatio < 0.035 || heightRatio < 0.035;
  const small = areaRatio < 0.018 || widthRatio < 0.075 || heightRatio < 0.075;
  const repeatedAcrossSlides = slideCount > 1 && imageSlideCount >= Math.max(2, Math.ceil(slideCount * 0.5));
  const edgePlaced = isEdgePlaced(image, slideSize);
  const fullSlide = coversMostOfSlide(image, slideSize, areaRatio);
  const lowInformationLargeImage = imageByteLength > 0 && imageByteLength < 16384 && areaRatio >= 0.08;

  if (fullSlide && hasTextContent) {
    return false;
  }
  if (lowInformationLargeImage && !hasContentAltText(image)) {
    return false;
  }
  if (tiny && !hasContentAltText(image)) {
    return false;
  }
  if (looksDecorativeImage(image) && small) {
    return false;
  }
  if (repeatedAcrossSlides && small && !hasContentAltText(image)) {
    return false;
  }
  if (small && edgePlaced && !hasContentAltText(image)) {
    return false;
  }

  return true;
}

function collectImageSlideCounts(slides: ParsedSlide[]): Map<string, number> {
  const imageSlides = new Map<string, Set<number>>();

  for (const slide of slides) {
    for (const item of slide.items) {
      if (item.kind !== "image") {
        continue;
      }

      const slideSet = imageSlides.get(item.mediaPath) || new Set<number>();
      slideSet.add(slide.index);
      imageSlides.set(item.mediaPath, slideSet);
    }
  }

  return new Map(Array.from(imageSlides.entries()).map(([mediaPath, slideSet]) => [mediaPath, slideSet.size]));
}

function readSlideSize(sldSz: any): SlideSize {
  const width = readNumberAttr(sldSz, "cx");
  const height = readNumberAttr(sldSz, "cy");

  return width > 0 && height > 0 ? { width, height } : DEFAULT_SLIDE_SIZE;
}

async function readRelationships(zip: JSZip, relsPath: string, baseFolder: string): Promise<Map<string, Relationship>> {
  const relationships = new Map<string, Relationship>();
  const relsXml = await readZipText(zip, relsPath);

  if (!relsXml) {
    return relationships;
  }

  const rels = parseXml(relsXml, relsPath);
  for (const relationship of toArray(rels?.Relationships?.Relationship)) {
    const id = readAttr(relationship, "Id");
    const target = readAttr(relationship, "Target");
    if (!id || !target) {
      continue;
    }

    const external = readAttr(relationship, "TargetMode") === "External";
    relationships.set(id, {
      target: external ? target : resolvePartTarget(baseFolder, target),
      type: readAttr(relationship, "Type") || "",
      external,
    });
  }

  return relationships;
}

async function readContentTypes(zip: JSZip): Promise<ContentTypes> {
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();
  const contentTypesXml = await readZipText(zip, "[Content_Types].xml");

  if (!contentTypesXml) {
    return { defaults, overrides };
  }

  const contentTypes = parseXml(contentTypesXml, "[Content_Types].xml")?.Types;
  for (const defaultType of toArray(contentTypes?.Default)) {
    const extension = readAttr(defaultType, "Extension")?.toLowerCase();
    const contentType = readAttr(defaultType, "ContentType");
    if (extension && contentType) {
      defaults.set(extension, contentType);
    }
  }

  for (const override of toArray(contentTypes?.Override)) {
    const partName = readAttr(override, "PartName");
    const contentType = readAttr(override, "ContentType");
    if (partName && contentType) {
      overrides.set(normalizePartPath(partName), contentType);
    }
  }

  return { defaults, overrides };
}

async function readZipText(zip: JSZip, filePath: string): Promise<string | undefined> {
  const file = zip.file(normalizePartPath(filePath));
  return file ? file.async("text") : undefined;
}

function parseXml(xml: string, partPath: string): any {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error(`Unsupported XML doctype in PPTX part: ${partPath}`);
  }

  return xmlParser.parse(xml);
}

function readElementBox(xfrm: any): Box {
  return {
    x: readNumberAttr(xfrm?.off, "x"),
    y: readNumberAttr(xfrm?.off, "y"),
    width: readNumberAttr(xfrm?.ext, "cx"),
    height: readNumberAttr(xfrm?.ext, "cy"),
  };
}

function composeGroupTransform(parent: Transform, xfrm: any): Transform {
  const off = xfrm?.off;
  const ext = xfrm?.ext;
  const childOff = xfrm?.chOff;
  const childExt = xfrm?.chExt;
  const groupX = readNumberAttr(off, "x");
  const groupY = readNumberAttr(off, "y");
  const groupWidth = readNumberAttr(ext, "cx");
  const groupHeight = readNumberAttr(ext, "cy");
  const childX = readNumberAttr(childOff, "x");
  const childY = readNumberAttr(childOff, "y");
  const childWidth = readNumberAttr(childExt, "cx");
  const childHeight = readNumberAttr(childExt, "cy");
  const scaleX = childWidth > 0 && groupWidth > 0 ? groupWidth / childWidth : 1;
  const scaleY = childHeight > 0 && groupHeight > 0 ? groupHeight / childHeight : 1;

  return {
    x: parent.x + (groupX - childX * scaleX) * parent.scaleX,
    y: parent.y + (groupY - childY * scaleY) * parent.scaleY,
    scaleX: parent.scaleX * scaleX,
    scaleY: parent.scaleY * scaleY,
  };
}

function applyTransform(transform: Transform, box: Box): Box {
  return {
    x: transform.x + box.x * transform.scaleX,
    y: transform.y + box.y * transform.scaleY,
    width: box.width * transform.scaleX,
    height: box.height * transform.scaleY,
  };
}

function comparePosition(a: PositionedItem, b: PositionedItem, slideSize: SlideSize): number {
  const yTolerance = Math.max(1, slideSize.height * 0.025);
  const xTolerance = Math.max(1, slideSize.width * 0.015);
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

function readBulletKind(paragraphProperties: any): "ordered" | "unordered" | undefined {
  if (!paragraphProperties || paragraphProperties.buNone) {
    return undefined;
  }
  if (paragraphProperties.buAutoNum) {
    return "ordered";
  }
  if (paragraphProperties.buChar) {
    return "unordered";
  }

  return undefined;
}

function readPlaceholderType(shape: any): string {
  return String(readAttr(shape?.nvSpPr?.nvPr?.ph, "type") || "");
}

function readFontSize(runProperties: any): number {
  return readNumberAttr(runProperties, "sz");
}

function readNumberAttr(node: any, name: string): number {
  const value = readAttr(node, name);
  const numberValue = value === undefined ? NaN : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function readAnyAttr(node: any, names: string[]): string | undefined {
  for (const name of names) {
    const value = readAttr(node, name);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function readAttr(node: any, name: string): string | undefined {
  const value = node?.[`@_${name}`];
  return value === undefined || value === null ? undefined : String(value);
}

function textValue(value: any): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return decodePredefinedXmlEntities(String(value));
  }
  if (Array.isArray(value)) {
    return value.map(textValue).join("");
  }
  if (value["#text"] !== undefined) {
    return decodePredefinedXmlEntities(String(value["#text"]));
  }

  return "";
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

function wrapMarkdown(value: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match || !match[2]) {
    return value;
  }

  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

function normalizeInlineText(value: string): string {
  return value.replace(/\r\n|\r/g, "\n").replace(/\u000b/g, "\n");
}

function normalizeParagraphText(value: string): string {
  return normalizeInlineText(value).replace(/\n{3,}/g, "\n\n").trimEnd();
}

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function isStruck(runProperties: any): boolean {
  const strike = readAttr(runProperties, "strike");
  return Boolean(strike && strike !== "noStrike");
}

function isEdgePlaced(image: ImageItem, slideSize: SlideSize): boolean {
  const marginX = slideSize.width * 0.08;
  const marginY = slideSize.height * 0.08;

  return (
    image.x <= marginX ||
    image.y <= marginY ||
    image.x + image.width >= slideSize.width - marginX ||
    image.y + image.height >= slideSize.height - marginY
  );
}

function coversMostOfSlide(image: ImageItem, slideSize: SlideSize, areaRatio: number): boolean {
  return (
    areaRatio > 0.9 &&
    image.x <= slideSize.width * 0.05 &&
    image.y <= slideSize.height * 0.05 &&
    image.x + image.width >= slideSize.width * 0.95 &&
    image.y + image.height >= slideSize.height * 0.95
  );
}

function looksDecorativeImage(image: ImageItem): boolean {
  return [image.name, image.description].some(isDecorativeImageLabel);
}

function hasContentAltText(image: ImageItem): boolean {
  const labels = [image.description, image.name]
    .map((value) => value.trim())
    .filter((value) => value && !isGenericImageLabel(value) && !isDecorativeImageLabel(value));

  if (labels.length === 0) {
    return false;
  }

  return labels.some(
    (label) => /\b(chart|diagram|equation|figure|graph|map|photo|screenshot|table)\b/i.test(label) || label.length > 16,
  );
}

function preferredAltText(name: string, description: string): string {
  const descriptionOnly = description.trim();
  if (descriptionOnly && !isGenericImageLabel(descriptionOnly)) {
    return descriptionOnly;
  }

  const nameOnly = name.trim();
  if (nameOnly && !isGenericImageLabel(nameOnly)) {
    return nameOnly;
  }

  return "Slide image";
}

function isGenericImageLabel(value: string): boolean {
  const normalized = value.trim();
  return (
    /^(picture|image|graphic|object|shape|slide image)\s*\d*$/i.test(normalized) ||
    /^image\d*\.(avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf)$/i.test(normalized) ||
    /^google shape;\d+;p\d+$/i.test(normalized) ||
    /^google shape;\d+;p\d+\s+image\d*\.(avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf)$/i.test(normalized)
  );
}

function isDecorativeImageLabel(value: string): boolean {
  return /\b(background|decorative|footer|header|icon|logo|watermark)\b/i.test(value);
}

function base64ByteLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function escapeImageAlt(value: string): string {
  return value.replace(/\r\n|\r|\n/g, " ").replace(/]/g, "\\]").trim() || "Slide image";
}

function isImagePart(partPath: string): boolean {
  return /\.(avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf)$/i.test(partPath);
}

function mimeTypeForPart(contentTypes: ContentTypes, partPath: string): string {
  const normalized = normalizePartPath(partPath);
  const override = contentTypes.overrides.get(normalized);
  if (override) {
    return override;
  }

  const extension = extensionName(normalized);
  return contentTypes.defaults.get(extension) || fallbackMimeType(extension);
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

function relationshipsPathForPart(partPath: string): string {
  const normalized = normalizePartPath(partPath);
  return `${dirname(normalized)}/_rels/${basename(normalized)}.rels`;
}

function resolvePartTarget(baseFolder: string, target: string): string {
  const normalizedTarget = target.replace(/\\/g, "/");

  if (normalizedTarget.startsWith("/")) {
    return normalizePartPath(normalizedTarget);
  }

  return normalizePosixPath([baseFolder, normalizedTarget]);
}

function normalizePartPath(partPath: string): string {
  return partPath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function normalizePosixPath(parts: string[]): string {
  const resolved: string[] = [];

  for (const part of parts.join("/").split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      resolved.pop();
      continue;
    }

    resolved.push(part);
  }

  return resolved.join("/");
}

function dirname(partPath: string): string {
  const normalized = normalizePartPath(partPath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
}

function basename(partPath: string): string {
  const normalized = normalizePartPath(partPath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

function extensionName(partPath: string): string {
  const name = basename(partPath);
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
}

function localTagName(tagName: string): string {
  const colonIndex = tagName.indexOf(":");
  return colonIndex >= 0 ? tagName.slice(colonIndex + 1) : tagName;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
