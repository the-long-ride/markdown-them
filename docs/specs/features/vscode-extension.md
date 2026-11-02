---
schema_version: 1
id: "feature.vscode-extension"
title: "VS Code extension integration"
kind: "feature"
status: "verified"
summary: "Visual Studio Code extension providing context menu actions, editor fallback conversions, and configurable concurrency."
tags: ["vscode", "extension", "keybindings", "editor"]
source_paths: ["package.json", "src/converters.ts", "src/extension.ts", "src/vscode/extension.ts"]
related_specs: ["architecture.overview", "feature.document-conversion"]
last_doc_update_at: "2026-11-02T13:30:00Z"
last_verified_at: "2026-11-02T13:30:00Z"
last_verified_code_commit: "5a23917"
last_source_change_commit: "5a23917"
last_source_change_at: "2026-11-02T06:10:22Z"
source_fingerprint: "sha256:6e7298dbfd45100ec32329d6d5be0fa7930a339e9ccf970d3ced7dabf8d9af7e"
---

# VS Code extension integration

## Purpose and boundaries
Integrates Markdown Them conversion directly into Visual Studio Code workflows. Developers and technical writers can right-click any supported office document in the File Explorer or press keyboard shortcuts to generate Markdown documents without leaving their editing environment.

## Observable behavior
- **Explorer Context Menu**: Right-clicking supported document formats displays `Convert to Markdown`.
- **Keyboard Shortcuts**: `Ctrl+Alt+M` (Windows/Linux) and `Cmd+Alt+M` (macOS) converts selected or active documents. `Ctrl+M Ctrl+D` converts the currently open file.
- **Active Editor Fallback**: When invoked from the command palette without an active Explorer selection, the extension automatically identifies and converts the active editor's document.
- **Conversion Notifications**: Shows progress indicators for batch conversions and displays destination file paths on completion.
- **Configurable Concurrency**: Settings option `markdown-them.maxConcurrentConversions` controls simultaneous file conversions (range 1–16, default 6).

## Workflow
1. User invokes `markdown-them.convertToMarkdown` or `markdown-them.convertCurrentToMarkdown`.
2. Extension determines target file URIs from Explorer context, active selection, or active document fallback.
3. Queue processes conversions up to the configured concurrency limit using `src/converters.ts`.
4. Result Markdown files are written adjacent to source files (or suffixed with `_converted.md` if the input is already `.md`).
5. Success notification is surfaced in the VS Code status bar / alert dialog.

## Code map
- `src/vscode/extension.ts` — VS Code extension lifecycle entry point (`activate`, `deactivate`), command handlers, and notification plumbing
- `src/extension.ts` — backward-compatible root export re-exporting the VS Code extension entry point
- `src/converters.ts` — extension-facing conversion adapter bridging to `src/core/`
- `package.json` — extension manifest defining contributed commands, menus, keybindings, and configuration settings

## Interfaces and data
- Commands: `markdown-them.convertToMarkdown`, `markdown-them.convertCurrentToMarkdown`, `markdown-them.setMaxConcurrentConversions`.
- Configuration: `markdown-them.maxConcurrentConversions` (integer, 1–16).

## Verification
- Packaging build: `npm run pack:vsix` executes `bundle:vscode` via esbuild and creates the `.vsix` distribution artifact.
- Automated tests: Tier 5 Matrix 8 verifies VS Code extension manifest and contribution invariants (`tests/e2e/tiers/tier5-cli.test.mjs`).

## Related documentation
- [System Architecture Overview](../architecture/overview.md)
- [Document Conversion Engine](document-conversion.md)

## Known limitations and open questions
- Virtual workspaces (such as remote browser-only VS Code sessions) require filesystem provider write permissions.
