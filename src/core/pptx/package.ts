import type JSZip from 'jszip';
import type { ContentTypes, Relationship } from './types';
import { parseXml, readAttr, toArray } from './xml';

export function normalizePartPath(partPath: string): string {
  return partPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function basename(partPath: string): string {
  const normalized = normalizePartPath(partPath);
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

export function dirname(partPath: string): string {
  const normalized = normalizePartPath(partPath);
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : '';
}

export function extensionName(partPath: string): string {
  const name = basename(partPath);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
}

export function normalizePosixPath(parts: string[]): string {
  const resolved: string[] = [];

  for (const part of parts.join('/').split('/')) {
    if (!part || part === '.') {
      continue;
    }

    if (part === '..') {
      resolved.pop();
      continue;
    }

    resolved.push(part);
  }

  return resolved.join('/');
}

export function resolvePartTarget(baseFolder: string, target: string): string {
  const normalizedTarget = target.replace(/\\/g, '/');

  if (normalizedTarget.startsWith('/')) {
    return normalizePartPath(normalizedTarget);
  }

  return normalizePosixPath([baseFolder, normalizedTarget]);
}

export function relationshipsPathForPart(partPath: string): string {
  const normalized = normalizePartPath(partPath);
  return `${dirname(normalized)}/_rels/${basename(normalized)}.rels`;
}

export async function readZipText(zip: JSZip, filePath: string): Promise<string | undefined> {
  const file = zip.file(normalizePartPath(filePath));
  return file ? file.async('text') : undefined;
}

export async function readRelationships(
  zip: JSZip,
  relsPath: string,
  baseFolder: string,
): Promise<Map<string, Relationship>> {
  const relationships = new Map<string, Relationship>();
  const relsXml = await readZipText(zip, relsPath);

  if (!relsXml) {
    return relationships;
  }

  const rels = parseXml(relsXml, relsPath);
  for (const relationship of toArray(rels?.Relationships?.Relationship)) {
    const id = readAttr(relationship, 'Id');
    const target = readAttr(relationship, 'Target');
    if (!id || !target) {
      continue;
    }

    const external = readAttr(relationship, 'TargetMode') === 'External';
    relationships.set(id, {
      target: external ? target : resolvePartTarget(baseFolder, target),
      type: readAttr(relationship, 'Type') || '',
      external,
    });
  }

  return relationships;
}

export async function readContentTypes(zip: JSZip): Promise<ContentTypes> {
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();
  const contentTypesXml = await readZipText(zip, '[Content_Types].xml');

  if (!contentTypesXml) {
    return { defaults, overrides };
  }

  const contentTypes = parseXml(contentTypesXml, '[Content_Types].xml')?.Types;
  for (const defaultType of toArray(contentTypes?.Default)) {
    const extension = readAttr(defaultType, 'Extension')?.toLowerCase();
    const contentType = readAttr(defaultType, 'ContentType');
    if (extension && contentType) {
      defaults.set(extension, contentType);
    }
  }

  for (const override of toArray(contentTypes?.Override)) {
    const partName = readAttr(override, 'PartName');
    const contentType = readAttr(override, 'ContentType');
    if (partName && contentType) {
      overrides.set(normalizePartPath(partName), contentType);
    }
  }

  return { defaults, overrides };
}
