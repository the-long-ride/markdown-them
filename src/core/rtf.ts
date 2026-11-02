import { normalizeMarkdown } from './markdown-utils';
import { formatParagraph } from './rtf/formatter';
import { decodeRtfBytes, readRtfParagraphs } from './rtf/parser';

export { decodeRtfBytes, readRtfParagraphs } from './rtf/parser';
export { formatParagraph, formatRuns, plainText } from './rtf/formatter';
export type { RtfRun, RtfState } from './rtf/types';

export function convertRtfToMarkdown(input: string | ArrayBuffer | Uint8Array): string {
  const rtf = typeof input === 'string' ? input : decodeRtfBytes(input);
  const trimmed = rtf.trimStart();
  if (!trimmed.startsWith('{\\rtf')) {
    throw new Error('Invalid RTF document: missing {\\rtf signature');
  }
  if (rtf.includes('\\bin')) {
    throw new Error('Binary RTF payloads are not supported in preview');
  }
  const paragraphs = readRtfParagraphs(rtf);
  return normalizeMarkdown(paragraphs.map(formatParagraph).filter(Boolean).join('\n\n'));
}
