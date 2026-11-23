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
npx @the-long-ride/markdown-them ./report.docx
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

### Quick start

```bash
# Short form: convert a file to ./docs/report.md in the same folder
mdthem "./docs/report.docx"

# Older -s / --source syntax is still supported
mdthem -s "./docs/report.docx"

# Choose an output file (creates missing parent directories)
mdthem "./docs/report.docx" -d "./notes/report.md"

# Convert only files at the top level of a directory (./docs/results/)
mdthem "./docs"

# Include nested directories
mdthem "./docs" --all
```

### Synopsis

```bash
mdthem <source> [options]
mdthem -s <source> [options]
mdthem --skill [agent]
mdthem --skill --uninstall [agent]
```

### Conversion options

| Argument / option          | What it does                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- |
| `<source>`                 | Positional file or directory path (short form; no flag required).            |
| `-s, --source <path>`      | Alternative to the positional source path (legacy syntax remains supported). |
| `-d, --destination <path>` | Output file or folder; parent directories are created as needed.             |
| `-a, --all, -all`          | Recursively convert directories instead of only their top-level files.       |
| `-h, --help`               | Print usage and available commands.                                          |
| `-v, --version`            | Print the installed package version.                                         |

With no `-d`, a single file produces a sibling `<filename>.md`; a Markdown `.md` input uses `<filename>_converted.md` instead. A directory produces a `results/` subdirectory. Directory mode skips unsupported files, and recursive traversal skips `results`, `.git`, and `node_modules`.

### Install AI agent skill (`--skill`)

`mdthem --skill` installs the reusable skill at `~/.agents/skills/markdown-them/SKILL.md`. You can additionally link the same skill into an AI agent's skills folder:

```bash
# Install the shared skill only (no agent symlinks)
mdthem --skill

# Install the shared skill and link it to one agent
mdthem --skill claude
mdthem --skill hermes
mdthem --skill codex
mdthem --skill antigravity
mdthem --skill opencode
mdthem --skill grok

# Alias for Claude Code
mdthem --skill claude-code
```

Supported agent directories (each link is named `markdown-them`):

| Agent       | Command argument              | Skill directory             |
| ----------- | ----------------------------- | --------------------------- |
| Claude Code | `claude` (also `claude-code`) | `~/.claude/skills`          |
| Hermes      | `hermes`                      | `~/.hermes/skills`          |
| Codex       | `codex`                       | `~/.codex/skills`           |
| Antigravity | `antigravity`                 | `~/.gemini/config/skills`   |
| OpenCode    | `opencode`                    | `~/.config/opencode/skills` |
| Grok        | `grok`                        | `~/.grok/skills`            |

Agent commands create a symbolic link from `~/.agents/skills/markdown-them` to the selected agent's skill directory. On Windows, directory junctions are used. Installing for several agents uses the same shared skill; run one command per agent. Existing unrelated skill entries are not overwritten.

### Uninstall AI agent skill

```bash
# Remove only the managed link for Claude; keep the shared skill and other agents
mdthem --skill --uninstall claude

# Same form for any other supported agent
mdthem --skill --uninstall codex

# Remove all managed agent links and the unmodified shared skill
mdthem --skill --uninstall
```

Uninstall operations preserve unmanaged entries and locally modified shared skill files. A targeted uninstall does not delete the shared skill, even if it is no longer linked to any agent.

### More conversion examples

```bash
# Explicit output path
mdthem -s "./docs/report.docx" -d "./dist/notes/summary.md"

# Convert a directory into a custom output directory
mdthem "./docs" -d "./converted-markdown"

# Recursive conversion with an explicit output directory
mdthem "./docs" -a -d "./all-markdown"

# Existing flag-ordering behavior remains supported
mdthem -s -all "./docs" -d "./all-markdown"

# CLI reference
mdthem --help
mdthem --version
```

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

| Format Category           | Extensions                          | Details                                                                                                      |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Word Processing**       | `.docx`, `.doc`                     | Structured headings, tables, and formatted text, with direct support for binary Word 97–2003 files.          |
| **PDF Documents**         | `.pdf`                              | Structured text extraction with paragraph reconstruction.                                                    |
| **Presentations**         | `.pptx`                             | Slides, text blocks, tables, and inline Base64 images with noise filtering.                                  |
| **Spreadsheets**          | `.xlsx`, `.xls`, `.xlm`             | One Markdown table per sheet, with direct support for legacy Excel files and hyperlink preservation in XLSX. |
| **OpenDocument**          | `.odt`, `.odp`, `.ods`              | OpenDocument text, presentation slides, and spreadsheet tables.                                              |
| **Rich Text**             | `.rtf`                              | Rich text formatting, bold/italics, bulleted lists, and headings.                                            |
| **Web & Markup**          | `.html`, `.htm`                     | HTML parsing into clean Markdown (strips scripts, styles, metadata).                                         |
| **Plain Text & Markdown** | `.txt`, `.text`, `.md`, `.markdown` | Direct text reading with normalized line endings.                                                            |

---

## License

[MIT](LICENSE)
