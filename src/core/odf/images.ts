import type { Box, OrderedXmlNode, RenderContext } from './types';
import { findAll, readAttr } from './xml';
import { normalizeOdfHref } from './styles';

export function basename(filePath: string): string {
  const normalized = normalizeOdfHref(filePath);
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

export function extensionName(filePath: string): string {
  const name = basename(filePath);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
}

export function isImagePath(filePath: string): boolean {
  return /\.(avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf)$/i.test(filePath);
}

export function escapeImageAlt(value: string): string {
  return (
    value
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/]/g, '\\]')
      .trim() || 'Image'
  );
}

export function fallbackMimeType(extension: string): string {
  switch (extension) {
    case 'avif':
      return 'image/avif';
    case 'bmp':
      return 'image/bmp';
    case 'emf':
      return 'image/x-emf';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'webp':
      return 'image/webp';
    case 'wmf':
      return 'image/wmf';
    default:
      return 'application/octet-stream';
  }
}

export function imageByteLengthFromMarkdown(markdown: string): number {
  const match = markdown.match(/;base64,([^)]*)\)/);
  if (!match) {
    return 0;
  }

  const base64 = match[1];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function renderImageMarkdown(href: string, context: RenderContext): Promise<string> {
  const filePath = normalizeOdfHref(href);
  const file = context.zip.file(filePath);

  if (!file || !isImagePath(filePath)) {
    return '';
  }

  const base64 = await file.async('base64');
  const mimeType = context.manifest.get(filePath) || fallbackMimeType(extensionName(filePath));
  return `![${escapeImageAlt(basename(filePath))}](data:${mimeType};base64,${base64})`;
}

export function shouldIncludePresentationImage(
  image: Box & { href?: string; byteLength?: number },
  context: RenderContext,
): boolean {
  if (!image.href) {
    return false;
  }

  const areaRatio =
    (image.width * image.height) / Math.max(1, context.pageSize.width * context.pageSize.height);
  const fullPage =
    areaRatio > 0.9 &&
    image.x <= context.pageSize.width * 0.05 &&
    image.y <= context.pageSize.height * 0.05;
  const tiny =
    areaRatio < 0.006 ||
    image.width < context.pageSize.width * 0.035 ||
    image.height < context.pageSize.height * 0.035;

  if (!context.presentationMode) {
    return !tiny;
  }

  const small =
    areaRatio < 0.018 ||
    image.width < context.pageSize.width * 0.075 ||
    image.height < context.pageSize.height * 0.075;
  const repeated =
    (context.imagePageCounts.get(image.href) || 0) >=
    Math.max(2, Math.ceil(context.pageCount * 0.5));
  const lowInformationLargeImage = Boolean(
    image.byteLength && image.byteLength < 16384 && areaRatio >= 0.08,
  );

  if (fullPage || tiny || lowInformationLargeImage) {
    return false;
  }

  if (repeated && small) {
    return false;
  }

  return true;
}

export function collectPresentationImageCounts(pages: OrderedXmlNode[]): Map<string, number> {
  const imagePages = new Map<string, Set<number>>();

  pages.forEach((page, pageIndex) => {
    for (const image of findAll(page, 'image')) {
      const href = normalizeOdfHref(readAttr(image, 'href') || '');
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
