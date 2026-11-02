import type JSZip from 'jszip';
import type { OrderedXmlNode, StyleInfo } from './types';
import {
  attrsOf,
  childrenOf,
  directChildren,
  findFirst,
  findAllInNodes,
  parseOdfXml,
  readAttr,
} from './xml';

export function isBold(value: string | undefined): boolean {
  return value === 'bold' || value === '700' || value === '800' || value === '900';
}

export function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

export function normalizeOdfHref(href: string): string {
  return href.replace(/\\/g, '/').replace(/^\.?\//, '');
}

export async function readZipText(zip: JSZip, filePath: string): Promise<string | undefined> {
  const file = zip.file(filePath);
  return file ? file.async('text') : undefined;
}

export function readStyles(documentChildren: OrderedXmlNode[]): Map<string, StyleInfo> {
  const styles = new Map<string, StyleInfo>();
  const styleParents = [
    ...directChildren(documentChildren, 'automatic-styles'),
    ...directChildren(documentChildren, 'styles'),
  ];

  for (const parent of styleParents) {
    for (const styleNode of directChildren(childrenOf(parent), 'style')) {
      const name = readAttr(styleNode, 'name');
      if (!name) {
        continue;
      }

      const textProperties = findFirst(childrenOf(styleNode), 'text-properties');
      const attrs = attrsOf(textProperties);
      styles.set(name, {
        bold: isBold(attrs['font-weight']),
        italic: attrs['font-style'] === 'italic' || attrs['font-style-asian'] === 'italic',
        strikethrough: Boolean(
          attrs['text-line-through-style'] && attrs['text-line-through-style'] !== 'none',
        ),
      });
    }
  }

  return styles;
}

export async function readManifest(zip: JSZip): Promise<Map<string, string>> {
  const manifest = new Map<string, string>();
  const manifestXml = await readZipText(zip, 'META-INF/manifest.xml');

  if (!manifestXml) {
    return manifest;
  }

  const root = parseOdfXml(manifestXml, 'META-INF/manifest.xml');
  for (const fileEntry of findAllInNodes(root, 'file-entry')) {
    const fullPath = normalizeOdfHref(readAttr(fileEntry, 'full-path') || '');
    const mediaType = readAttr(fileEntry, 'media-type');
    if (fullPath && mediaType) {
      manifest.set(fullPath, mediaType);
    }
  }

  return manifest;
}

export function wrapMarkdown(value: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match || !match[2]) {
    return value;
  }

  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

export function applyInlineStyle(text: string, style?: StyleInfo): string {
  if (!text || !style) {
    return text;
  }

  let markdown = text;
  if (style.bold) {
    markdown = wrapMarkdown(markdown, '**');
  }
  if (style.italic) {
    markdown = wrapMarkdown(markdown, '*');
  }
  if (style.strikethrough) {
    markdown = wrapMarkdown(markdown, '~~');
  }

  return markdown;
}

export function mergeStyles(
  parent: StyleInfo | undefined,
  child: StyleInfo | undefined,
): StyleInfo | undefined {
  if (!parent && !child) {
    return undefined;
  }

  return { ...parent, ...child };
}

export function normalizeInlineMarkdown(value: string): string {
  return value
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeHeading(value: string): string {
  return value.replace(/\r\n|\r|\n/g, ' ').trim() || 'Sheet';
}
