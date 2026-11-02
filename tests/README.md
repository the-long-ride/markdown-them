# Test Infrastructure Specification: Markdown Them E2E Suite

## 1. Architecture & Design Principles

The Markdown Them automated End-to-End (E2E) test suite provides opaque-box verification across all document conversion pipelines, batch processing engines, and concurrency control pools.

```
tests/e2e/
├── run-e2e.mjs                  # Master test runner entrypoint (CLI)
├── framework/
│   ├── test-harness.mjs         # Test registration, suites, hooks, timing, ANSI reporting
│   ├── assertions.mjs           # Strict semantic assertion library (equality, contains, rejects)
│   └── conversion-adapter.mjs   # Adapter bridge to core converters, batch pool & collision resolver
├── fixtures/
│   └── fixture-generator.mjs    # Pure in-memory synthetic generator for all 8 document types & edge cases
└── tiers/
    ├── tier1-feature-coverage.test.mjs  # Tier 1: Independent format conversion (8 formats)
    ├── tier2-boundary-corner.test.mjs   # Tier 2: Boundary, zero-byte, corrupt & unicode cases
    ├── tier3-mixed-batches.test.mjs     # Tier 3: Heterogeneous batches & fault isolation
    └── tier4-scenarios-stress.test.mjs  # Tier 4: Concurrency pools, collision-free naming & stress
```

### Key Architectural Pillars

1. **Zero External Binary Dependencies**: All test fixtures (`.docx`, `.pdf`, `.xlsx`, `.pptx`, `.odt`, `.rtf`, `.html`, `.txt`) are synthesized deterministically in-memory using pure Node.js and existing project packages (`jszip`). No Microsoft Office, LibreOffice, or external CLI utilities are required.
2. **Opaque-Box Verification**: Tests interact only with the published conversion APIs and file I/O boundaries, asserting that valid Markdown with the required headings, tables, formatting, and content is generated.
3. **Progressive Testability**: Operates against the stable TypeScript core conversion engine (`src/core/`) and automatically builds artifacts if needed, ensuring milestone readiness without regressions.
4. **Hermetic State & Isolation**: Each test suite creates isolated temporary directories in the operating system's temp location (`os.tmpdir()`) and completely cleans up on test lifecycle completion.

---

## 2. Test Execution & CLI Runner

The test suite is driven by a standalone Node.js runner:

```bash
# Execute the full test suite (Tiers 1 through 4)
node tests/e2e/run-e2e.mjs

# Execute a specific tier
node tests/e2e/run-e2e.mjs --tier=1
node tests/e2e/run-e2e.mjs --tier=2
node tests/e2e/run-e2e.mjs --tier=3
node tests/e2e/run-e2e.mjs --tier=4

# Run with detailed assertion stack traces
node tests/e2e/run-e2e.mjs --verbose
```

### Pass / Fail Semantics

- **Passing**: Every test executes within bounds, asserts expected markdown tokens, and handles expected errors.
- **Failing**: Any assertion error, unhandled promise rejection, unexpected exception, or abnormal exit immediately increments the failure count and produces a non-zero exit code (`exit(1)`).
- **Exit Code**: `0` if all tests pass; `1` if any test fails.

---

## 3. Test Tiers & Feature Inventory

### Tier 1: Feature Coverage (Format Independence)

Tests independent conversion of each supported format in isolation:

| Format  | Source Specification           | Verification Criteria                                                           |
| ------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `.docx` | WordprocessingML XML in ZIP    | Heading 1 mapped to `# Heading`, paragraphs, bold/italic markup                 |
| `.pdf`  | PDF 1.4 stream text layout     | Text stream extracted accurately without missing tokens                         |
| `.xlsx` | SpreadsheetML sheetData in ZIP | Markdown table with header row `\| A \| B \|` and delimiter `\| --- \| --- \|`  |
| `.pptx` | PresentationML slide shapes    | Slide titles mapped to `## **Title**`, bullet point extraction                  |
| `.odt`  | OpenDocument text XML          | Heading outline levels mapped to `# Heading`, paragraph body                    |
| `.rtf`  | Rich Text Format control words | Font size headers, `\b` bold text mapped to `**text**`, `\i` italic to `*text*` |
| `.html` | HTML5 DOM structure            | ATX headings, unordered list items, table tags converted via Turndown           |
| `.txt`  | Plain text and Markdown        | Text normalized with preserved paragraph breaks                                 |
| Path    | Destination path inference     | `basename.md` output path resolution, `file.md` -> `file_converted.md`          |

### Tier 2: Boundary & Corner Cases

Validates resilience against corrupt inputs, edge boundaries, and character sets:

- **Zero-Byte Files**:
  - Plain text & HTML: Gracefully converted to empty string without process termination.
  - Binary/ZIP formats (`.docx`, `.xlsx`, `.pdf`): Gracefully rejected with clear validation error; no unhandled crashes.
- **Corrupted / Malformed Inputs**:
  - Truncated ZIP headers: Gracefully rejected.
  - Damaged PDF structure (missing xref/trailer): Gracefully rejected.
  - Malformed HTML: Sanitized; `<script>`, `<style>`, `<meta>`, and `<noscript>` elements completely stripped.
- **Unicode & Internationalization**:
  - Multilingual character sets: Vietnamese (`Tiếng Việt`), Japanese (`日本語`), Spanish accents (`á, ñ, ¿`), Chinese (`中文`).
  - Emoji preservation: `🚀 ✨ 📄 📊 💻 🎉`.
- **Special Filenames**:
  - Filenames containing spaces, brackets, ampersands, hashes, pluses: `Project Report #1 (Q3) & Analysis [2026] + draft.docx`.
- **Newline Normalization**:
  - Converts mixed Windows CRLF (`\r\n`), legacy Mac CR (`\r`), and Unix LF (`\n`) to normalized markdown breaks.

### Tier 3: Cross-Feature Combinations (Mixed-Format Batches)

Validates batch processing and cross-format interactions:

- **Heterogeneous Batches**: All 8 document types submitted simultaneously in a single batch call. Verifies that all 8 succeed with `status: 'done'`.
- **Fault Isolation (Partial Failures)**: Mixed batch containing valid and corrupt files (e.g. 4 valid + 3 corrupt). Validates that corrupted files report `status: 'error'` while all valid files complete with `status: 'done'`. One failure never aborts the batch.
- **State Isolation**: Sequential execution across multiple runs verifies zero cross-conversion memory bleed or static state mutation.
- **Target Output Directory**: Batch targeting a dedicated output directory ensures all output `.md` files are placed exclusively in the specified folder.

### Tier 4: Real-World Scenarios (Concurrency & Stress)

Validates production deployment scenarios:

- **Collision-Free Naming Resolution**:
  - When multiple input files from different directories share identical filenames (e.g. `sub1/analysis.docx`, `sub2/analysis.docx`, `sub3/analysis.docx`), output naming automatically disambiguates:
    `analysis.md`, `analysis-2.md`, `analysis-3.md`, `analysis-4.md`.
  - Verifies zero overwriting and individual content fidelity for every file.
- **Parallel Concurrency Scaling**:
  - Executes batch conversions across concurrency limits (`concurrency = 1`, `concurrency = 4`, `concurrency = 8`).
  - Verifies thread/worker pool safety with 0 data races.
- **Live Progress Tracking**:
  - Confirms `onProgress` callbacks fire for each completed task in the pool with accurate status and metadata.
- **Large Payload Stress**:
  - Multi-row datasets (50+ row table in XLSX).
  - Multi-slide presentations (5+ slide deck in PPTX).

---

## 4. Verification Record

The test suite runs synchronously in CI and local developer environments:

- Total Tests: 30
- Passing: 30 (100%)
- Failing: 0
- Execution Time: ~0.30s
