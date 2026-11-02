import { XMLParser } from 'fast-xml-parser';
import { decodeXmlEntities } from '../markdown-utils';
import type { OrderedXmlNode } from './types';

export function localName(name: string): string {
  const colonIndex = name.indexOf(':');
  return colonIndex >= 0 ? name.slice(colonIndex + 1) : name;
}

export const odfParser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseAttributeValue: false,
  parseTagValue: false,
  preserveOrder: true,
  processEntities: false,
  textNodeName: '#text',
  transformAttributeName: localName,
  transformTagName: localName,
  trimValues: false,
});

export function parseOdfXml(xml: string, partPath: string): OrderedXmlNode[] {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new Error(`Unsupported XML doctype in OpenDocument part: ${partPath}`);
  }

  return odfParser.parse(xml) as OrderedXmlNode[];
}

export function nodeName(node: OrderedXmlNode | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(node, '#text')) {
    return '#text';
  }

  return Object.keys(node).find((key) => key !== ':@' && key !== '#text');
}

export function childrenOf(node: OrderedXmlNode | undefined): OrderedXmlNode[] {
  const name = nodeName(node);
  const value = name ? node?.[name] : undefined;
  return Array.isArray(value) ? (value as OrderedXmlNode[]) : [];
}

export function directChildren(nodes: OrderedXmlNode[], name: string): OrderedXmlNode[] {
  return nodes.filter((node) => nodeName(node) === name);
}

export function findFirst(
  nodes: OrderedXmlNode[] | OrderedXmlNode | undefined,
  name: string,
): OrderedXmlNode | undefined {
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

export function findAllInNodes(nodes: OrderedXmlNode[], name: string): OrderedXmlNode[] {
  const matches: OrderedXmlNode[] = [];

  for (const node of nodes) {
    if (nodeName(node) === name) {
      matches.push(node);
    }

    matches.push(...findAllInNodes(childrenOf(node), name));
  }

  return matches;
}

export function findAll(node: OrderedXmlNode, name: string): OrderedXmlNode[] {
  return findAllInNodes([node], name);
}

export function attrsOf(node: OrderedXmlNode | undefined): Record<string, string> {
  const attrs = node?.[':@'] as Record<string, unknown> | undefined;
  if (!attrs) {
    return {};
  }

  return Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key, String(value)]));
}

export function readAttr(node: OrderedXmlNode | undefined, name: string): string | undefined {
  const value = attrsOf(node)[name];
  return value === undefined ? undefined : decodeXmlEntities(value);
}

export function readRepeat(node: OrderedXmlNode, name: string): number {
  const value = Number(readAttr(node, name) || '1');
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function clampRepeat(value: number): number {
  return Math.min(1000, Math.max(1, value));
}

export function decodePredefinedXmlEntities(value: string): string {
  return value.replace(/&(amp|apos|gt|lt|quot);/g, (_, entity: string) => {
    switch (entity) {
      case 'amp':
        return '&';
      case 'apos':
        return "'";
      case 'gt':
        return '>';
      case 'lt':
        return '<';
      case 'quot':
        return '"';
      default:
        return `&${entity};`;
    }
  });
}
