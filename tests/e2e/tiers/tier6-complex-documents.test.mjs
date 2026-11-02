/**
 * Tier 6: Complex Multi-Feature Document Coverage
 *
 * Verifies conversion of realistic, high-complexity document structures:
 * - Complex DOCX with multi-level headings, tables, bullet lists, and styled text
 * - Complex XLSX with multi-sheets, metrics, numbers, and escaped characters
 * - Complex PPTX with multi-slide hierarchies and bullet points
 * - Complex HTML with semantic structures, quotes, code blocks, entities, and tables
 * - Complex RTF with \\uc0 CJK characters, Windows-1252 byte encodings, and styles
 * - Complex PDF with multi-page text streams
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  generateComplexDocx,
  generateComplexXlsx,
  generateComplexPptx,
  generateComplexHtml,
  generateComplexRtf,
  generateComplexPdf,
} from '../fixtures/complex-fixtures.mjs';
import { generateMarkdown } from '../framework/conversion-adapter.mjs';
import { assert, assertContains } from '../framework/assertions.mjs';

export function registerTier6Tests(harness) {
  harness.suite('Tier 6: Complex Multi-Feature Document Coverage', () => {
    let tmpDir;

    harness.beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier6-'));
    });

    harness.afterAll(async () => {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    harness.test(
      'Complex DOCX: Converts structured document with headings, tables, and lists',
      async () => {
        const docxPath = path.join(tmpDir, 'enterprise-spec.docx');
        const docxBuffer = await generateComplexDocx();
        await fs.writeFile(docxPath, docxBuffer);

        const markdown = await generateMarkdown(docxPath);
        assert(
          typeof markdown === 'string' && markdown.length > 0,
          'DOCX conversion should not be empty',
        );
        assertContains(markdown, 'Enterprise Architecture Specification 2026');
        assertContains(markdown, 'Executive Overview');
        assertContains(markdown, 'Service Level Objectives');
        assertContains(markdown, 'Implementation Invariants');

        // Validate table content
        assertContains(markdown, 'Component');
        assertContains(markdown, 'Throughput');
        assertContains(markdown, 'Latency');
        assertContains(markdown, 'Core Parser (DOCX)');
        assertContains(markdown, 'Spreadsheet Engine (XLSX)');
        assertContains(markdown, 'Presentation Parser (PPTX)');
        assertContains(markdown, 'Rich Text Engine (RTF)');

        // Validate bullet points
        assertContains(markdown, 'Zero data corruption in markdown table generation');
        assertContains(markdown, 'Multi-platform line-ending normalization');
      },
    );

    harness.test(
      'Complex XLSX: Converts multi-sheet workbook preserving sheets, numbers, and escapes',
      async () => {
        const xlsxPath = path.join(tmpDir, 'financial-model.xlsx');
        const xlsxBuffer = await generateComplexXlsx();
        await fs.writeFile(xlsxPath, xlsxBuffer);

        const markdown = await generateMarkdown(xlsxPath);
        assert(
          typeof markdown === 'string' && markdown.length > 0,
          'XLSX conversion should not be empty',
        );

        // Validate table content
        assertContains(markdown, 'Metric');
        assertContains(markdown, 'Q1 Value');
        assertContains(markdown, 'Active Concurrency');
        assertContains(markdown, 'Average Processing Time');
        assertContains(markdown, 'Throughput Peak');

        // Validate second sheet with special characters and escapes
        assertContains(markdown, 'Markdown Table Pipe');
        assertContains(markdown, 'Path Traversal Test');
        assertContains(markdown, 'Unicode Entities');
      },
    );

    harness.test(
      'Complex PPTX: Converts multi-slide presentation with distinct slide hierarchies',
      async () => {
        const pptxPath = path.join(tmpDir, 'architecture.pptx');
        const pptxBuffer = await generateComplexPptx();
        await fs.writeFile(pptxPath, pptxBuffer);

        const markdown = await generateMarkdown(pptxPath);
        assert(
          typeof markdown === 'string' && markdown.length > 0,
          'PPTX conversion should not be empty',
        );
        assertContains(markdown, 'Core Engine Architecture');
        assertContains(markdown, 'Supported Formats Matrix');
        assertContains(markdown, 'Production Security Guardrails');

        // Verify content within slides
        assertContains(
          markdown,
          'Direct buffer parsing with zero system external binary dependencies',
        );
        assertContains(markdown, 'Office Documents: DOCX, XLSX, PPTX');
        assertContains(markdown, 'Zip-slip breakout protection in relationship target parsing');
      },
    );

    harness.test(
      'Complex HTML: Converts semantic layout, blockquotes, code blocks, entities, and tables',
      async () => {
        const htmlPath = path.join(tmpDir, 'technical-spec.html');
        const htmlBuffer = generateComplexHtml();
        await fs.writeFile(htmlPath, htmlBuffer);

        const markdown = await generateMarkdown(htmlPath);
        assert(
          typeof markdown === 'string' && markdown.length > 0,
          'HTML conversion should not be empty',
        );
        assertContains(markdown, 'Architecture & Protocols');

        // Blockquote
        assertContains(markdown, 'Simplicity is prerequisite for reliability');

        // Code block
        assertContains(markdown, 'function convert(input)');

        // Entities properly decoded
        assertContains(markdown, 'Trademark ™');
        assertContains(markdown, 'Copyright ©');
        assertContains(markdown, 'Em-dash —');
        assertContains(markdown, 'En-dash –');

        // Table structure
        assertContains(markdown, 'Module');
        assertContains(markdown, 'Configuration');
        assertContains(markdown, 'Subsystem Details');
        assertContains(markdown, 'Core Engine');
        assertContains(markdown, 'Desktop Wrapper');
      },
    );

    harness.test(
      'Complex RTF: Converts rich text with font/color tables, \\uc0 CJK characters, and styling',
      async () => {
        const rtfPath = path.join(tmpDir, 'styled-report.rtf');
        const rtfBuffer = generateComplexRtf();
        await fs.writeFile(rtfPath, rtfBuffer);

        const markdown = await generateMarkdown(rtfPath);
        assert(
          typeof markdown === 'string' && markdown.length > 0,
          'RTF conversion should not be empty',
        );
        assertContains(markdown, 'Complex Rich Text Document');
        assertContains(markdown, 'Unicode Multilingual Test');

        // CJK text decoded via \\uc0
        assertContains(markdown, '你好世界');

        // Formatted sections
        assertContains(markdown, 'Strong bold emphasis for important security notes');
        assertContains(markdown, 'Subtle italic phrasing for secondary context');
      },
    );

    harness.test(
      'Complex PDF: Converts multi-page document preserving text across stream boundaries',
      async () => {
        const pdfPath = path.join(tmpDir, 'specification.pdf');
        const pdfBuffer = generateComplexPdf();
        await fs.writeFile(pdfPath, pdfBuffer);

        const markdown = await generateMarkdown(pdfPath);
        assert(
          typeof markdown === 'string' && markdown.length > 0,
          'PDF conversion should not be empty',
        );
        assertContains(markdown, 'Document Conversion Protocol v2');
        assertContains(markdown, 'Chapter 1: Multi-Platform Architecture');
        assertContains(markdown, 'Chapter 2: Concurrency & Fault Tolerance');
        assertContains(markdown, 'Concurrent conversion queues ensure maximum CPU utilization');
      },
    );
  });
}
