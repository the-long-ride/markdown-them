import type JSZip from 'jszip';
import type { ContentTypes, ImageItem, ParsedSlide, SlideSize } from './types';
import { extensionName, normalizePartPath } from './package';

export function isImagePart(partPath: string): boolean {
  return /\.(avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf)$/i.test(partPath);
}

export function escapeImageAlt(value: string): string {
  return (
    value
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/]/g, '\\]')
      .trim() || 'Slide image'
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

export function mimeTypeForPart(contentTypes: ContentTypes, partPath: string): string {
  const normalized = normalizePartPath(partPath);
  const override = contentTypes.overrides.get(normalized);
  if (override) {
    return override;
  }

  const extension = extensionName(normalized);
  return contentTypes.defaults.get(extension) || fallbackMimeType(extension);
}

export function base64ByteLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function isGenericImageLabel(value: string): boolean {
  const normalized = value.trim();
  return (
    /^(picture|image|graphic|object|shape|slide image)\s*\d*$/i.test(normalized) ||
    /^image\d*\.(avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf)$/i.test(normalized) ||
    /^google shape;\d+;p\d+$/i.test(normalized) ||
    /^google shape;\d+;p\d+\s+image\d*\.(avif|bmp|emf|gif|heic|jpe?g|png|svg|tiff?|webp|wmf)$/i.test(
      normalized,
    )
  );
}

export function isDecorativeImageLabel(value: string): boolean {
  return /\b(background|decorative|footer|header|icon|logo|watermark)\b/i.test(value);
}

export function looksDecorativeImage(image: ImageItem): boolean {
  return [image.name, image.description].some(isDecorativeImageLabel);
}

export function hasContentAltText(image: ImageItem): boolean {
  const labels = [image.description, image.name]
    .map((value) => value.trim())
    .filter((value) => value && !isGenericImageLabel(value) && !isDecorativeImageLabel(value));

  if (labels.length === 0) {
    return false;
  }

  return labels.some(
    (label) =>
      /\b(chart|diagram|equation|figure|graph|map|photo|screenshot|table)\b/i.test(label) ||
      label.length > 16,
  );
}

export function preferredAltText(name: string, description: string): string {
  const descriptionOnly = description.trim();
  if (descriptionOnly && !isGenericImageLabel(descriptionOnly)) {
    return descriptionOnly;
  }

  const nameOnly = name.trim();
  if (nameOnly && !isGenericImageLabel(nameOnly)) {
    return nameOnly;
  }

  return 'Slide image';
}

export function isEdgePlaced(image: ImageItem, slideSize: SlideSize): boolean {
  const marginX = slideSize.width * 0.08;
  const marginY = slideSize.height * 0.08;

  return (
    image.x <= marginX ||
    image.y <= marginY ||
    image.x + image.width >= slideSize.width - marginX ||
    image.y + image.height >= slideSize.height - marginY
  );
}

export function coversMostOfSlide(
  image: ImageItem,
  slideSize: SlideSize,
  areaRatio: number,
): boolean {
  return (
    areaRatio > 0.9 &&
    image.x <= slideSize.width * 0.05 &&
    image.y <= slideSize.height * 0.05 &&
    image.x + image.width >= slideSize.width * 0.95 &&
    image.y + image.height >= slideSize.height * 0.95
  );
}

export function shouldIncludeImage(
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
  const repeatedAcrossSlides =
    slideCount > 1 && imageSlideCount >= Math.max(2, Math.ceil(slideCount * 0.5));
  const edgePlaced = isEdgePlaced(image, slideSize);
  const fullSlide = coversMostOfSlide(image, slideSize, areaRatio);
  const lowInformationLargeImage =
    imageByteLength > 0 && imageByteLength < 16384 && areaRatio >= 0.08;

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

export function collectImageSlideCounts(slides: ParsedSlide[]): Map<string, number> {
  const imageSlides = new Map<string, Set<number>>();

  for (const slide of slides) {
    for (const item of slide.items) {
      if (item.kind !== 'image') {
        continue;
      }

      const slideSet = imageSlides.get(item.mediaPath) || new Set<number>();
      slideSet.add(slide.index);
      imageSlides.set(item.mediaPath, slideSet);
    }
  }

  return new Map(
    Array.from(imageSlides.entries()).map(([mediaPath, slideSet]) => [mediaPath, slideSet.size]),
  );
}

export async function readImageBase64(zip: JSZip, image: ImageItem): Promise<string> {
  const file = zip.file(image.mediaPath);
  if (!file) {
    return '';
  }

  return file.async('base64');
}

export function renderImageMarkdown(image: ImageItem, base64: string): string {
  return `![${escapeImageAlt(image.altText)}](data:${image.mimeType};base64,${base64})`;
}
