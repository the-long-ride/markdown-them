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
- **Normalization**: Enforces uniform UNIX newlines (`\n`), trims trailing whitespace, collapses triple blank lines, and protects fenced code blocks.
- **Zero-Byte Guard**: Empty text/HTML files produce empty output strings, while empty binary containers (`.docx`, `.xlsx`, `.pdf`) throw informative validation errors.

## Workflow
1. Input source path or binary buffer is passed to `generateMarkdown()` or `convertFileToMarkdown()`.
2. Extension is extracted and dispatched to format-specific converter:
   - DOCX: `mammoth.convertToHtml` -> `htmlToMarkdown`
   - XLSX: `convertXlsxData` OOXML streaming parser
   - PPTX: `convertPptxData` with slide text, layout, and image shape collectors
   - ODF: `convertOdfData` handling ODT, ODS, and ODP
   - RTF: `convertRtfToMarkdown` with font/color table mapping and `\uc0` CJK decoding
   - PDF: `pdf2md` with cleanup of global worker state falling back to `officeparser`
3. Markdown normalization pipeline standardizes headers, list items, and whitespace.

## Code map
- `src/core/converters.ts` — high-level format dispatcher and disk file conversion helpers
- `src/core/document-converter.ts` — high-level conversion class with caching and metadata extraction
- `src/core/document-types.ts` — type definitions for converted items, cache entries, and options
- `src/core/index.ts` — public entry point for core document conversion APIs
- `src/core/markdown-utils.ts` — markdown normalization and Turndown HTML rules
- `src/core/odf.ts` — OpenDocument format converter entry point
- `src/core/pptx.ts` — PowerPoint presentation converter entry point
- `src/core/rtf.ts` — Rich Text Format parser and Markdown generator
- `src/core/xlsx.ts` — Spreadsheet XML extractor and table formatter
- `src/core/polyfill.ts` — browser and worker polyfills for PDF.js runtime stability
- `src/shared/formats.ts` — shared supported file format lists and extensions

## Interfaces and data
- `generateMarkdown(filePath: string): Promise<string>`
- `convertFileToMarkdown(filePath: string, outputPath?: string): Promise<string>`
- `inferOutputPath(filePath: string): string`
- `DocumentConverter` class with methods `convert(file: File): Promise<ConversionResult>` and `clearCache(): void`

## Verification
- Verified by automated test suites Tiers 1–4, 6, and 7 (`tests/e2e/run-e2e.mjs`).
- Complex multi-feature validation in `tests/e2e/tiers/tier6-complex-documents.test.mjs`.
- Condition and branch coverage > 90% in `tests/e2e/tiers/tier7-branch-coverage.test.mjs`.

## Related documentation
- [System Architecture Overview](../architecture/overview.md)
- [CLI Interface & Package Contracts](../interfaces/cli.md)
- [Tauri Desktop Application](desktop-app.md)

## Known limitations and open questions
- PDF extraction relies on text layers; scanned image-only PDFs require OCR which is disabled by default for performance.
