# @the-long-ride/markdown-them

> Production-ready Node.js library and `mdthem` CLI for converting Office documents, PDFs, presentations, spreadsheets, and markup files to clean Markdown.

`@the-long-ride/markdown-them` works seamlessly both as an **executable CLI utility (`mdthem`)** (global install or `npx`) and as an **imported library** in Node.js / TypeScript codebases.

This is one of the four Markdown Them variants. See the main repo's
[Markdown Them Variants](https://github.com/the-long-ride/markdown-them#markdown-them-variants)
section for the VS Code extension, web app, desktop app, and Node.js package overview.

---

## Installation

### As a Global CLI Tool

Install globally to use the `mdthem` command from anywhere:

```bash
npm install -g @the-long-ride/markdown-them
# or
pnpm add -g @the-long-ride/markdown-them
```

### Without Installing (via npx)

Run on-the-fly without global installation:

```bash
npx @the-long-ride/markdown-them -s ./report.docx
# or using binary alias
npx mdthem -s ./report.docx
```

### As a Library Dependency

Install into your Node.js or TypeScript project:

```bash
npm install @the-long-ride/markdown-them
# or
pnpm add @the-long-ride/markdown-them
```

---

## CLI Usage (`mdthem`)

### Synopsis

```bash
mdthem -s <source> [options]
```

### Options

| Option                     | Description                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-s, --source <path>`      | **Required**. Path to the source file or directory to convert.                                                                                              |
| `-d, --destination <path>` | **Optional**. Target output file or destination directory. If missing, it will be automatically created.                                                    |
| `-a, --all, -all`          | **Optional**. When source is a directory, recursively process all subdirectories. When omitted, only top-level files in the source directory are converted. |
| `-h, --help`               | Display usage information and available options.                                                                                                            |
| `-v, --version`            | Display the installed package version number.                                                                                                               |

### Default Destination Behavior (when `-d` is omitted)

- **Single File**: Output is written to `<file-directory>/<file-name>.md` (or `<file-name>_converted.md` if source file is `.md`).
- **Directory**: Output is written to `<source-directory>/results/`.

### CLI Examples

#### Single File Conversion

```bash
# Convert a file with default output (./docs/report.md)
mdthem -s "./docs/report.docx"

# Convert a file to an explicit destination path (auto-creates destination folders)
mdthem -s "./docs/report.docx" -d "./dist/notes/summary.md"
```

#### Directory Conversion (Top-Level Only)

```bash
# Convert all supported documents in the folder into ./docs/results/
mdthem -s "./docs"

# Convert all supported documents in the folder into a custom destination folder
mdthem -s "./docs" -d "./converted-markdown"
```

#### Recursive Directory Conversion (`-a` / `--all` / `-all`)

```bash
# Recursively convert all supported documents across subfolders into ./docs/results/
mdthem -s "./docs" -a

# Recursively convert with long flag and custom output destination
mdthem -s "./docs" --all -d "./all-markdown"

# Flag-ordering resilience (flags can appear before or after arguments)
mdthem -s -all "./docs" -d "./all-markdown"
```

In directory mode, unsupported files (such as `.png`, `.zip`, `.bin`) and subdirectories (in non-recursive mode) are skipped cleanly without crashing or aborting batch execution. Loop guards prevent recursive scanning from re-entering destination folders (`results/`), `.git`, or `node_modules`.

---

## Programmatic Library Usage

```ts
import {
  convertFileToMarkdown,
  convertAndReturnMarkdown,
  generateMarkdown,
  inferOutputPath,
  convertTextToMarkdown,
  convertDirectory,
  isSupportedFileName,
} from '@the-long-ride/markdown-them';

// 1. Convert a file on disk and save markdown output
// (default destination is inferred as sibling .md file)
const outputPath = await convertFileToMarkdown('./docs/report.docx');
console.log(`Saved markdown to: ${outputPath}`);

// Specify a custom destination path
await convertFileToMarkdown('./docs/report.docx', {
  outputPath: './output/custom-report.md',
});

// 2. Generate markdown string without writing to disk
const markdown = await generateMarkdown('./docs/report.docx');
console.log('Markdown preview:', markdown.slice(0, 120));

// Or using alias convertAndReturnMarkdown
const content = await convertAndReturnMarkdown('./docs/slides.pptx');

// 3. Convert an entire directory programmatically
const stats = await convertDirectory('./docs', './converted', true);
console.log(`Converted ${stats.converted} files, skipped ${stats.skipped}`);

// 4. Preview default output path calculation
const inferred = inferOutputPath('./docs/report.docx'); // -> "./docs/report.md"

// 5. Convert raw text / HTML string directly to markdown
const mdFromText = convertTextToMarkdown('<h1>Hello World</h1>');
```

---

## Supported File Formats

`@the-long-ride/markdown-them` supports **17 document formats**:

| Format Category           | Extensions                          | Details                                                                                        |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Word Processing**       | `.docx`, `.doc`                     | Structured headings, tables, formatted text. _(Note: Legacy `.doc` uses renaming emulation)_   |
| **PDF Documents**         | `.pdf`                              | Structured text extraction with paragraph reconstruction.                                      |
| **Presentations**         | `.pptx`                             | Slides, text blocks, tables, and inline Base64 images with noise filtering.                    |
| **Spreadsheets**          | `.xlsx`, `.xls`, `.xlm`             | Worksheets converted into clean Markdown tables. _(Note: Legacy `.xls`, `.xlm` use emulation)_ |
| **OpenDocument**          | `.odt`, `.odp`, `.ods`              | OpenDocument text, presentation slides, and spreadsheet tables.                                |
| **Rich Text**             | `.rtf`                              | Rich text formatting, bold/italics, bulleted lists, and headings.                              |
| **Web & Markup**          | `.html`, `.htm`                     | HTML parsing into clean Markdown (strips scripts, styles, metadata).                           |
| **Plain Text & Markdown** | `.txt`, `.text`, `.md`, `.markdown` | Direct text reading with normalized line endings.                                              |

---

## License

[MIT](LICENSE)
