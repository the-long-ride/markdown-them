# Architecture & Flow

The `markdown-them` extension converts various document types to markdown.

## Key Components

1. **Commands**
   - `markdown-them.convertToMarkdown`: Context menu action. Retrieves URIs and processes them **concurrently** using a semaphore-style queue.
   - `markdown-them.convertCurrentToMarkdown`: Keyboard shortcut (`Ctrl+M D`). Retrieves active text editor or active tab URI and converts it to an in-memory markdown document displayed beside the original file.
   - `markdown-them.setMaxConcurrentConversions`: Command palette action. Allows users to interactively update the concurrency limit (1-16) which is stored in VS Code configuration.

2. **Source Layout**
   - `src/core`: Shared conversion code used by both publish targets.
   - `src/vscode`: VS Code-specific commands, progress notifications, settings, and editor integration.
   - `src/nodejs-package`: Public Node.js package entry point.
   - `nodejs-package`: npm package metadata, docs, license, and generated `dist` output.

3. **Core Logic (`src/core/converters.ts`)**
   - `generateMarkdown(filePath)`: The router that directs processing based on the file extension.
   - `convertFileToMarkdown(filePath, outputPath?)`: Saves generated markdown to disk.
   - `inferOutputPath(filePath)`: Calculates the default sibling `.md` output path.

4. **VS Code Logic (`src/vscode/extension.ts`)**
   - **Concurrency Management**: Uses a custom asynchronous queue in the `withProgress` handler to cap active conversions at `MAX_CONCURRENT` (default: 6). This prevents system resource exhaustion during large batch operations while providing faster total completion time compared to sequential processing.
   - Batch conversion calls the shared `convertFileToMarkdown` helper.
   - Active-file preview calls the shared `generateMarkdown` helper and displays the result in an in-memory Markdown document.

5. **Conversion Libraries**
   - `.docx`: `mammoth.convertToHtml` -> `turndown`
   - `.html`: File read -> `turndown`
   - `.pdf`: `@opendocsg/pdf2md`
   - `.xlsx`: `jszip` + `fast-xml-parser` -> manual parsing to Markdown tables
   - `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf`: `officeparser.parseOffice`

## Desktop Architecture (Tauri v2 + Rust)

Markdown Them Desktop utilizes a high-performance **hybrid execution architecture**:

### 1. Hybrid Separation of Concerns

1. **Frontend / UI Runtime (React 19 + TypeScript)**:
   - Location: `src/app/`
   - **In-Memory Document Conversion Engine**: Converts raw binary file buffers (`Uint8Array`) to Markdown entirely in memory via `src/app/browser-converter.ts`.
     - Libraries: `mammoth` (.docx), `@opendocsg/pdf2md` (.pdf), `jszip` + `fast-xml-parser` (.xlsx), `officeparser` (.pptx, .odt, .odp, .ods, .rtf), `turndown` (.html).
   - **Parallel Conversion Queue**: `src/app/parallel-queue.ts` coordinates asynchronous batch conversions using an internal concurrency queue (`runLimited`). Concurrency defaults to 6 files simultaneously and provides live task progress updates and cancellation support via `AbortSignal`.
   - **IPC Client Adapter**: `src/app/tauri-api.ts` implements the unified `MarkdownThemDesktopApi` interface by calling `@tauri-apps/api/core` (`invoke`).

2. **Backend Native Runtime (Rust / Tauri v2)**:
   - Location: `src-tauri/`
   - Exclusively handles OS-level capabilities:
     - `choose_files`: Opens native OS file picker with filters for supported document extensions (`tauri-plugin-dialog`).
     - `choose_folders`: Opens native folder picker and recursively traverses directories (`walkdir`) to identify supported documents.
     - `choose_output_folder`: Native directory picker for user-defined output destinations.
     - `read_file_binary`: Asynchronously reads binary file contents into memory via `tokio::fs::read`.
     - `save_converted_file`: Implements collision-free naming resolution (`doc.md`, `doc-2.md`) and writes files asynchronously via `tokio::fs::write`.
     - `save_markdown_dialog`: Native Save-As dialog.
     - `window_minimize`, `window_toggle_maximize`, `window_close`, `window_is_maximized`: Frameless custom title bar controls.

### 2. Execution Pipeline Flow

```
User Selection (Files / Folders)
           │
           ▼
[Rust] Native Dialog / walkdir Recursive Scan
           │ Returns file paths
           ▼
[TS UI] Enqueue Tasks into parallel-queue.ts
           │ Concurrency pool (e.g. 6 workers)
           ├────────────────────────┬────────────────────────┐
           ▼                        ▼                        ▼
[Rust] read_file_binary   [Rust] read_file_binary   [Rust] read_file_binary
           │ Returns bytes          │ Returns bytes          │ Returns bytes
           ▼                        ▼                        ▼
[TS UI] convertBuffer     [TS UI] convertBuffer     [TS UI] convertBuffer
(in-memory parsing)       (in-memory parsing)       (in-memory parsing)
           │ Markdown text          │ Markdown text          │ Markdown text
           ▼                        ▼                        ▼
[Rust] save_converted_file [Rust] save_converted_file [Rust] save_converted_file
(collision-free disk write) (collision-free disk write) (collision-free disk write)
```

### 3. Multi-Target Invariants

- The VS Code extension (`src/vscode/`) and Node.js package (`src/nodejs-package/`) continue using the Node.js/V8 shared converters in `src/core/converters.ts`.
- The desktop app uses `src/app/browser-converter.ts` connected via `src/app/tauri-api.ts`.
