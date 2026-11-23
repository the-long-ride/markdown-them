---
schema_version: 1
id: "feature.document-conversion"
title: "Document conversion engine"
kind: "feature"
status: "verified"
summary: "Core multi-format document conversion pipeline supporting 13+ office formats with pure-TypeScript/WASM parsers and strict LOC modularity."
tags: ["conversion", "docx", "xlsx", "pptx", "pdf", "odf", "rtf", "markdown"]
source_paths: ["src/core/converters.ts", "src/core/document-converter.ts", "src/core/document-types.ts", "src/core/index.ts", "src/core/markdown-utils.ts", "src/core/odf.ts", "src/core/polyfill.ts", "src/core/pptx.ts", "src/core/rtf.ts", "src/core/xlsx.ts", "src/shared/formats.ts"]
related_specs: ["architecture.overview", "feature.desktop-app", "interface.cli"]
last_doc_update_at: "2026-11-02T13:30:00Z"
last_verified_at: "2026-11-02T13:30:00Z"
last_verified_code_commit: "5a23917"
last_source_change_commit: "5a23917"
last_source_change_at: "2026-11-02T06:10:22Z"
source_fingerprint: "sha256:e2633ddc3d6ead4576268cfd93b0617d96343b6a6ed7a568102f70f10f7b399c"
---

# Document conversion engine

## Purpose and boundaries
Provides in-memory and disk-based conversion from office document formats to standard Markdown. All parsers are implemented in client-safe JavaScript/TypeScript without native C/C++ runtime bindings. Supported formats include:
- Word processing: `.docx`, `.doc`, `.odt`, `.rtf`, `.html`, `.htm`, `.txt`, `.text`, `.md`, `.markdown`, `.mdx`
- Spreadsheets: `.xlsx`, `.xls`, `.xlm`, `.ods`
- Presentations: `.pptx`, `.odp`
- Portable Document Format: `.pdf`

## Observable behavior
- **Deterministic Conversion**: Identical input buffers yield byte-for-byte identical Markdown output.
- **Table Formatting**: Preserves table alignments, escapes pipes (`\|`), normalizes unbalanced column counts, and supports multi-sheet workbooks.
- **Legacy Office**: Reads binary Word 97–2003 tables (including nested tables), lists and hyperlinks, and legacy Excel worksheets with BIFF code-page decoding.
- **Office Content**: Retains PPTX SmartArt text; renders editable ODP table cells and images in slide reading order; keeps XLSX hyperlinks on implicit and blank cells; preserves RTF smart quotes and rejoins words split by source wrapping.
- **Normalization**: Uses UNIX newlines (`\n`), trims trailing whitespace and collapses extra blank lines outside fenced code blocks, and preserves whitespace inside fences, including fences nested in lists or block quotes.
- **Zero-Byte Guard**: Empty text/HTML files produce empty output strings, while empty binary containers (`.docx`, `.xlsx`, `.pdf`) throw informative validation errors.

## Workflow
1. Node and VS Code pass file paths to `generateMarkdown()` or `convertFileToMarkdown()`. Web and Tauri pass filenames and buffers to `convertBufferToMarkdown()`.
2. Extension is extracted and dispatched to format-specific converter:
   - Binary DOC: checks the OLE signature and uses `convertDocData` directly. Non-OLE DOC keeps the existing DOCX compatibility path.
   - DOCX: Mammoth and `htmlToMarkdown` in Node; `officeparser` in the browser runtime.
   - XLS/XLM: non-ZIP inputs use `convertXlsData` with SheetJS and its code-page tables. ZIP inputs keep the existing XLSX compatibility path.
   - XLSX: `convertXlsxData` parses OOXML tables and worksheet link relationships.
   - PPTX: `convertPptxData` with slide text, layout, and image shape collectors
   - ODF: `convertOdfData` handling ODT, ODS, and ODP
   - RTF: `convertRtfToMarkdown` with font/color table mapping and `\uc0` CJK decoding
   - PDF: `pdf2md` with cleanup of global worker state falling back to `officeparser`
3. Markdown normalization pipeline standardizes headers, list items, and whitespace.

## Code map
- `src/core/converters.ts` — high-level format dispatcher and disk file conversion helpers
- `src/app/browser-converter.ts` — in-memory format dispatcher used by web and desktop
- `src/core/legacy/` — binary DOC and XLS/XLM parsers and container detection
- `src/core/document-converter.ts` — high-level conversion class with caching and metadata extraction
- `src/core/document-types.ts` — type definitions for converted items, cache entries, and options
- `src/core/index.ts` — public entry point for core document conversion APIs
- `src/core/markdown-utils.ts` — markdown normalization and Turndown HTML rules
- `src/core/odf.ts` — OpenDocument format converter entry point
- `src/core/pptx.ts` — PowerPoint presentation converter entry point
- `src/core/rtf.ts` — Rich Text Format parser and Markdown generator
- `src/core/xlsx.ts` — Spreadsheet XML extractor and table formatter
- `src/core/shared/` — reusable ZIP, layout, image, and inline formatting helpers
- `src/core/polyfill.ts` — browser and worker polyfills for PDF.js runtime stability
- `src/shared/formats.ts` — shared supported file format lists and extensions

## Interfaces and data
- `generateMarkdown(filePath: string): Promise<string>`
- `convertFileToMarkdown(filePath: string, outputPath?: string): Promise<string>`
- `inferOutputPath(filePath: string): string`
- `DocumentConverter` class with methods `convert(file: File): Promise<ConversionResult>` and `clearCache(): void`

## Verification
- Binary DOC/XLS regressions: `tests/legacy-office.test.mjs`.
- Complex Office regressions and bundled originals: [Tier 6](../../../tests/e2e/tiers/tier6-complex-documents.test.mjs).
- Graded conversion cases: Tier 8 covers Markdown inputs and all supported file extensions. See the [test pipeline](../workflows/test-pipeline.md).

## Related documentation
- [System Architecture Overview](../architecture/overview.md)
- [CLI Interface & Package Contracts](../interfaces/cli.md)
- [Tauri Desktop Application](desktop-app.md)

## Known limitations and open questions
- PDF extraction relies on text layers; scanned image-only PDFs require OCR which is disabled by default for performance.
