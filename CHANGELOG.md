# Changelog

All notable changes to the "markdown-them" extension will be documented in this file.

## [1.4.0] - 2026-11-02

### General Architecture & Source Variants

#### 1. Tauri Desktop Application (`src-tauri/`, `src/app/`)

- **Tauri v2 Migration**: Migrated desktop architecture from Electron to Tauri v2 with a high-performance, multi-threaded Rust backend (`src-tauri/`) handling native file dialogs, recursive directory scanning, and zero-leak file I/O.
- **Client-Side In-Memory Conversion**: Pure client-side conversion engine executing in UI runtime with parallel worker queues, ensuring documents never leave the local machine.
- **Enhanced Desktop UI**: Redesigned header and drop zones with format badges, keyboard accessibility (`Enter`/`Space`), item removal (`X`) from batch queues, real-time live statistics in Text Mode, and smooth zoom controls (`Ctrl+=`/`Ctrl+-`/`Ctrl+Scroll`).
- **Internationalization**: Full localization across 8 languages (English, Vietnamese, Chinese, Japanese, Spanish, French, Korean, German) with modular translation dictionaries.

#### 2. Node.js Package & CLI Tool (`@the-long-ride/markdown-them`, `mdthem`)

- **`mdthem` Executable CLI**: Added full command-line conversion utility supporting global (`-g`) and local usage.
- **Single File & Directory Conversion**: Converts single files with destination path inference (`mdthem -s <file>`) or explicit destination (`mdthem -s <file> -d <out.md>`), and entire directories (`mdthem -s <dir> -d <out_dir>`).
- **Recursive Directory Processing**: Added `-a` / `--all` recursive flag (`mdthem -s -all <dir> -d <out_dir>`) with loop-safe destination isolation.
- **Path Inference & Collision Avoidance**: Automatic creation of non-existent target directories, suffixing input markdown files (`_converted.md`), and deterministic numbered disambiguation (`summary-2.md`, `summary-3.md`) across subdirectories.
- **Dual Package Support**: Dual-mode package architecture supporting both CommonJS (`require`) and ECMAScript Modules (`import()`) in Node.js >= 18.

#### 3. VS Code Extension (`src/vscode/`, `src/extension.ts`)

- **Keyboard Shortcuts**: Added `Ctrl+Alt+M` (Windows/Linux) and `Cmd+Alt+M` (macOS) keybindings for instant conversion of active files.
- **Active Editor Fallback**: Automatically infers and converts the current active editor document when triggered without an Explorer context selection.
- **Destination Feedback**: Explicit destination file path notification displayed upon single-file conversion completion.
- **Configurable Concurrency**: Configurable concurrent conversion limit (`markdown-them.maxConcurrentConversions`, range 1–16).

#### 4. Web Application (`src/app/`, `dist/web/`)

- **Self-Contained Browser Build**: Modular esbuild browser bundle (`scripts/build-apps.mjs`) compatible with strict CSP environments without inline script violations.
- **Dynamic Dev Server**: Fast local development server with Server-Sent Events (SSE) live reload (`scripts/start-web.mjs`).
- **Universal Worker Resolution**: Robust multi-tier dynamic resolution of `pdf.worker.min.mjs` supporting `pnpm`, `npm`, and `yarn` virtual store layouts.

#### 5. Core Document Parsers (`src/core/`)

- **Strict LOC Limit Compliance**: Refactored monolithic parsers into single-responsibility submodules adhering to strict lines-of-code thresholds (`.ts <= 300`, `.tsx <= 350`, `.rs <= 300`, `.css <= 400`).
- **Modular PPTX Engine**: Split into `collector`, `geometry`, `image`, `layout`, `package`, `renderer`, `table`, `text`, `types`, and `xml`.
- **Modular ODF Engine**: Split into `flow`, `geometry`, `images`, `layout`, `presentation`, `spreadsheet`, `styles`, `types`, and `xml`.
- **Modular Markdown Utilities**: Split into `normalization`, `office-ast`, `tables`, `turndown`, and `xml`.
- **Modular RTF Engine**: Split into `formatter`, `parser`, and `types` with full `\uc0` CJK character support.
- **Isolated Worker Polyfills**: Clean lifecycle cleanup for PDF.js / unpdf globals preventing cross-version worker collisions.

#### 6. Testing & CI Infrastructure (`tests/`, `scripts/`, `.github/`)

- **Automated LOC Linter**: Enforced through `scripts/loc-lint.mjs` and `scripts/lib/source-policy.mjs` across every source file.
- **Complex Document Test Suite**: Added zero-external-binary fixtures and end-to-end tests (Tiers 6 & 7) covering multi-sheet XLSX, multi-slide PPTX, semantic HTML, CJK RTF, and multi-page stream PDFs.
- **Unified Test Orchestrator**: `pnpm run test` executes fast parallel Stage 1 validation (LOC lint, Cargo fmt, TypeScript compilation, apps typecheck, Prettier) and parallel Stage 2 suites (Tauri Rust backend tests, Node.js E2E & >90% branch coverage suite) in ~20 seconds.
- **CI Modernization**: Updated GitHub Actions (`.github/workflows/build.yml`) with automated Rust toolchain setup, web builds, and end-to-end multi-tier test pipelines.

## [1.3.2] - 2026-08-11

- Resolved `pdfjs-dist` vulnerability (CVE-2026-16633): upgraded `officeparser` to 7.5.1 and forced `pdfjs-dist` to 6.2.108 via npm overrides in both `package.json` manifests.
- Resolved `electron` vulnerability (GHSA-r4w5-6pfg-jxp5) by updating Electron to a patched version.
- Added Dependabot configuration that groups dependency updates (including security updates) into a single pull request per update cycle.

## [1.3.1] - 2026-06-23

- Enabled zooming (`Ctrl + =` / `Ctrl + -`) and pinch/scroll-to-zoom (`Ctrl + mousewheel`) in the desktop application.
- Added container scrolling for the desktop app on heavy window resizing.
- Modernized scrollbars globally to be thinner and minimalist.

## [1.3.0] - 2026-06-06

- Added a multi-platform desktop variants (Windows Portable `.exe`, Linux `.AppImage`/`.deb`, macOS `.dmg`/`.zip`) using `electron-builder`.
- Improved conversion support for `.pptx`, `.odt`, and `.odp` files by extracting structured text and main content images where available.
- Improved `.ods` conversion by extracting sheets as Markdown tables.
- Improved `.rtf` conversion by preserving common text styling, headings, and bullet lists.

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
