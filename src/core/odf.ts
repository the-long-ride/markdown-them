import JSZip from 'jszip';
import { normalizeMarkdown } from './markdown-utils';
import type { OdfKind, RenderContext } from './odf/types';
import { DEFAULT_PAGE_SIZE } from './odf/types';
import { childrenOf, findFirst, parseOdfXml } from './odf/xml';
import { readManifest, readStyles, readZipText } from './odf/styles';
import { renderSpreadsheet } from './odf/spreadsheet';
import { renderPresentation } from './odf/presentation';
import { renderFlowNodes } from './odf/flow';

export type { OdfKind, RenderContext, PositionedItem, Box, StyleInfo } from './odf/types';

export async function convertOdfData(
  data: ArrayBuffer | Uint8Array,
  kind?: OdfKind,
): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const contentXml = await readZipText(zip, 'content.xml');

  if (!contentXml) {
    throw new Error('Invalid OpenDocument file: missing content.xml');
  }

  const root = parseOdfXml(contentXml, 'content.xml');
  const documentContent = findFirst(root, 'document-content') || findFirst(root, 'document');
  const documentChildren = childrenOf(documentContent);
  const body = findFirst(documentChildren, 'body');
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

  const spreadsheet = findFirst(bodyChildren, 'spreadsheet');
  const presentation = findFirst(bodyChildren, 'presentation');
  const textDocument = findFirst(bodyChildren, 'text');

  if (kind === 'ods' || spreadsheet) {
    return normalizeMarkdown(await renderSpreadsheet(spreadsheet || body, context));
  }

  if (kind === 'odp' || presentation) {
    return normalizeMarkdown(await renderPresentation(presentation || body, context));
  }

  return normalizeMarkdown(
    (await renderFlowNodes(childrenOf(textDocument || body), context)).join('\n\n'),
  );
}
