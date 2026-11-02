import { XMLParser } from 'fast-xml-parser';
import { decodeXmlEntities } from '../markdown-utils';

export function localTagName(tagName: string): string {
  const colonIndex = tagName.indexOf(':');
  return colonIndex >= 0 ? tagName.slice(colonIndex + 1) : tagName;
}

export const xmlParser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: false,
  textNodeName: '#text',
  transformTagName: localTagName,
  trimValues: false,
});

export function parseXml(xml: string, partPath: string): any {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error(`Unsupported XML doctype in PPTX part: ${partPath}`);
  }

  return xmlParser.parse(xml);
}

export function readAttr(node: any, name: string): string | undefined {
  const value = node?.[`@_${name}`] ?? node?.[name];
  return value === undefined || value === null ? undefined : decodeXmlEntities(String(value));
}

export function readAnyAttr(node: any, names: string[]): string | undefined {
  for (const name of names) {
    const value = readAttr(node, name);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export function readNumberAttr(node: any, name: string): number {
  const value = readAttr(node, name);
  const numberValue = value === undefined ? NaN : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function textValue(value: any): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return decodeXmlEntities(String(value));
  }
  if (Array.isArray(value)) {
    return value.map(textValue).join('');
  }
  if (value['#text'] !== undefined) {
    return decodeXmlEntities(String(value['#text']));
  }

  return '';
}

export function decodePredefinedXmlEntities(value: string): string {
  return decodeXmlEntities(value);
}

export function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

export function isStruck(runProperties: any): boolean {
  const strike = readAttr(runProperties, 'strike');
  return Boolean(strike && strike !== 'noStrike');
}
