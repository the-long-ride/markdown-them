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
source_fingerprint: "sha256:2be7f5f7932a5194cd9f6b8b5bd5202bca65350dc6ac9451f516af77a1e2f526"
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
- **Unified Command**: `pnpm run test` or `npm test` runs the entire suite in ~20 seconds.
- **Fail-Fast Staging**: Fast static checks run in parallel in Stage 1; full test execution runs in Stage 2 only if Stage 1 passes.

## Workflow
1. **Stage 1: Fast Parallel Verification**:
   - `LOC Limit Lint Check`: validates all tracked files against lines-of-code policies (`scripts/loc-lint.mjs`).
   - `Cargo Format Check`: runs `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`.
   - `TypeScript Root Compilation`: verifies root TypeScript build via `tsc -p ./`.
   - `TypeScript Core & Apps Typecheck`: verifies frontend and app builds via `tsc -p ./tsconfig.app.json`.
   - `Prettier Style Check`: checks repository code formatting via `prettier --check .`.
2. **Stage 2: Parallel Full Test Execution**:
   - `Tauri Rust Backend Tests`: executes 51 backend integration tests (`cargo test --manifest-path src-tauri/Cargo.toml`).
   - `Node.js E2E & Condition Coverage Suite`: executes 84 automated tests across Tiers 1–7 with `c8` coverage reporting (`scripts/test-coverage.mjs`).
3. **CI Automation**:
   - `.github/workflows/build.yml` executes this unified workflow on all pushes and pull requests across Linux, macOS, and Windows.

## Code map
- `scripts/run-all-tests.mjs` — staged parallel test runner orchestrating verification steps
- `scripts/loc-lint.mjs` — CLI entry point for lines-of-code policy enforcement
- `scripts/lib/source-policy.mjs` — core LOC policy definitions and file discovery filters
- `scripts/test-coverage.mjs` — wrapper running the 84 E2E tests with `c8` condition/branch coverage metrics
- `tests/e2e/run-e2e.mjs` — multi-tier E2E test harness
- `.github/workflows/build.yml` — GitHub Actions continuous integration workflow

## Interfaces and data
- `runStage(title: string, steps: StepDefinition[]): Promise<void>`
- E2E Test Tiers:
  - Tier 1: Feature Coverage (9 tests)
  - Tier 2: Boundary & Corner Cases (18 tests)
  - Tier 3: Mixed Batches (4 tests)
  - Tier 4: Scenarios & Stress (4 tests)
  - Tier 5: CLI Automated Suite (33 tests)
  - Tier 6: Complex Documents (6 tests)
  - Tier 7: Deep Condition & Branch Coverage (8 tests)

## Verification
- Verified by running `pnpm run test`: completes in ~20s with 100% pass rate.
- Verified by running `npm run lint:loc`: returns `lint:loc ok`.

## Related documentation
- [System Architecture Overview](../architecture/overview.md)
- [Document Conversion Engine](../features/document-conversion.md)
- [CLI Interface & Package Contracts](../interfaces/cli.md)

## Known limitations and open questions
- Windows PowerShell spawners require command-line quoting rules handled in `run-all-tests.mjs`.
