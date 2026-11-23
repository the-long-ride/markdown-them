---
schema_version: 1
id: "workflow.test-pipeline"
title: "Test orchestration and LOC lint policy"
kind: "workflow"
status: "verified"
summary: "Unified staged parallel test runner enforcing LOC limits, format checks, Rust integration tests, and 84 Node.js coverage tests."
tags: ["testing", "loc-lint", "e2e", "coverage", "ci"]
source_paths: [".github/workflows/build.yml", "scripts/lib/source-policy.mjs", "scripts/loc-lint.mjs", "scripts/run-all-tests.mjs", "scripts/test-coverage.mjs", "tests/e2e/run-e2e.mjs"]
related_specs: ["architecture.overview", "feature.document-conversion", "interface.cli"]
last_doc_update_at: "2026-11-02T13:30:00Z"
last_verified_at: "2026-11-02T13:30:00Z"
last_verified_code_commit: "5a23917"
last_source_change_commit: "5a23917"
last_source_change_at: "2026-11-02T06:10:22Z"
source_fingerprint: "sha256:fd82568a341be02f8ad7039456d86d0b59bccdb7034940b9ca8c48b84c547e45"
---

# Test orchestration and LOC lint policy

## Purpose and boundaries
Enforces code quality, structural modularity, and regression testing across the entire repository. The pipeline combines a custom per-file lines-of-code (LOC) linter with a staged parallel test orchestrator that validates the Rust backend, TypeScript compiler, Prettier formatting, and end-to-end multi-tier document conversion.

## Observable behavior
- **LOC Limits**:
  - `.rs`: 300 lines maximum
  - `.ts`: 300 lines maximum
  - `.tsx`: 350 lines maximum
  - `.css`: 400 lines maximum
  - `other`: no limit
  - Evaluated via `npm run lint:loc` with 0 permitted violations.
- **Unified Command**: `pnpm run test` or `npm test` runs the local static checks, Rust tests, and TypeScript coverage suite.
- **Fail-Fast Staging**: Fast static checks run in parallel in Stage 1; full test execution runs in Stage 2 only if Stage 1 passes.

## Workflow
1. **Stage 1: Fast Parallel Verification**:
   - `LOC Limit Lint Check`: validates all tracked files against lines-of-code policies (`scripts/loc-lint.mjs`).
   - `Cargo Format Check`: runs `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
   - `TypeScript Core & Apps Typecheck`: verifies frontend and app builds via `tsc -p ./tsconfig.app.json`.
   - `Prettier Style Check`: checks repository code formatting via `prettier --check .`.
   - `CJK Font Glyph Coverage`: checks that the bundled fonts cover the app's translated UI strings.
2. **Stage 2: Parallel Full Test Execution**:
   - `Tauri Rust Backend Tests`: runs `cargo test --manifest-path src-tauri/Cargo.toml`.
   - `TypeScript Unit & E2E Coverage Suite`: compiles the TypeScript variants before running unit, legacy Office, and Tiers 1–8 end-to-end tests. The `c8` report gates lines, functions, branches, and statements at 90% for core, the Node.js package, VS Code, the app, shared code, and the combined total (`scripts/test-coverage.mjs`).
3. **CI Automation**:
   - On pull requests and pushes to `main`, `.github/workflows/build.yml` runs separate parallel jobs for lint, typecheck, Rust coverage (minimum 90% overall line coverage), TypeScript coverage, and web, VSIX, and npm package builds.
   - The final `CI Gate` job succeeds only if all seven jobs succeed.

## Code map
- `scripts/run-all-tests.mjs` — staged parallel test runner orchestrating verification steps
- `scripts/loc-lint.mjs` — CLI entry point for lines-of-code policy enforcement
- `scripts/lib/source-policy.mjs` — core LOC policy definitions and file discovery filters
- `scripts/test-coverage.mjs` — runner for the TypeScript tests and per-variant `c8` coverage gate
- `tests/e2e/run-e2e.mjs` — multi-tier E2E test harness
- `.github/workflows/build.yml` — GitHub Actions continuous integration workflow

## Interfaces and data
- `runStage(title: string, steps: StepDefinition[]): Promise<void>`
- E2E Test Tiers:
  - Tier 1: Feature Coverage
  - Tier 2: Boundary & Corner Cases
  - Tier 3: Mixed Batches
  - Tier 4: Scenarios & Stress
  - Tier 5: CLI Automated Suite
  - Tier 6: Complex Documents and [manual-report originals](../../../tests/e2e/fixtures/real-files.md)
  - Tier 7: Deep Condition & Branch Coverage
  - Tier 8: Graded Markdown Inputs and File Formats

## Verification
- Run `npm test` for the local pipeline or `npm run test:coverage` for the TypeScript coverage gate alone.
- After `npm run compile`, run `npm run test:e2e -- --tier=8` to select the graded input and file format cases.

## Related documentation
- [System Architecture Overview](../architecture/overview.md)
- [Document Conversion Engine](../features/document-conversion.md)
- [CLI Interface & Package Contracts](../interfaces/cli.md)

## Known limitations and open questions
- Windows PowerShell spawners require command-line quoting rules handled in `run-all-tests.mjs`.
