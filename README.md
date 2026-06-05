<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-them/main/assets/markdown-them-logo.png" width="128" alt="Markdown Them Logo">
</p>

# Markdown Them

Convert various document files into Markdown (.md) from a web application, an Electron desktop app, a VS Code extension, or a Node.js package.

- **Web App:** Client-side only document converter running entirely in your browser. Hosted and deployed directly on GitHub Pages.
- **Desktop App:** A premium Electron application for converting local files, folders, and text inputs with custom output directory options. Available for Windows (Portable), Linux (.AppImage, .deb), and macOS (.dmg).
- **VS Code Extension:** Right-click context menus in the file explorer and side-by-side Markdown previews for developer workflows.
- **Node.js Package:** Integrate the same converter engine in your custom scripts, CLIs, and automations.

- **Supported formats:** `.docx`, `.pdf`, `.html`, `.xlsx`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf`.
- **Concurrent batch processing:** Convert dozens of files at once with optimized performance.

## Markdown Them Variants

Markdown Them comes in four variants so you can use the same converter wherever it fits your workflow:

| Variant | Best for | Local/privacy model | Where to start |
|---|---|---|---|
| **Web app** | Browser-based conversion with no install | Client-side only; no document uploads or outbound conversion requests. Deployed on GitHub Pages. | `npm run start:web` |
| **Desktop app** | Local file, folder, and text conversion with an app shell | Electron app running on your computer; optional output folder selection. Installers built for Windows, Linux, and macOS. | `npm run start:desktop` |
| **VS Code extension** | Explorer context menu, active editor previews, developer workflows | Runs inside VS Code on your machine | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) or [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) |
| **Node.js package** | Scripts, CLIs, automation, and server-side tooling you control | Runs in your Node.js process | [`@the-long-ride/markdown-them`](https://www.npmjs.com/package/@the-long-ride/markdown-them) |

---

## Web and Desktop Apps

This repo includes a shared React UI for a local-only web app and an Electron desktop app.

- **Web app:** Client-side conversion only. It accepts multiple files or text input and does not send files to a server. Deployed to GitHub Pages.
- **Desktop app:** Electron shell with custom window controls. It accepts text input, one or many files, and multiple folders. File conversions write sibling `.md` files next to the originals.

### Local app commands:

```bash
npm run start:web
npm run start:desktop
npm run preview:desktop
```

### Build-only commands:

```bash
npm run build:web
npm run build:desktop
npm run build:apps
```

### Desktop Packaging Pipeline:

Build production-ready installers and binaries (Windows Portable `.exe`, Linux `.AppImage`/`.deb`, macOS `.dmg`) via `electron-builder`:

```bash
# Build for Windows (Portable exe)
npm run dist:desktop:win

# Build for Linux (AppImage & deb)
npm run dist:desktop:linux

# Build for macOS (dmg)
npm run dist:desktop:mac

# Build for all platforms
npm run dist:desktop:all
```

The resulting binaries will be placed in the `dist/installers` directory.

---

## VS Code Extension

### Usage

#### 1. Convert Multiple Files (Batch)
1. In the **Explorer** side bar, select one or more files.
2. Right-click and choose **Convert to Markdown**.
3. Files will be converted **concurrently** (up to the defined limit). You'll see notifications as each file completes.

#### 2. Convert Active File
- While viewing a document, press `Ctrl+M Ctrl+D` (or `Cmd+M Ctrl+D` on Mac).
- A markdown preview will open in a new pane beside your current editor.

#### 3. Change Concurrency Limit
- Use the command palette (`Ctrl+Shift+P`) and search for **Markdown Them: Set Max Concurrent Conversions**.
- Or, go to **File > Preferences > Settings** and search for `Markdown Them`.

> [!NOTE]
> `.pptx`, `.odt`, and `.odp` conversion extracts structured text plus main content images as inline Base64 data URIs where available. Backgrounds, repeated logos, and small decorative icons are filtered to keep Markdown readable. `.ods` extracts sheets as Markdown tables, and `.rtf` preserves common text styling, headings, and bullets.

#### 4. Troubleshooting
If a file fails to convert, you can view detailed error logs and stack traces by opening the **Developer: Toggle Developer Tools** command (from the Command Palette) and checking the **Console** tab.

### Configuration

| Setting | Type | Default | Range | Description |
|---|---|---|---|---|
| `markdown-them.maxConcurrentConversions` | `integer` | `6` | `1` – `16` | Maximum number of files converted simultaneously during a batch "Convert to Markdown" operation. |

You can change this in three ways:

**1. Command Palette** — Run `Markdown Them: Set Max Concurrent Conversions` (`Ctrl+Shift+P`) to get an interactive input box pre-filled with the current value.

**2. Settings UI** — Open **Settings** (`Ctrl+,`) and search for `Markdown Them`.

**3. `settings.json`** — Add the key directly:

```jsonc
{
  // Convert up to 4 files at the same time
  "markdown-them.maxConcurrentConversions": 4
}
```

---

## Node.js Package

Starting with v1.2.0, the shared converter is also packaged for Node.js consumers as `@the-long-ride/markdown-them`:

```bash
npm i @the-long-ride/markdown-them
pnpm add @the-long-ride/markdown-them
```

```ts
import { convertFileToMarkdown, generateMarkdown } from "@the-long-ride/markdown-them";

const outputPath = await convertFileToMarkdown("./docs/report.docx");
const markdown = await generateMarkdown("./docs/report.docx");
```

### Local build commands:

```bash
npm run pack:vsix
npm run pack:node-package
```

Tag releases publish the Node.js package to npm after the package artifact is built. Configure this GitHub repository secret before pushing a `v*` tag:

```text
NPM_TOKEN
```

---

## Source Layout

- `src/core`: Shared document-to-Markdown conversion logic.
- `src/app`: Shared React UI and browser-only conversion adapter.
- `src/electron`: Electron main/preload process for the desktop app.
- `src/shared`: Shared format metadata and filename helpers.
- `src/vscode`: VS Code command registrations and editor integration.
- `src/nodejs-package`: Node.js package entry point.
- `scripts`: App build and local startup scripts.
- `nodejs-package`: Publishable npm package metadata, README, license, and generated `dist`.

---

## Safely Powered By

I care about security & licensing for commercial use, so I picked popular packages with permissive open-source or standard licenses.
Special thanks to the authors and contributors of these incredible libraries that power this project:

- [`react`](https://github.com/facebook/react) / [`react-dom`](https://github.com/facebook/react) (MIT License): Interactive interface structure.
- [`gsap`](https://github.com/greensock/GSAP) / [`@gsap/react`](https://github.com/greensock/react) (GreenSock Standard License): Premium page transition animations.
- [`lucide-react`](https://github.com/lucide-icons/lucide) (ISC License): Elegant UI icons.
- [`mammoth`](https://github.com/mwilliamson/mammoth.js) (BSD-2-Clause License): Robust conversion of `.docx` documents.
- [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) (MIT License): Reliable text extraction from `.pdf` files.
- [`jszip`](https://github.com/Stuk/jszip) (MIT or GPL-3.0 License): Zip extraction of files.
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) (MIT License): Lightweight XML parsing for Office documents.
- [`turndown`](https://github.com/mixmark-io/turndown) (MIT License): Clean conversion of HTML content to Markdown.
- [`officeparser`](https://github.com/harshankur/officeParser) (MIT License): Fallback text extractor for unusual Office formats.

---

## Credits & Links
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 
| [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) 
| [GitHub Repository](https://github.com/the-long-ride/markdown-them) 
| [Changelog](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md) 
| [Contribution Guidelines](https://github.com/the-long-ride/markdown-them/blob/main/GUIDELINE.md)

## License
[MIT (with Theme Usage Restriction)](https://github.com/the-long-ride/markdown-them/blob/main/LICENSE)
