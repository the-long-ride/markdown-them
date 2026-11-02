---
schema_version: 1
id: "architecture.overview"
title: "System architecture overview"
kind: "architecture"
status: "verified"
summary: "High-level multi-target architecture spanning VS Code extension, Tauri desktop app, Web runtime, and Node CLI package."
tags: ["architecture", "multi-target", "tauri", "vscode", "cli", "web"]
source_paths: ["instructions/architecture.md", "nodejs-package/package.json", "package.json", "src-tauri/Cargo.toml", "src-tauri/tauri.conf.json", "tsconfig.json"]
related_specs: ["feature.desktop-app", "feature.document-conversion", "feature.vscode-extension", "feature.web-app", "interface.cli", "workflow.test-pipeline"]
last_doc_update_at: "2026-11-02T13:30:00Z"
last_verified_at: "2026-11-02T13:30:00Z"
last_verified_code_commit: "5a23917"
last_source_change_commit: "5a23917"
last_source_change_at: "2026-11-02T06:10:22Z"
source_fingerprint: "sha256:19c5aa23a2f1d655460ac351bc1593a4ab00672023fd87684f9002d3ed58399c"
---

# System architecture overview

## Purpose and boundaries
Markdown Them is designed as a unified, local-first document-to-Markdown conversion engine. Its primary objective is converting binary and structured office documents (`.docx`, `.doc`, `.pdf`, `.html`, `.xlsx`, `.xls`, `.xlm`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf`, `.txt`) into clean, normalized Markdown without external server dependencies or cloud data leakage.

The workspace architecture provides a shared core parsing library mapped to four deployment targets:
1. VS Code Extension (packaged as VSIX)
2. Desktop App (packaged via Tauri v2 with native Rust backend)
3. Node.js Package and CLI (`@the-long-ride/markdown-them` and `mdthem`)
4. Web Application (browser bundle with in-memory execution)

## Observable behavior
- **Zero Server Uploads**: All parsing runs locally in-process or in-browser.
- **Unified Output Quality**: Whether invoked from the CLI, VS Code, desktop GUI, or browser, document conversion uses identical AST generation, HTML escaping, and Markdown normalization algorithms.
- **Strict LOC Compliance**: All source code modules comply with per-file limits (`.rs <= 300`, `.ts <= 300`, `.tsx <= 350`, `.css <= 400`).

## Workflow
1. **Target Packaging**:
   - `npm run pack:vsix` builds `out/extension.js` via esbuild and bundles the VS Code extension.
   - `npm run build:node-package` compiles `tsconfig.node-package.json` into `nodejs-package/dist/`.
   - `npm run build:web` bundles browser assets into `dist/web/`.
   - `npm run build:desktop` compiles the Tauri v2 backend into native executables.
2. **Execution Flow**:
   - Consumers pass a document file or byte stream.
   - The shared converter maps extension/MIME to the corresponding modular parser in `src/core/`.
   - The output is normalized into standardized GitHub Flavored Markdown.

## Code map
- `package.json` — root workspace manifest defining scripts, targets, and dependencies
- `nodejs-package/package.json` — manifest for the standalone `@the-long-ride/markdown-them` package and `mdthem` CLI binary
- `src-tauri/Cargo.toml` — Tauri v2 desktop application manifest
- `src-tauri/tauri.conf.json` — Tauri runtime window and capability configuration
- `tsconfig.json` — root TypeScript compiler configuration
- `instructions/architecture.md` — architectural guidelines and layer boundaries

## Interfaces and data
- **File System / IPC**: Tauri IPC commands (`scan_directory_recursively`, `read_binary_file`, `write_text_file`, `open_file_dialog`, `open_directory_dialog`).
- **Data Models**: `ConversionFileItem`, `ConversionResult`, `ConversionProgress`, `CliOptions`.

## Verification
- Unified orchestrator: `pnpm run test` executes cargo formatting, TypeScript compilation, LOC linter, Prettier style check, 51 Rust backend tests, and 84 Node.js E2E tests.
- Build verification: `npm run build:web`, `npm run compile`, `npm run typecheck:apps`.

## Related documentation
- [Document Conversion Engine](../features/document-conversion.md)
- [Tauri Desktop Application](../features/desktop-app.md)
- [VS Code Extension Integration](../features/vscode-extension.md)
- [Web Standalone Application](../features/web-app.md)
- [CLI Interface & Package Contracts](../interfaces/cli.md)
- [Test Orchestration & LOC Lint Policy](../workflows/test-pipeline.md)

## Known limitations and open questions
- Binary `.doc` and `.xls` files use Compound File Binary (CFB) format; they fall back to `officeparser` when OOXML renaming emulation cannot parse them.
