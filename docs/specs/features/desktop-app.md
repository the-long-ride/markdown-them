---
schema_version: 1
id: "feature.desktop-app"
title: "Tauri desktop application"
kind: "feature"
status: "verified"
summary: "Tauri v2 native desktop application combining a multi-threaded Rust backend with a React UI and in-memory document conversion."
tags: ["desktop", "tauri", "rust", "react", "local-first"]
source_paths: ["src-tauri/src/commands/dialogs.rs", "src-tauri/src/commands/fs.rs", "src-tauri/src/lib.rs", "src-tauri/src/main.rs", "src-tauri/src/scanner.rs", "src/app/App.tsx", "src/app/browser-converter.ts", "src/app/tauri-api.ts", "src/app/tauri-bridge.ts"]
related_specs: ["architecture.overview", "feature.document-conversion", "feature.web-app"]
last_doc_update_at: "2026-11-02T13:30:00Z"
last_verified_at: "2026-11-02T13:30:00Z"
last_verified_code_commit: "5a23917"
last_source_change_commit: "5a23917"
last_source_change_at: "2026-11-02T06:10:22Z"
source_fingerprint: "sha256:b57a90c72061abf927fbdfcd8e20765d2efea91f67fc6162ea4ac34ef5055ea9"
---

# Tauri desktop application

## Purpose and boundaries
Provides an offline, cross-platform desktop application for Windows, macOS, and Linux built on Tauri v2. It replaces the legacy Electron architecture with a lightweight multi-threaded Rust backend that interacts with operating system file dialogs and disk I/O while executing document parsing safely in-memory inside the client webview.

## Observable behavior
- **Native OS Dialogs**: File and folder pickers open via native OS dialogs.
- **Recursive Folder Scanning**: Traverses entire directory trees with directory loop safeguards, path sanitization, and traversal depth controls.
- **Concurrent In-Memory Conversions**: Multiple files are processed in parallel via a concurrency queue without disk thrashing.
- **Desktop UI Controls**: Custom minimalist window frame, zoom controls (`Ctrl+=`/`Ctrl+-`/`Ctrl+Scroll`), live statistics in Text Mode, and queue removal.

## Workflow
1. User drops files or selects files/folders through native dialogs.
2. Rust backend scans paths (`scan_directory_recursively`) and streams metadata to the webview.
3. React UI reads binary data via `read_binary_file` or direct webview `File` handles.
4. `browser-converter.ts` converts documents in parallel using the core TypeScript parsers.
5. Markdown results are either displayed in the editor or written directly to destination paths via `write_text_file`.

## Code map
- `src-tauri/src/main.rs` — executable entry point for Tauri desktop application
- `src-tauri/src/lib.rs` — Tauri application setup, plugins, and command registry
- `src-tauri/src/scanner.rs` — recursive directory scanner with security guards and extension filtering
- `src-tauri/src/commands/fs.rs` — binary read and text write filesystem commands
- `src-tauri/src/commands/dialogs.rs` — native open file and directory dialog integrations
- `src/app/App.tsx` — top-level React application component managing tabs and state
- `src/app/browser-converter.ts` — client-side conversion dispatcher executing in-memory
- `src/app/tauri-api.ts` — high-level desktop API contracts
- `src/app/tauri-bridge.ts` — IPC bridge invoking Tauri commands safely

## Interfaces and data
- `scan_directory_recursively(path: String) -> Result<Vec<FileEntry>, String>`
- `read_binary_file(path: String) -> Result<Vec<u8>, String>`
- `write_text_file(path: String, contents: String) -> Result<(), String>`
- `open_file_dialog() -> Result<Option<Vec<String>>, String>`
- `open_directory_dialog() -> Result<Option<String>, String>`

## Verification
- Rust integration tests: 51 tests across `test_backend_fs`, `test_backend_scanner`, `adversarial_security`, `adversarial_traversal`, `adversarial_path_stress`, `adversarial_collisions`, `adversarial_concurrency_stress` (`cargo test --manifest-path src-tauri/Cargo.toml`).
- All Rust files verified under strict 300 LOC limit (`npm run lint:loc`).

## Related documentation
- [System Architecture Overview](../architecture/overview.md)
- [Document Conversion Engine](document-conversion.md)
- [Web Standalone Application](web-app.md)

## Known limitations and open questions
- Drag-and-drop from sandboxed applications may provide restricted URI schemas requiring Tauri dialog fallback.
