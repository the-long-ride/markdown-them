# Developer Guidelines

Welcome to the `markdown-them` project! This guideline will help you get started with the codebase and debugging.

## Getting Started

1. **Install Dependencies:**
   Run `npm install` to install all necessary packages. Ensure Rust (stable) is installed for desktop targets.

2. **Compile the Extension:**
   Run `npm run compile` to build the typescript files once, or `npm run watch` to watch for changes.

3. **Run Desktop App (Tauri v2):**
   Run `npm run dev:desktop` to launch the Tauri desktop application in development mode.
   Run `npm run build:desktop` to generate production desktop installers in `src-tauri/target/release/bundle/`.

4. **Build Packages:**
   Run `npm run pack:vsix` to create a VS Code `.vsix`, or `npm run pack:node-package` to create the npm tarball in `artifacts/`.

## Debugging

The `.vscode/launch.json` and `.vscode/tasks.json` have been configured to make debugging seamless.

- Simply press **F5** in VS Code.
- This will automatically trigger the `npm: watch` task, compile your TypeScript code, and open a new Extension Development Host window.
- In the new window, you can test the context menus and the keyboard shortcuts. Breakpoints placed in `src/vscode/extension.ts` will hit successfully.

## Code Structure

- `src/core`: Shared conversion logic used by both the extension and npm package.
- `src/app`: Shared React 19 UI and in-memory TypeScript document conversion pipeline.
- `src-tauri`: Rust backend for the Tauri v2 desktop application (native dialogs, file I/O, window controls).
- `src/vscode`: The VS Code adapter. Contains command registrations and editor integration.
- `src/nodejs-package`: The Node.js package entry point.
- `nodejs-package`: npm package metadata, package README, license, and generated `dist` output.
- `package.json`: Holds the extension manifest, configuration, activation events, and root build scripts.

## Adding Support for New File Types

If you want to add support for a new file type:

1. Update the `when` clause in `package.json` under `menus.explorer/context` to include the new extension.
2. Update the `switch` statement in `src/core/converters.ts` (`generateMarkdown` function).
3. Use a safe parsing library.

## Publishing

To publish the extension, it is highly recommended to package it into a `.vsix` file first. This ensures the artifact remains identical across different registries and minimizes issues with local file configuration.

GitHub Actions publishes the Node.js package to npm after the release workflow builds the package tarball. Add this repository secret before creating a `v*` tag:

```text
NPM_TOKEN
```

### 1. Prerequisites

Install the official `vsce` tool globally, which is needed to package the extension:

```bash
npm install -g @vscode/vsce
```

### 2. Step 1: Package the Extension

This bundles your extension and packages it into a single `.vsix` file (e.g., `markdown-them-x.x.x.vsix`):

```bash
npm run pack:vsix
```

### 3. Step 2: Publish to VS Code Marketplace

> _PAT: personal access token_

You can publish the packaged extension directly from your terminal:

```bash
vsce publish -p <YOUR_VS_CODE_MARKETPLACE_PAT>
```

Alternatively, you can manually upload the `.vsix` file generated in Step 1 to the [Visual Studio Marketplace Management Dashboard](https://marketplace.visualstudio.com/manage).

### 4. Step 3: Publish to Open VSX Registry

To publish to [open-vsx.org](https://open-vsx.org/), it is best practice to publish the `.vsix` package directly using `ovsx`:

```bash
npx ovsx publish ./markdown-them-<version>.vsix -p <YOUR_OPEN_VSX_PAT>
```

### 5. Desktop Releases

Desktop binaries and installers are built via Tauri v2 CLI:

```bash
npm run build:desktop
```

This builds platform-native artifacts:

- Windows: NSIS Installer (`.exe`) / WiX (`.msi`)
- Linux: Debian package (`.deb`) / AppImage (`.AppImage`)
- macOS: Apple Disk Image (`.dmg`) / App Bundle (`.app`)
  Artifacts are emitted to `src-tauri/target/release/bundle/`.

### Useful Links

- [Official VS Code Publishing Docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Registry Wiki / Publishing Guide](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
