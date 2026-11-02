---
schema_version: 1
id: "interface.cli"
title: "CLI interface and package contracts"
kind: "interface"
status: "verified"
summary: "Command-line interface (mdthem) and dual CommonJS/ESM library contracts for standalone document conversion."
tags: ["cli", "mdthem", "npm", "package", "library"]
source_paths: ["nodejs-package/package.json", "src/nodejs-package/cli-args.ts", "src/nodejs-package/cli-runner.ts", "src/nodejs-package/cli.ts", "src/nodejs-package/index.ts"]
related_specs: ["architecture.overview", "feature.document-conversion"]
last_doc_update_at: "2026-11-02T13:30:00Z"
last_verified_at: "2026-11-02T13:30:00Z"
last_verified_code_commit: "5a23917"
last_source_change_commit: "5a23917"
last_source_change_at: "2026-11-02T06:10:22Z"
source_fingerprint: "sha256:695c7a6fd95e0aba0d546dcfc548fa26e94fd1c534a1462d156975bc7cfd31ef"
---

# CLI interface and package contracts

## Purpose and boundaries
Specifies the standalone Node.js package `@the-long-ride/markdown-them` and its bundled command-line executable `mdthem`. The tool can be installed globally (`npm install -g @the-long-ride/markdown-them`) or imported directly as a library in CommonJS and ESM Node.js projects.

## Observable behavior
- **Command Matrix**:
  - `mdthem -s "path/doc.docx" -d "path/out.md"`: converts file to explicit destination.
  - `mdthem -s "path/doc.docx"`: infers output path as `path/doc.md`.
  - `mdthem -s "path/input.md"`: infers output path as `path/input_converted.md` to prevent in-place file clobbering.
  - `mdthem -s "folder" -d "results"`: converts all top-level supported files in folder (excluding subfolders).
  - `mdthem -s "folder"`: converts top-level files to default destination `folder/results`.
  - `mdthem -s -all "folder" -d "results"` (or `-a` / `--all`): converts all supported files recursively across subdirectories.
  - `mdthem -s -all "folder"`: converts recursively to `folder/results`.
- **Auto-Directory Creation**: Automatically creates target directories if they do not exist.
- **Collision Disambiguation**: Files from different subdirectories sharing the same base name are disambiguated as `stem.md`, `stem-2.md`, `stem-3.md`.
- **Dual Mode Library**: Library consumers can import functions using both CommonJS `require('@the-long-ride/markdown-them')` and ESM `import { generateMarkdown } from '@the-long-ride/markdown-them'`.

## Workflow
1. CLI entrypoint invokes `parseCliArgs(process.argv.slice(2))`.
2. Validates source path existence and resolves trailing directory slashes or quoted Windows strings.
3. If source is a file, executes single file conversion with auto-inferred or specified destination.
4. If source is a directory, scans entries (shallow or recursive based on `-a`/`--all`/`-all`), filters out unsupported extensions, allocates unique output paths, and writes converted markdown files.
5. Exits code 0 on success, or code 1 with descriptive stderr on errors.

## Code map
- `src/nodejs-package/cli.ts` — CLI executable script with shebang `#!/usr/bin/env node`
- `src/nodejs-package/cli-args.ts` — command line argument parser, help/version text, and path sanitizers
- `src/nodejs-package/cli-runner.ts` — batch execution, directory traversal, and collision avoidance logic
- `src/nodejs-package/index.ts` — public library entry point exporting `generateMarkdown`, `convertFileToMarkdown`, and `inferOutputPath`
- `nodejs-package/package.json` — package manifest defining `bin.mdthem`, `main`, and `types`

## Interfaces and data
- `CliOptions`: `{ source?: string; destination?: string; all: boolean; help: boolean; version: boolean; unknownArgs: string[]; pendingError?: string; }`
- Exported functions:
  - `generateMarkdown(filePath: string): Promise<string>`
  - `convertFileToMarkdown(filePath: string, outputPath?: string): Promise<string>`
  - `inferOutputPath(filePath: string): string`

## Verification
- Comprehensive 33-test automated matrix in Tier 5 (`tests/e2e/tiers/tier5-cli.test.mjs`):
  - Matrix 1: CLI Flags & Basic Invocation
  - Matrix 2: Single File Conversion & Destination Resolution
  - Matrix 3: Directory Top-Level Conversion Without -a
  - Matrix 4: Directory Recursive Conversion
  - Matrix 5: File Filtering & Unsupported File Skipping
  - Matrix 6: Collision Disambiguation Across Subdirectories
  - Matrix 7: Dual Library & Packaging Verification
  - Matrix 8: Multi-Target Invariant Checks

## Related documentation
- [System Architecture Overview](../architecture/overview.md)
- [Document Conversion Engine](../features/document-conversion.md)

## Known limitations and open questions
- The recursive scan skips hidden dot-directories (`.git`, `.vscode`) by design to avoid redundant overhead.
