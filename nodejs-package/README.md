# @the-long-ride/markdown-them

Node.js package for converting documents to Markdown.

This is one of the four Markdown Them variants. See the main repo's
[Markdown Them Variants](https://github.com/the-long-ride/markdown-them#markdown-them-variants)
section for the VS Code extension, web app, desktop app, and Node.js package overview.

## Install

```bash
npm i @the-long-ride/markdown-them
# or
pnpm add @the-long-ride/markdown-them
```

## Usage

```ts
import {
  convertFileToMarkdown,
  generateMarkdown,
  inferOutputPath,
} from "@the-long-ride/markdown-them";

// Save output to sibling .md file
const outputPath = await convertFileToMarkdown("./docs/report.docx");

// Return markdown text without writing to disk
const markdown = await generateMarkdown("./docs/report.docx");

// Preview the default destination path
const defaultOutputPath = inferOutputPath("./docs/report.docx");

console.log(outputPath, defaultOutputPath, markdown.slice(0, 120));
```

## Supported extensions

`.docx`, `.pdf`, `.html`, `.xlsx`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf`.

`.pptx` output includes slide text, tables, and main content images as inline Base64 data URIs while filtering common background, logo, and icon noise.

`.odt` and `.odp` use structured OpenDocument parsing with inline main content images where available, `.ods` outputs sheets as Markdown tables, and `.rtf` preserves common text styling, headings, and bullets.
