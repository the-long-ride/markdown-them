import {
  base64ByteLength,
  escapeImageAlt,
  fallbackMimeType,
  isImageFilePath,
} from '../shared/images';
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

export function imageByteLengthFromMarkdown(markdown: string): number {
  const match = markdown.match(/;base64,([^)]*)\)/);
  if (!match) {
    return 0;
  }

  return base64ByteLength(match[1]);
}

export async function renderImageMarkdown(href: string, context: RenderContext): Promise<string> {
  const filePath = normalizeOdfHref(href);
  const file = context.zip.file(filePath);

  if (!file || !isImageFilePath(filePath)) {
    return '';
  }

  const base64 = await file.async('base64');
  const mimeType = context.manifest.get(filePath) || fallbackMimeType(extensionName(filePath));
  return `![${escapeImageAlt(basename(filePath), 'Image')}](data:${mimeType};base64,${base64})`;
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
