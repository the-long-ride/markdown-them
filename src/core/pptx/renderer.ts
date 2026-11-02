import type JSZip from 'jszip';
import type { ParsedSlide, RenderableItem } from './types';
import { comparePosition } from './geometry';
import {
  base64ByteLength,
  collectImageSlideCounts,
  readImageBase64,
  renderImageMarkdown,
  shouldIncludeImage,
} from './image';
import { structureTextItems } from './layout';

export async function renderSlideItems(
  zip: JSZip,
  slide: ParsedSlide,
  imageSlideCounts: Map<string, number>,
  slideCount: number,
): Promise<string[]> {
  const hasTextContent = slide.items.some((item) => item.kind !== 'image' && item.markdown.trim());
  const positionedItems: RenderableItem[] = [];

  for (const item of slide.items) {
    if (item.kind === 'image') {
      if (
        !shouldIncludeImage(
          item,
          slide.size,
          imageSlideCounts.get(item.mediaPath) || 0,
          slideCount,
          hasTextContent,
          0,
        )
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

export async function renderSlides(zip: JSZip, slides: ParsedSlide[]): Promise<string> {
  const imageSlideCounts = collectImageSlideCounts(slides);
  const slideMarkdown: string[] = [];

  for (const slide of slides) {
    const renderedItems = await renderSlideItems(zip, slide, imageSlideCounts, slides.length);
    if (renderedItems.length === 0) {
      continue;
    }

    if (slideMarkdown.length > 0) {
      slideMarkdown.push('', '---', '');
    }

    slideMarkdown.push(renderedItems.join('\n\n'));
  }

  return slideMarkdown
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}
