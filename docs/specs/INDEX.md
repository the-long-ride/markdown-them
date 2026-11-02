# Markdown Them — Specification Knowledge Map

Welcome to the **Markdown Them** specification index. This directory maintains an evidence-backed, navigable repository map of architecture, features, interfaces, and validation workflows across all variants of the project.

## Document Targets & Variants

Markdown Them is a multi-variant document conversion workspace delivering local-first document to Markdown conversion across four primary deployment targets:

1. **Desktop Application (Tauri v2 + React)**: Multi-threaded Rust backend (`src-tauri/`) and pure client-side React frontend (`src/app/`).
2. **Command-Line Interface & Node Package (`mdthem`)**: Dual ESM/CommonJS package (`@the-long-ride/markdown-them`) and CLI executable (`src/nodejs-package/`).
3. **VS Code Extension**: Visual Studio Code integration providing context menus, keybindings, and active editor conversion (`src/vscode/`).
4. **Web Application**: Standalone browser deployment built via esbuild (`scripts/build-apps.mjs`, `scripts/start-web.mjs`).

---

## Specification Navigation

### Architecture

- [System Architecture Overview](architecture/overview.md) (`architecture.overview`)
  - _Keywords_: multi-variant, workspace layout, core layers, boundary contracts, targets, packaging.

### Features

- [Document Conversion Engine](features/document-conversion.md) (`feature.document-conversion`)
  - _Keywords_: parser pipeline, DOCX, XLSX, PPTX, ODF, RTF, PDF, normalization, LOC modularization.
- [Tauri Desktop Application](features/desktop-app.md) (`feature.desktop-app`)
  - _Keywords_: Tauri v2, Rust IPC, native dialogs, recursive scanner, in-memory converter, zoom, internationalization.
- [VS Code Extension Integration](features/vscode-extension.md) (`feature.vscode-extension`)
  - _Keywords_: VS Code extension, explorer context menu, editor fallback, keybindings, concurrency settings.
- [Web Standalone Application](features/web-app.md) (`feature.web-app`)
  - _Keywords_: browser build, esbuild, dev server, SSE live reload, CSP, PDF worker resolution.

### Interfaces

- [CLI Interface & Package Contracts](interfaces/cli.md) (`interface.cli`)
  - _Keywords_: mdthem, CLI flags, arguments, recursive -a, single file, folder, collision disambiguation, dual package.

### Workflows

- [Test Orchestration & LOC Lint Policy](workflows/test-pipeline.md) (`workflow.test-pipeline`)
  - _Keywords_: test runner, staged validation, parallel execution, LOC limits, branch coverage, CI workflows.
