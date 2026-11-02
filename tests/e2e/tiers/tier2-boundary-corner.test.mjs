/**
 * Tier 2: Boundary & Corner Cases E2E Tests
 * Validates edge conditions, empty files, malformed bytes, unicode fidelity,
 * and malicious/unexpected input handling.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  assert,
  assertEqual,
  assertContains,
  assertNotContains,
  assertRejects,
  assertTruthy,
} from '../framework/assertions.mjs';
import {
  generateMarkdown,
  convertFile,
  convertText,
  DocumentConverter,
  createDocumentConverter,
  decodeXmlEntities,
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
  escapeMarkdownTableCell,
  htmlToMarkdown,
  convertRtfToMarkdown,
} from '../framework/conversion-adapter.mjs';
import {
  generateDocx,
  generatePdf,
  generateXlsx,
  generateHtml,
  generateTxt,
  generateZeroByte,
  generateCorruptZip,
  generateCorruptPdf,
  generateCorruptRtf,
} from '../fixtures/fixture-generator.mjs';

export function registerTier2Tests(harness) {
  harness.suite('Tier 2: Boundary & Corner Cases', () => {
    let tmpDir;

    harness.beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier2-'));
    });

    harness.afterAll(async () => {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    // 1. Zero-byte handling
    harness.test('Zero-byte TXT: Produces empty markdown without error', async () => {
      const p = path.join(tmpDir, 'empty.txt');
      await fs.writeFile(p, generateZeroByte());
      const md = await generateMarkdown(p);
      assertEqual(md, '', 'Empty text file should convert to empty string');
    });

    harness.test('Zero-byte HTML: Produces empty markdown without error', async () => {
      const p = path.join(tmpDir, 'empty.html');
      await fs.writeFile(p, generateZeroByte());
      const md = await generateMarkdown(p);
      assertEqual(md.trim(), '', 'Empty HTML file should convert to empty string');
    });

    harness.test('Zero-byte DOCX: Rejects gracefully with an error', async () => {
      const p = path.join(tmpDir, 'empty.docx');
      await fs.writeFile(p, generateZeroByte());
      await assertRejects(
        () => generateMarkdown(p),
        'Zero-byte DOCX must reject because it is not a valid zip archive',
      );
    });

    harness.test('Zero-byte XLSX: Rejects gracefully with an error', async () => {
      const p = path.join(tmpDir, 'empty.xlsx');
      await fs.writeFile(p, generateZeroByte());
      await assertRejects(
        () => generateMarkdown(p),
        'Zero-byte XLSX must reject because it lacks workbook structure',
      );
    });

    harness.test('Zero-byte PDF: Rejects gracefully with an error', async () => {
      const p = path.join(tmpDir, 'empty.pdf');
      await fs.writeFile(p, generateZeroByte());
      await assertRejects(
        () => generateMarkdown(p),
        'Zero-byte PDF must reject because it has no header or catalog',
      );
    });

    // 2. Malformed files
    harness.test('Corrupt ZIP (DOCX): Handles damaged archive gracefully', async () => {
      const p = path.join(tmpDir, 'corrupt.docx');
      await fs.writeFile(p, generateCorruptZip());
      await assertRejects(
        () => generateMarkdown(p),
        'Corrupted docx zip must throw descriptive error',
      );
    });

    harness.test('Corrupt ZIP (XLSX): Handles damaged workbook gracefully', async () => {
      const p = path.join(tmpDir, 'corrupt.xlsx');
      await fs.writeFile(p, generateCorruptZip());
      await assertRejects(
        () => generateMarkdown(p),
        'Corrupted xlsx zip must throw descriptive error',
      );
    });

    harness.test('Corrupt PDF: Handles broken PDF syntax gracefully', async () => {
      const p = path.join(tmpDir, 'corrupt.pdf');
      await fs.writeFile(p, generateCorruptPdf());
      await assertRejects(
        () => generateMarkdown(p),
        'Damaged PDF without catalog or xref must reject',
      );
    });

    // 3. HTML Sanitization & Meta removal
    harness.test(
      'HTML: Strips script, style, meta, and noscript tags from markdown output',
      async () => {
        const p = path.join(tmpDir, 'malicious.html');
        const maliciousHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>body { color: red; }</style>
          <script>alert("XSS Attack");</script>
          <meta name="description" content="Meta tag content">
        </head>
        <body>
          <h1>Legitimate Heading</h1>
          <p>Normal text content</p>
          <script type="text/javascript">console.log("bad script");</script>
          <noscript><p>Noscript fallback</p></noscript>
        </body>
        </html>
      `;
        await fs.writeFile(p, maliciousHtml, 'utf-8');

        const md = await generateMarkdown(p);
        assertContains(md, '# Legitimate Heading', 'Must retain legitimate heading');
        assertContains(md, 'Normal text content', 'Must retain body text');
        assertNotContains(md, 'XSS Attack', 'Script content must be stripped');
        assertNotContains(md, 'body { color: red; }', 'Style content must be stripped');
        assertNotContains(md, 'Meta tag content', 'Meta tag content must be stripped');
        assertNotContains(md, 'Noscript fallback', 'Noscript content must be stripped');
      },
    );

    // 4. Unicode & Internationalization
    harness.test(
      'Unicode Content: Accurately preserves multilingual characters and emojis',
      async () => {
        const multilingualContent = [
          'Tiếng Việt: Thử nghiệm chuyển đổi tài liệu sang Markdown hoàn hảo.',
          '日本語: ドキュメントをマークダウンに正常に変換するテスト。',
          'Español: Conversión de documentos con tildes y caracteres especiales: á, é, í, ó, ú, ñ, ¿, ¡.',
          '中文: 这是一个完整的多语言文档转换测试，保留所有字符。',
          'Emojis: 🚀 ✨ 📄 📊 📈 💻 🔥 🎉',
        ];

        const htmlPath = path.join(tmpDir, 'multilingual.html');
        const htmlBuf = generateHtml({
          heading: 'Báo cáo Đa ngôn ngữ — 多言語レポート — Multilingual Report',
          paragraphs: multilingualContent,
        });
        await fs.writeFile(htmlPath, htmlBuf);

        const md = await generateMarkdown(htmlPath);
        assertContains(md, 'Tiếng Việt', 'Vietnamese text preserved');
        assertContains(md, '日本語', 'Japanese text preserved');
        assertContains(md, 'Conversión de documentos con tildes', 'Spanish text preserved');
        assertContains(md, '这是一个完整的多语言文档转换测试', 'Chinese text preserved');
        assertContains(md, '🚀 ✨ 📄', 'Emojis preserved');
      },
    );

    // 5. Special characters in filenames
    harness.test(
      'Filenames with spaces and special characters: Converts without path error',
      async () => {
        const specialName = 'Project Report #1 (Q3) & Analysis [2026] + draft.docx';
        const docxPath = path.join(tmpDir, specialName);
        const docxBuf = await generateDocx({
          title: 'Special Filename Test',
          paragraphs: ['Checking handling of spaces, brackets, hashes, ampersands, pluses.'],
        });
        await fs.writeFile(docxPath, docxBuf);

        const result = await convertFile(docxPath);
        assertTruthy(result.outputPath, 'Must produce valid output path');
        assertContains(result.markdown, 'Special Filename Test');
        const exists = await fs
          .stat(result.outputPath)
          .then(() => true)
          .catch(() => false);
        assert(exists, 'Converted file must exist on disk with special filename preserved');
      },
    );

    // 6. Whitespace and line breaks
    harness.test('Whitespace & Linebreaks: Normalizes CRLF and mixed line endings', () => {
      const mixedText =
        'Header Line\r\n\r\nLine with windows CRLF.\rLine with legacy CR.\nLine with Unix LF.\r\n';
      const md = convertText(mixedText);
      assertNotContains(md, '\r', 'All CR/CRLF must be normalized to standard LF');
      assertContains(md, 'Line with windows CRLF.', 'Line 1 present');
      assertContains(md, 'Line with legacy CR.', 'Line 2 present');
      assertContains(md, 'Line with Unix LF.', 'Line 3 present');
    });

    // 7. Unsupported file types
    harness.test(
      'Unsupported File Extension: Throws clear Unsupported File Type error',
      async () => {
        const exePath = path.join(tmpDir, 'malicious.exe');
        await fs.writeFile(exePath, Buffer.from('MZ binary executable data'));

        const err = await assertRejects(
          () => generateMarkdown(exePath),
          'Unsupported extension .exe must throw error',
        );
        assertContains(err.message, 'Unsupported file type: .exe');
      },
    );

    // 8. XML & HTML Entity Decoding (Looping & Character References)
    harness.test(
      'XML Entity Decoding: Decodes nested entities and numeric character references',
      () => {
        assertEqual(
          decodeXmlEntities('Alpha &amp;amp; beta'),
          'Alpha & beta',
          'Unpacks nested &amp;amp;',
        );
        assertEqual(
          decodeXmlEntities('&amp;lt;tag&amp;gt; &quot;value&quot; &apos;item&apos;'),
          '<tag> "value" \'item\'',
          'Unpacks double-encoded XML tags and quotes',
        );
        assertEqual(
          decodeXmlEntities('Dec: &#38; and Hex: &#x26;'),
          'Dec: & and Hex: &',
          'Decodes decimal and hex character references',
        );
        assertEqual(
          decodeXmlEntities('Non-breaking&nbsp;Space'),
          'Non-breaking Space',
          'Decodes non-breaking space',
        );
      },
    );

    // 9. RTF edge cases and binary protection
    harness.test('RTF Edge Cases: Malformed syntax rejects gracefully', async () => {
      const corruptRtfPath = path.join(tmpDir, 'broken.rtf');
      await fs.writeFile(corruptRtfPath, generateCorruptRtf());
      // Malformed RTF should fall through or reject gracefully
      await assertRejects(
        () => generateMarkdown(corruptRtfPath),
        'Corrupted RTF without valid header must reject',
      );
    });

    // 10. DocumentConverter caching & preview metadata (adopted from Markdown Explorer)
    harness.test('DocumentConverter: Caching and preview metadata lifecycle', async () => {
      let callCount = 0;
      const mockGetMarkdownThem = () => {
        callCount++;
        return {
          generateMarkdown: async (fp) => {
            if (fp.endsWith('.doc')) return 'Legacy Word Content';
            return 'Converted Body Content';
          },
        };
      };

      const converter = createDocumentConverter({
        getMarkdownThem: mockGetMarkdownThem,
      });

      // Verification of lazy injection (callCount must remain 0 before any convertible read)
      assertEqual(callCount, 0, 'Injected getMarkdownThem must be lazily evaluated');

      // Test extension helpers (including case-insensitive classification)
      assertEqual(getExtension('sample.DOCX'), '.docx');
      assertEqual(isMarkdownFilePath('file.md'), true);
      assertEqual(isMarkdownFilePath('file.mdx'), true);
      assertEqual(isTextDocumentFilePath('file.txt'), true);
      assertEqual(isConvertibleDocumentFilePath('file.docx'), true);
      assertEqual(classifyExtension('.docx'), 'convertible');
      assertEqual(classifyExtension('.DOCX'), 'convertible', 'Handles uppercase extension');
      assertEqual(classifyExtension('.md'), 'markdown');
      assertEqual(classifyExtension('.MD'), 'markdown', 'Handles uppercase markdown');
      assertEqual(classifyExtension('.txt'), 'text');
      assertEqual(classifyExtension('.xyz'), 'unsupported');
      assertEqual(stripKnownExtension('report.final.docx'), 'report.final');
      assertEqual(getFileTypeLabel('document.pdf'), 'PDF');

      // Test getConversionQuality
      assertEqual(getConversionQuality('.doc').qualityCode, 'legacy-best-effort');
      assertEqual(getConversionQuality('.xls').qualityCode, 'legacy-best-effort');
      assertEqual(getConversionQuality('.xlm').qualityCode, 'legacy-best-effort');
      assertEqual(getConversionQuality('.docx').qualityCode, 'converted-preview');

      // Test normalizePreviewMarkdown
      assertEqual(normalizePreviewMarkdown('Hello world', 'guide.txt'), '# guide\n\nHello world');
      assertEqual(
        normalizePreviewMarkdown('# Custom Heading\n\nBody', 'guide.txt'),
        '# Custom Heading\n\nBody',
      );
      assertContains(normalizePreviewMarkdown('', 'empty.txt'), 'No readable content was found');

      // Test createFailureMarkdown
      const failureMd = createFailureMarkdown('failed.doc', new Error('Parser failure details'));
      assertContains(failureMd, '# failed');
      assertContains(failureMd, 'could not convert this DOC file');
      assertContains(failureMd, 'Parser failure details');

      // Test readMarkdown for text and markdown (should NOT trigger getMarkdownThem)
      const testTxtPath = path.join(tmpDir, 'cached_note.txt');
      await fs.writeFile(testTxtPath, 'Cached text content line', 'utf-8');

      const textRes = await converter.readMarkdown(testTxtPath);
      assertEqual(textRes.previewInfo?.kind, 'text');
      assertContains(textRes.markdown, 'Cached text content line');
      assertEqual(callCount, 0, 'Text read does not invoke getMarkdownThem');

      const testMdPath = path.join(tmpDir, 'direct.md');
      await fs.writeFile(testMdPath, '# Direct Markdown', 'utf-8');
      const mdRes = await converter.readMarkdown(testMdPath);
      assertEqual(mdRes.previewInfo, null, 'Markdown files return null previewInfo');
      assertEqual(mdRes.markdown, '# Direct Markdown');
      assertEqual(callCount, 0, 'Markdown read does not invoke getMarkdownThem');

      // Test convertible file read triggers getMarkdownThem and populates qualityCode
      const testDocxPath = path.join(tmpDir, 'sample_test.docx');
      await fs.writeFile(testDocxPath, 'docx payload placeholder', 'utf-8');
      const docxRes = await converter.readMarkdown(testDocxPath);
      assertEqual(callCount, 1, 'Convertible document invokes getMarkdownThem exactly once');
      assertEqual(docxRes.previewInfo?.fromCache, false);
      assertEqual(docxRes.previewInfo?.qualityCode, 'converted-preview');
      assertContains(docxRes.markdown, 'Converted Body Content');

      // Test cache hit preserves qualityCode and durationMs without re-invoking generator
      const cachedDocxRes = await converter.readMarkdown(testDocxPath);
      assertEqual(callCount, 1, 'Cache hit does not re-invoke generator');
      assertEqual(cachedDocxRes.previewInfo?.fromCache, true);
      assertEqual(cachedDocxRes.previewInfo?.qualityCode, 'converted-preview');

      // Test legacy format (.doc) qualityCode
      const testLegacyDocPath = path.join(tmpDir, 'legacy_note.doc');
      await fs.writeFile(testLegacyDocPath, 'legacy doc payload', 'utf-8');
      const legacyRes = await converter.readMarkdown(testLegacyDocPath);
      assertEqual(legacyRes.previewInfo?.qualityCode, 'legacy-best-effort');
      assertContains(legacyRes.previewInfo?.qualityWarning || '', 'legacy binary Office format');

      // Test standalone readMarkdownFile function
      const directResult = await readMarkdownFile(
        '.docx',
        testDocxPath,
        () => ({ generateMarkdown: async () => 'Standalone result' }),
        new Map(),
      );
      assertContains(directResult.markdown, 'Standalone result');
      assertEqual(directResult.previewInfo?.qualityCode, 'converted-preview');
    });

    // 11. HTML table fidelity and single-escaping protection
    harness.test('HTML Tables: Accurate single escaping and nested table isolation', () => {
      // Test single escaping of pipes and backslashes in table cells (no double-escaping)
      const tableHtml =
        '<table><tr><th>Column</th><th>Path</th></tr><tr><td>A|B</td><td>C:\\Users</td></tr></table>';
      const mdTable = htmlToMarkdown(tableHtml);
      assertContains(
        mdTable,
        '| A\\|B | C:\\\\Users |',
        'Pipes and backslashes are escaped exactly once',
      );
      assertNotContains(mdTable, '\\\\\\', 'Must not contain triple or quadruple backslashes');

      // Test nested tables: inner table rows are not duplicated in the outer table
      const nestedHtml =
        '<table><tr><td>Outer Cell</td></tr><tr><td><table><tr><td>Inner Only</td></tr></table></td></tr></table>';
      const mdNested = htmlToMarkdown(nestedHtml);
      assertContains(mdNested, 'Outer Cell');
      assertContains(mdNested, 'Inner Only');

      // Test escapeMarkdownTableCell with null, undefined, numbers, and multiple linebreaks
      assertEqual(escapeMarkdownTableCell(null), '');
      assertEqual(escapeMarkdownTableCell(undefined), '');
      assertEqual(escapeMarkdownTableCell(42), '42');
      assertEqual(escapeMarkdownTableCell('Line 1\n\n\nLine 2'), 'Line 1<br>Line 2');
    });

    // 12. RTF advanced encoding and Unicode fallback support
    harness.test('RTF Encoding: Handles uc0 fallback and Windows-1252 byte characters', () => {
      // Test uc0 Unicode control word without corruption of subsequent control words
      const uc0Rtf = '{\\rtf1\\ansi\\uc0\\u20320\\u22909}';
      const uc0Md = convertRtfToMarkdown(uc0Rtf);
      assertEqual(uc0Md, '你好', 'Correctly parses Unicode RTF with \\uc0');

      // Test Windows-1252 byte escapes (0x80..0x9F range for curly quotes and dashes)
      const win1252Rtf = "{\\rtf1\\ansi \\'93Quoted\\'94 and \\'97dash}";
      const win1252Md = convertRtfToMarkdown(win1252Rtf);
      assertContains(win1252Md, '“Quoted”', 'Correctly maps Windows-1252 smart quotes');
      assertContains(win1252Md, '—dash', 'Correctly maps Windows-1252 em-dash');
    });
  });
}
