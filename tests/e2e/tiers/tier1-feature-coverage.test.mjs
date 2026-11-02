/**
 * Tier 1: Feature Coverage E2E Tests
 * Validates independent end-to-end conversion for each supported document format:
 * .docx, .pdf, .xlsx, .pptx, .odt, .rtf, .html, .txt
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  assert,
  assertEqual,
  assertContains,
  assertMatches,
  assertGreaterThan,
} from '../framework/assertions.mjs';
import {
  generateMarkdown,
  convertFile,
  inferOutputPath,
} from '../framework/conversion-adapter.mjs';
import {
  generateDocx,
  generatePdf,
  generateXlsx,
  generatePptx,
  generateOdt,
  generateRtf,
  generateHtml,
  generateTxt,
} from '../fixtures/fixture-generator.mjs';

export function registerTier1Tests(harness) {
  harness.suite('Tier 1: Feature Coverage (Format Independence)', () => {
    let tmpDir;

    harness.beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier1-'));
    });

    harness.afterAll(async () => {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    // 1. DOCX
    harness.test('DOCX: Converts Word document with headings and styled text', async () => {
      const docxPath = path.join(tmpDir, 'sample.docx');
      const docxBuf = await generateDocx({
        title: 'Quarterly Strategy Review',
        paragraphs: ['This is a comprehensive review of our Q3 milestones.'],
        boldText: 'Critical Action Required',
        italicText: 'Preliminary notes only',
      });
      await fs.writeFile(docxPath, docxBuf);

      const markdown = await generateMarkdown(docxPath);
      assert(
        typeof markdown === 'string' && markdown.length > 0,
        'Expected non-empty markdown string',
      );
      assertContains(markdown, 'Quarterly Strategy Review', 'Must preserve document title');
      assertContains(markdown, 'comprehensive review', 'Must preserve body text');
      assertContains(markdown, 'Critical Action Required', 'Must preserve bold text');

      // Verify file-to-disk conversion
      const fileResult = await convertFile(docxPath);
      const writtenContent = await fs.readFile(fileResult.outputPath, 'utf-8');
      assertEqual(writtenContent, markdown, 'Disk output should match generated markdown');
    });

    // 2. PDF
    harness.test('PDF: Converts PDF document to structured text', async () => {
      const pdfPath = path.join(tmpDir, 'report.pdf');
      const pdfBuf = generatePdf({
        text: 'Executive Summary Report',
        lines: ['Key performance indicators showed 24 percent growth.'],
      });
      await fs.writeFile(pdfPath, pdfBuf);

      const markdown = await generateMarkdown(pdfPath);
      assert(typeof markdown === 'string' && markdown.length > 0, 'Expected non-empty markdown');
      assertContains(markdown, 'Executive Summary Report', 'Extracted text must contain header');
      assertContains(
        markdown,
        'Key performance indicators',
        'Extracted text must contain body line',
      );

      const fileResult = await convertFile(pdfPath);
      const stat = await fs.stat(fileResult.outputPath);
      assertGreaterThan(stat.size, 0, 'Output file must have non-zero size');
    });

    // 3. XLSX
    harness.test('XLSX: Converts Excel spreadsheet into Markdown table', async () => {
      const xlsxPath = path.join(tmpDir, 'financials.xlsx');
      const xlsxBuf = await generateXlsx({
        sheetName: 'Financial Highlights',
        headers: ['Region', 'Revenue', 'Target'],
        rows: [
          ['North America', '120000', '100000'],
          ['Europe', '95000', '90000'],
        ],
      });
      await fs.writeFile(xlsxPath, xlsxBuf);

      const markdown = await generateMarkdown(xlsxPath);
      assertContains(markdown, '## Financial Highlights', 'Should contain sheet heading');
      assertContains(markdown, '| Region | Revenue | Target |', 'Should format table header');
      assertContains(markdown, '| --- | --- | --- |', 'Should generate table delimiter row');
      assertContains(markdown, 'North America', 'Should contain first row data');
      assertContains(markdown, 'Europe', 'Should contain second row data');
    });

    // 4. PPTX
    harness.test('PPTX: Converts PowerPoint presentation to markdown slides', async () => {
      const pptxPath = path.join(tmpDir, 'deck.pptx');
      const pptxBuf = await generatePptx({
        slides: [
          {
            title: 'Product Roadmap 2026',
            items: ['Cloud sync release in Q1', 'Desktop Tauri migration in Q2'],
          },
        ],
      });
      await fs.writeFile(pptxPath, pptxBuf);

      const markdown = await generateMarkdown(pptxPath);
      assertContains(markdown, 'Product Roadmap 2026', 'Slide title must be present');
      assertContains(markdown, 'Cloud sync release', 'Slide bullet points must be present');
      assertContains(markdown, 'Tauri migration', 'Second bullet point must be present');
    });

    // 5. ODT
    harness.test('ODT: Converts OpenDocument Text to Markdown', async () => {
      const odtPath = path.join(tmpDir, 'document.odt');
      const odtBuf = await generateOdt({
        heading: 'Open Standard Documentation',
        paragraphs: ['ODF text format is widely used in open-source office suites.'],
      });
      await fs.writeFile(odtPath, odtBuf);

      const markdown = await generateMarkdown(odtPath);
      assertContains(
        markdown,
        '# Open Standard Documentation',
        'Heading level 1 should be generated',
      );
      assertContains(markdown, 'ODF text format', 'Body text should be preserved');
    });

    // 6. RTF
    harness.test('RTF: Converts Rich Text Format with styles to Markdown', async () => {
      const rtfPath = path.join(tmpDir, 'document.rtf');
      const rtfBuf = generateRtf({
        title: 'Release Notes',
        paragraphs: ['This is an essential update for all users.'],
        boldText: 'Fixed security vulnerability',
        italicText: 'Recommended immediately',
      });
      await fs.writeFile(rtfPath, rtfBuf);

      const markdown = await generateMarkdown(rtfPath);
      assertContains(markdown, 'Release Notes', 'Title must be present');
      assertContains(markdown, 'essential update', 'Paragraph must be present');
      assertContains(markdown, 'Fixed security vulnerability', 'Bold text must be present');
      assertContains(markdown, 'Recommended immediately', 'Italic text must be present');
    });

    // 7. HTML
    harness.test('HTML: Converts HTML with headings, lists, and tables to Markdown', async () => {
      const htmlPath = path.join(tmpDir, 'page.html');
      const htmlBuf = generateHtml({
        title: 'HTML Documentation Page',
        heading: 'API Reference Guide',
        paragraphs: ['The API provides REST endpoints for file processing.'],
        listItems: ['Endpoint /convert', 'Endpoint /status'],
        table: {
          headers: ['Method', 'Path', 'Description'],
          rows: [
            ['POST', '/convert', 'Submit file'],
            ['GET', '/status', 'Poll job status'],
          ],
        },
      });
      await fs.writeFile(htmlPath, htmlBuf);

      const markdown = await generateMarkdown(htmlPath);
      assertContains(markdown, '# API Reference Guide', 'H1 must map to # heading');
      assertContains(markdown, 'REST endpoints', 'Paragraph text must be preserved');
      assertContains(markdown, 'Endpoint /convert', 'List item 1 must be preserved');
      assertContains(
        markdown,
        '| Method | Path | Description |',
        'Table header must be formatted as GFM markdown table',
      );
      assertContains(markdown, '| --- | --- | --- |', 'Table separator row must be generated');
      assertContains(
        markdown,
        '| POST | /convert | Submit file |',
        'Table data row 1 must be formatted',
      );
      assertContains(
        markdown,
        '| GET | /status | Poll job status |',
        'Table data row 2 must be formatted',
      );
    });

    // 8. TXT & MDX
    harness.test('TXT: Converts plain text and markdown to normalized Markdown', async () => {
      const txtPath = path.join(tmpDir, 'notes.txt');
      const txtBuf = generateTxt({
        heading: 'Meeting Notes',
        paragraphs: [
          'Discussed project milestones and test suite coverage.',
          'All actions assigned.',
        ],
      });
      await fs.writeFile(txtPath, txtBuf);

      const markdown = await generateMarkdown(txtPath);
      assertContains(markdown, 'Meeting Notes', 'Text heading must be present');
      assertContains(markdown, 'test suite coverage', 'Text body must be present');

      const fileResult = await convertFile(txtPath);
      const written = await fs.readFile(fileResult.outputPath, 'utf-8');
      assertEqual(written, markdown, 'Output file must contain exact markdown text');

      // Verify MDX file conversion
      const mdxPath = path.join(tmpDir, 'component.mdx');
      await fs.writeFile(mdxPath, '# Interactive Component\n\n<Widget prop="val" />\n', 'utf-8');
      const mdxMarkdown = await generateMarkdown(mdxPath);
      assertContains(mdxMarkdown, '# Interactive Component', 'MDX title preserved');
      assertContains(mdxMarkdown, '<Widget prop="val" />', 'MDX JSX preserved');
    });

    // 9. Output Path Inference
    harness.test('Path Inference: Correctly infers markdown destination filename', () => {
      assertEqual(inferOutputPath('sample.docx'), 'sample.md');
      assertEqual(
        inferOutputPath('nested/dir/financials.xlsx'),
        path.normalize('nested/dir/financials.md'),
      );
      assertEqual(inferOutputPath('doc.html'), 'doc.md');
      assertEqual(inferOutputPath('notes.txt'), 'notes.md');
      assertEqual(inferOutputPath('existing.md'), 'existing_converted.md');
      assertEqual(inferOutputPath('component.mdx'), 'component_converted.md');
    });
  });
}
