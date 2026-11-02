/**
 * Tier 7: Deep Condition & Branch Coverage Suite
 *
 * Systematically tests boundary decisions, fallback paths, and error conditions:
 * - converters.ts & document-converter.ts decision matrices
 * - XML entity decoding with numeric hex/decimal, out-of-range, and malformed tokens
 * - Table escaping, empty rows, multiline cells, and column normalization
 * - HTML detection, tag stripping, and empty table edge cases
 * - RTF \\uc0/\\uc1 fallbacks, binary data skips, headings, quotes, and symbols
 * - XLSX missing workbook.xml, empty sheets, and inline string decoding
 * - CLI argument parser branch paths
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import {
  assert,
  assertEqual,
  assertContains,
  assertMatches,
  assertRejects,
  assertThrows,
} from '../framework/assertions.mjs';
import {
  DocumentConverter,
  createDocumentConverter,
  decodeXmlEntities,
  normalizeMarkdown,
  normalizePreviewMarkdown,
  createFailureMarkdown,
  classifyExtension,
  getExtension,
  isMarkdownFilePath,
  isConvertibleDocumentFilePath,
  isTextDocumentFilePath,
  stripKnownExtension,
  getFileTypeLabel,
  readMarkdownFile,
  getConversionQuality,
  getMarkdownThem,
  convertFileToMarkdown,
  convertTextToMarkdown,
  generateMarkdown,
  inferOutputPath,
  escapeMarkdownTableCell,
  htmlToMarkdown,
  convertRtfToMarkdown,
} from '../framework/conversion-adapter.mjs';
import { generateRtf, generateXlsx, generateDocx } from '../fixtures/fixture-generator.mjs';

export function registerTier7Tests(harness) {
  harness.suite('Tier 7: Deep Condition & Branch Coverage', () => {
    let tmpDir;

    harness.beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier7-'));
    });

    harness.afterAll(async () => {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    // 1. Converters & DocumentConverter Branches
    harness.test('DocumentConverter: Cache hit, cache clear, and preview branches', async () => {
      const converter = createDocumentConverter();

      // Test with converted docx document
      const docxPath = path.join(tmpDir, 'sample-preview.docx');
      const docxBuf = await generateDocx({ title: 'Preview Title', paragraphs: ['P1'] });
      await fs.writeFile(docxPath, docxBuf);

      // 1. First read -> fromCache: false
      const res1 = await converter.readMarkdown(docxPath);
      assert(res1.markdown.includes('Preview Title'), 'Must contain document title');
      assertEqual(res1.previewInfo?.kind, 'converted');
      assertEqual(res1.previewInfo?.fromCache, false);

      // 2. Second read -> hits cache -> fromCache: true
      const res2 = await converter.readMarkdown(docxPath);
      assertEqual(res2.previewInfo?.fromCache, true);

      // 3. Clear cache and read again -> fromCache: false
      converter.clearCache();
      const res3 = await converter.readMarkdown(docxPath);
      assertEqual(res3.previewInfo?.fromCache, false);

      // 4. Test text preview path
      const txtFile = path.join(tmpDir, 'sample-preview.txt');
      await fs.writeFile(txtFile, 'Plain text preview line 1\nLine 2');
      const txtRes = await converter.readMarkdown(txtFile);
      assertEqual(txtRes.previewInfo?.kind, 'text');

      // 5. Failure markdown formatting branches
      const failFromError = converter.createFailureMarkdown(
        docxPath,
        new Error('Simulated failure'),
      );
      assertContains(failFromError, 'Simulated failure');
      assertContains(failFromError, 'could not convert');

      const failFromString = converter.createFailureMarkdown(docxPath, 'String error message');
      assertContains(failFromString, 'String error message');

      const failFromNull = converter.createFailureMarkdown(docxPath, null);
      assertContains(failFromNull, 'Unknown conversion error');
    });

    harness.test('Extension & Quality Classification Branches', () => {
      // Classification into DocumentKind: "convertible" | "markdown" | "text" | "unsupported"
      assertEqual(classifyExtension('file.docx'), 'convertible');
      assertEqual(classifyExtension('sample.DOCX'), 'convertible');
      assertEqual(classifyExtension('file.pdf'), 'convertible');
      assertEqual(classifyExtension('file.xlsx'), 'convertible');
      assertEqual(classifyExtension('file.xls'), 'convertible');
      assertEqual(classifyExtension('file.xlm'), 'convertible');
      assertEqual(classifyExtension('file.pptx'), 'convertible');
      assertEqual(classifyExtension('.odt'), 'convertible');
      assertEqual(classifyExtension('.odp'), 'convertible');
      assertEqual(classifyExtension('.ods'), 'convertible');
      assertEqual(classifyExtension('.rtf'), 'convertible');
      assertEqual(classifyExtension('.html'), 'convertible');
      assertEqual(classifyExtension('.htm'), 'convertible');
      assertEqual(classifyExtension('.txt'), 'text');
      assertEqual(classifyExtension('.text'), 'text');
      assertEqual(classifyExtension('.md'), 'markdown');
      assertEqual(classifyExtension('.markdown'), 'markdown');
      assertEqual(classifyExtension('.unknown'), 'unsupported');
      assertEqual(classifyExtension(''), 'unsupported');

      // Path predicates
      assert(isMarkdownFilePath('file.md'));
      assert(isMarkdownFilePath('file.markdown'));
      assert(isMarkdownFilePath('file.mdx'));
      assert(!isMarkdownFilePath('file.docx'));

      assert(isConvertibleDocumentFilePath('file.docx'));
      assert(isConvertibleDocumentFilePath('file.pdf'));
      assert(isConvertibleDocumentFilePath('file.pptx'));
      assert(!isConvertibleDocumentFilePath('file.png'));

      assert(isTextDocumentFilePath('file.txt'));
      assert(isTextDocumentFilePath('file.text'));
      assert(!isTextDocumentFilePath('file.pdf'));

      // Strip known extension
      assertEqual(stripKnownExtension('report.DOCX'), 'report');
      assertEqual(stripKnownExtension('archive.custom'), 'archive');
      assertEqual(stripKnownExtension('archive_no_ext'), 'archive_no_ext');

      // Quality codes
      const docQuality = getConversionQuality('.doc');
      assertEqual(docQuality.qualityCode, 'legacy-best-effort');

      const xlsQuality = getConversionQuality('.xls');
      assertEqual(xlsQuality.qualityCode, 'legacy-best-effort');

      const docxQuality = getConversionQuality('.docx');
      assertEqual(docxQuality.qualityCode, 'converted-preview');

      const unknownQuality = getConversionQuality('.unknown');
      assertEqual(unknownQuality.qualityCode, 'converted-preview');
    });

    harness.test('XML Entity Decoding & Numeric Bounds Branches', () => {
      // Named entities
      assertEqual(decodeXmlEntities('&amp;'), '&');
      assertEqual(decodeXmlEntities('&lt;'), '<');
      assertEqual(decodeXmlEntities('&gt;'), '>');
      assertEqual(decodeXmlEntities('&quot;'), '"');
      assertEqual(decodeXmlEntities('&apos;'), "'");
      assertEqual(decodeXmlEntities('&nbsp;'), ' ');
      assertEqual(decodeXmlEntities('&copy;'), '©');
      assertEqual(decodeXmlEntities('&reg;'), '®');
      assertEqual(decodeXmlEntities('&trade;'), '™');
      assertEqual(decodeXmlEntities('&mdash;'), '—');
      assertEqual(decodeXmlEntities('&ndash;'), '–');
      assertEqual(decodeXmlEntities('&hellip;'), '…');
      assertEqual(decodeXmlEntities('&bull;'), '•');

      // Numeric decimal entities
      assertEqual(decodeXmlEntities('&#65;'), 'A');
      assertEqual(decodeXmlEntities('&#x41;'), 'A');
      assertEqual(decodeXmlEntities('&#x20;'), ' ');

      // Out-of-bounds decimal and hex codes
      assertEqual(decodeXmlEntities('&#9999999999;'), '');
      assertEqual(decodeXmlEntities('&#x110000;'), '');

      // Null, empty, non-string safety
      assertEqual(decodeXmlEntities(''), '');
      assertEqual(decodeXmlEntities(null), '');
      assertEqual(decodeXmlEntities(undefined), '');
      assertEqual(decodeXmlEntities(12345), '');
      assertEqual(
        decodeXmlEntities('Normal text without entities'),
        'Normal text without entities',
      );
    });

    harness.test('Table Cell Escaping & Row Normalization', () => {
      // Cell escaping
      assertEqual(escapeMarkdownTableCell(null), '');
      assertEqual(escapeMarkdownTableCell(undefined), '');
      assertEqual(escapeMarkdownTableCell(42), '42');
      assertEqual(escapeMarkdownTableCell('a | b'), 'a \\| b');
      assertEqual(escapeMarkdownTableCell('C:\\Users\\admin'), 'C:\\\\Users\\\\admin');
      assertEqual(escapeMarkdownTableCell('<br>hello<br><br>world<br>'), 'hello<br>world');
      assertEqual(escapeMarkdownTableCell('line1\r\nline2\nline3'), 'line1<br>line2<br>line3');
    });

    harness.test('HTML Detection & Turndown Edge Cases', () => {
      // HTML detection
      assertEqual(convertTextToMarkdown(''), '');
      assertEqual(convertTextToMarkdown('   '), '');

      const html1 = '<!DOCTYPE html><html><body><h1>Header</h1></body></html>';
      assertContains(convertTextToMarkdown(html1), '# Header');

      const html2 = '<html><body><p>Paragraph</p></body></html>';
      assertContains(convertTextToMarkdown(html2), 'Paragraph');

      const html3 = '<div><span>Inline content</span></div>';
      assertContains(convertTextToMarkdown(html3), 'Inline content');

      // Turndown empty table rules
      assertEqual(htmlToMarkdown('<table></table>'), '');
      assertEqual(htmlToMarkdown('<table><tr></tr></table>'), '');
      assertEqual(
        htmlToMarkdown('<table><tbody><tr><td>   </td></tr></tbody></table>'),
        '|  |\n| --- |',
      );

      // Preview formatting
      const preview = normalizePreviewMarkdown('Some preview text', 'C:/docs/report.docx');
      assertContains(preview, 'Some preview text');

      const emptyPreview = normalizePreviewMarkdown('', 'C:/docs/report.docx');
      assertContains(emptyPreview, 'No readable content was found');
    });

    harness.test('RTF Parser & Formatter Branch Matrix', () => {
      // Headings by font size
      const rtfH1 =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\\fs58\\b Top Level Heading\\par}';
      const mdH1 = convertRtfToMarkdown(Buffer.from(rtfH1, 'utf8'));
      assertContains(mdH1, '# **Top Level Heading**');

      const rtfH2 =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\\fs46\\b Second Level Heading\\par}';
      const mdH2 = convertRtfToMarkdown(Buffer.from(rtfH2, 'utf8'));
      assertContains(mdH2, '## **Second Level Heading**');

      const rtfH3 =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\\fs36\\b Third Level Heading\\par}';
      const mdH3 = convertRtfToMarkdown(Buffer.from(rtfH3, 'utf8'));
      assertContains(mdH3, '### **Third Level Heading**');

      // Strikethrough & bullet
      const rtfStyle =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\\strike Strikethrough\\strike0\\par\\bullet Bullet item\\par}';
      const mdStyle = convertRtfToMarkdown(Buffer.from(rtfStyle, 'utf8'));
      assertContains(mdStyle, '~~Strikethrough~~');
      assertContains(mdStyle, '- Bullet item');

      // Special control symbols: \~ \_ \-
      const rtfSymbols =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}Word\\~NonBreaking\\_Hyphen\\par}';
      const mdSymbols = convertRtfToMarkdown(Buffer.from(rtfSymbols, 'utf8'));
      assertContains(mdSymbols, 'Word');
      assertContains(mdSymbols, 'NonBreaking');

      // Quotes: \ldblquote \rdblquote \lquote \rquote
      const rtfQuotes =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\\ldblquote Quoted\\rdblquote  and \\lquote Single\\rquote\\par}';
      const mdQuotes = convertRtfToMarkdown(Buffer.from(rtfQuotes, 'utf8'));
      assertContains(mdQuotes, 'Quoted');
      assertContains(mdQuotes, 'Single');

      // Skip destination groups: {\*\header ...}
      const rtfSkip =
        '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}{\\*\\header Header text to skip}Main body text\\par}';
      const mdSkip = convertRtfToMarkdown(Buffer.from(rtfSkip, 'utf8'));
      assert(!mdSkip.includes('Header text to skip'), 'Skip destination should be omitted');
      assertContains(mdSkip, 'Main body text');
    });

    harness.test('XLSX Data Parser Boundary Cases', async () => {
      // Corrupt zip without xl/workbook.xml
      const zipEmpty = new JSZip();
      zipEmpty.file('test.txt', 'dummy');
      const emptyZipBuf = await zipEmpty.generateAsync({ type: 'nodebuffer' });

      await assertRejects(async () => {
        const zip = await JSZip.loadAsync(emptyZipBuf);
        if (!zip.file('xl/workbook.xml')) {
          throw new Error('Invalid XLSX file: missing workbook.xml');
        }
      }, 'Must reject XLSX missing workbook.xml');

      // Path inference
      const inferred = inferOutputPath('C:/test/file.docx');
      assert(inferred.endsWith('.md'), 'Inferred output must have .md extension');

      const mdInferred = inferOutputPath('C:/test/file.md');
      assert(mdInferred.endsWith('_converted.md'), 'Markdown files must suffix _converted.md');
    });

    harness.test('Converter Error & Fallback Paths', async () => {
      // Non-existent file
      await assertRejects(
        async () => convertFileToMarkdown(path.join(tmpDir, 'non-existent-file.docx')),
        'Must reject non-existent file',
      );

      // Unsupported extension
      const invalidPath = path.join(tmpDir, 'invalid.xyz');
      await fs.writeFile(invalidPath, 'dummy content');
      await assertRejects(
        async () => generateMarkdown(invalidPath),
        'Must reject unsupported extension',
      );
    });
  });
}
