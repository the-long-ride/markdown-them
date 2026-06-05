# Changelog

All notable changes to the "markdown-them" extension will be documented in this file.

## [Unreleased]

## [1.3.0] - 2026-06-06
- Added a multi-platform desktop packaging pipeline (Windows Portable `.exe`, Linux `.AppImage`/`.deb`, macOS `.dmg`/`.zip`) using `electron-builder`.
- Configured CI/CD release workflows to build multi-platform desktop installers and publish the extension to Open VSX Registry and VS Code Marketplace.
- Added localized README documentations in Vietnamese, Chinese, Japanese, Norwegian, Spanish, French, and Korean under `docs/`.
- Implemented UI enhancements including a conditional pulsating CTA effect on the Convert button and CSS layout alignment fixes for the web app footer and list row download buttons.
- Updated repository and homepage links to point to the renamed `markdown-them` repository.
- Added a custom clause to the LICENSE restricting theme, styles, and asset reuse in other apps or extensions.

## [1.2.0] - 2026-05-29
- Split shared conversion logic, VS Code integration, and Node.js package entry points into clearer source folders.
- Added the new Node.js package `@the-long-ride/markdown-them` with npm build and publish automation.
- Replaced the `.xlsx` conversion dependency on `exceljs` with a lightweight OOXML parser using `jszip` and `fast-xml-parser` to clear npm audit findings.

## [1.1.4] - 2026-05-11
- **Bug Fix:** Resolved a `Cannot read properties of null (reading 'toString')` crash when parsing `.xlsx` and other Office files that contain null values, uncalculated formulas, or malformed rich-text cells.
- **Improvement:**
  - Added console logging with stack traces (viewable in the VS Code Developer Tools console) to help troubleshoot conversion failures.
  - Resolve dependency vulnerabilities about: `fast-uri`, `tmp`, `fast-csv`.

## [1.1.0] - 2026-04-28
- **New setting:** `markdown-them.maxConcurrentConversions` — control how many files are converted at the same time when using "Convert to Markdown" (range: 1–16, default: 6).
- **New command:** `Markdown Them: Set Max Concurrent Conversions` — open an interactive input box from the Command Palette to change the concurrency limit on the fly.
- Batch conversions now run concurrently instead of sequentially, significantly reducing total conversion time for large selections.

## [1.0.0] - Initial Release
- Support conversion for `.docx`, `.pdf`, `.html`, `.xlsx`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf` files.
- Command: `Convert to Markdown` from Explorer context menu.
- Command: `Convert Current File to Markdown` via `Ctrl+M Ctrl+D`.
- Removed unsafe dependencies and replaced them with robust alternatives (`mammoth`, `pdf-parse`, `exceljs`, `turndown`, `officeparser`).
