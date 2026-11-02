# Setup & Debugging

## Environment

- **Node.js**: Recommended latest LTS (>= 20.x).
- **Rust Toolchain**: Stable `rustc` and `cargo` (installed via [rustup](https://rustup.rs)). Required for building and debugging the Tauri desktop app.
- **Platform-Specific Build Tools (for Desktop)**:
  - **Windows**: Microsoft C++ Build Tools or Visual Studio with C++ desktop development.
  - **Linux**: WebKitGTK and build tools:
    ```bash
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
    ```
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
- **TypeScript**: Configured via `tsconfig.json` using CommonJS module system for VS Code compatibility.

## Desktop App (Tauri v2)

1. Ensure dependencies are installed: `npm install`.
2. Verify Rust toolchain: `cargo --version`.
3. Start development desktop app:
   ```bash
   npm run dev:desktop
   ```
   This automatically compiles web assets, starts the local dev server on `http://localhost:5173`, and launches the native Tauri desktop window.
4. Build production desktop installer:
   ```bash
   npm run build:desktop
   ```
   Installers and native binaries are generated in `src-tauri/target/release/bundle/`.

## Debugging

### VS Code Extension

1. Ensure packages are installed via `npm install`.
2. Open the project in VS Code.
3. Press `F5`. This executes the configuration in `.vscode/launch.json`.
4. The task `npm: watch` in `.vscode/tasks.json` starts the TypeScript compiler in watch mode automatically.
5. An Extension Development Host will launch.
6. Test context menus by right-clicking on files or test shortcuts (`Ctrl+M D`). Breakpoints in `src/extension.ts` will trigger.
7. Test the concurrency command: Open the Command Palette (`Ctrl+Shift+P`) and run **Markdown Them: Set Max Concurrent Conversions**. Verify the input box and settings update correctly.
