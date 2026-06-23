import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, session, shell } from "electron";
import * as fs from "fs/promises";
import * as http from "http";
import * as path from "path";
import { convertFileToMarkdown, convertTextToMarkdown } from "../core";
import { isSupportedFileName, markdownOutputName, SUPPORTED_FILE_EXTENSIONS } from "../shared/formats";

interface DesktopFileEntry {
  path: string;
  name: string;
  size?: number;
}

interface DesktopConversionResult {
  sourcePath: string;
  name: string;
  status: "done" | "error";
  outputPath?: string;
  error?: string;
}

interface DesktopUpdateInfo {
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  downloadUrl?: string;
  updateAvailable: boolean;
}

interface GitHubReleaseAsset {
  browser_download_url?: string;
  name?: string;
}

interface GitHubRelease {
  assets?: GitHubReleaseAsset[];
  html_url?: string;
  tag_name?: string;
}

const isDevelopment = !app.isPackaged && process.env.NODE_ENV !== "production";
const repoUrl = "https://github.com/the-long-ride/markdown-them";
const latestReleaseApiUrl = "https://api.github.com/repos/the-long-ride/markdown-them/releases/latest";
const latestReleaseUrl = `${repoUrl}/releases/latest`;
const documentFilters = [
  {
    name: "Documents",
    extensions: SUPPORTED_FILE_EXTENSIONS.map((extension) => extension.replace(".", "")),
  },
];
const trustedExactExternalUrls = new Set([
  "https://github.com/the-long-ride",
  repoUrl,
  "https://github.com/the-long-ride/markdown-them/blob/main/LICENSE",
  latestReleaseUrl,
  "https://open-vsx.org/extension/the-long-ride/markdown-them",
  "https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them",
  "https://www.npmjs.com/package/@the-long-ride/markdown-them",
  "https://the-long-ride.github.io/markdown-them",
  "https://the-long-ride.github.io/markdown-them/#/privacy",
  "https://the-long-ride.github.io/markdown-them/#/terms",
]);
const appId = "com.the-long-ride.markdown-them";

let mainWindow: BrowserWindow | undefined;
let isExiting = false;

Menu.setApplicationMenu(null);
app.setAppUserModelId(appId);

app.whenReady().then(async () => {
  setDockIcon();
  blockOutboundRequests();
  registerIpcHandlers();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  exitApp();
});

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 840,
    minHeight: 560,
    frame: false,
    title: "Markdown Them",
    icon: getAppIconPath(),
    backgroundColor: "#171717",
    show: false,
    webPreferences: {
      contextIsolation: true,
      devTools: isDevelopment,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  mainWindow.on("maximize", () => notifyMaximizedChange(true));
  mainWindow.on("unmaximize", () => notifyMaximizedChange(false));

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.on("before-input-event", (event, input) =>
    handleBeforeInputEvent(mainWindow, event, input)
  );

  if (isDevelopment) {
    const devUrl = await resolveDevServerUrl();
    try {
      await mainWindow.loadURL(devUrl);
    } catch {
      await mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Dev Server Unreachable</title>
<style>
  body { margin: 0; background: #171717; color: #e0e0e0; font-family: system-ui, sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh; }
  .card { background: #232323; border: 1px solid #333; border-radius: 10px; padding: 32px 40px; text-align: center; max-width: 480px; }
  h1 { margin: 0 0 12px; font-size: 18px; color: #ff6b6b; }
  p  { margin: 0 0 8px; font-size: 14px; color: #999; }
  code { background: #111; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #ccc; }
  button { margin-top: 20px; padding: 8px 20px; background: #3b82f6; border: none; border-radius: 6px;
           color: #fff; font-size: 14px; cursor: pointer; }
  button:hover { background: #2563eb; }
</style></head>
<body><div class="card">
  <h1>Dev server not reachable</h1>
  <p>Could not connect to <code>${devUrl}</code></p>
  <p>Make sure <code>npm run start:web</code> is running.</p>
  <button onclick="location.reload()">Retry</button>
</div></body></html>`)}`
      );
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, "web", "index.html"));
  }
}

function getAppIconPath(): string {
  return path.join(__dirname, "web", "assets", "markdown-them-logo.png");
}

async function resolveDevServerUrl(): Promise<string> {
  const portFilePath = path.join(__dirname, "..", ".devport");
  const scanStart = 5173;
  const scanCount = 20;

  // 1. Try the port file written by start-web.mjs (most reliable).
  try {
    const raw = await fs.readFile(portFilePath, "utf-8");
    const filePort = Number(raw.trim());
    if (Number.isInteger(filePort) && filePort > 0) {
      const url = `http://127.0.0.1:${filePort}`;
      const alive = await isServerReachable(url);
      if (alive) {
        console.log(`[Electron] Dev server found via port file on port ${filePort}.`);
        return url;
      }
    }
  } catch {
    // Port file missing — fall through to scan.
  }

  // 2. Port env var fallback.
  const envPort = Number(process.env.PORT);
  if (envPort > 0) {
    const url = `http://127.0.0.1:${envPort}`;
    const alive = await isServerReachable(url);
    if (alive) {
      console.log(`[Electron] Dev server found via PORT env var on port ${envPort}.`);
      return url;
    }
  }

  // 3. Port scan: try 5173..5192 and return the first that responds.
  console.log(`[Electron] Scanning ports ${scanStart}–${scanStart + scanCount - 1} for dev server...`);
  for (let i = 0; i < scanCount; i++) {
    const port = scanStart + i;
    const url = `http://127.0.0.1:${port}`;
    const alive = await isServerReachable(url);
    if (alive) {
      console.log(`[Electron] Dev server found on port ${port}.`);
      return url;
    }
  }

  // 4. Nothing found — fall back to default and let Electron show its own error.
  const fallback = `http://127.0.0.1:${scanStart}`;
  console.warn(`[Electron] No dev server found after scanning. Falling back to ${fallback}.`);
  return fallback;
}

async function isServerReachable(url: string, timeoutMs = 800): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const req = http.get(url, () => {
      clearTimeout(timer);
      resolve(true);
    });
    req.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function setDockIcon() {
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(getAppIconPath());
  }
}

function handleBeforeInputEvent(
  win: BrowserWindow | undefined,
  event: { preventDefault(): void },
  input: Electron.Input
): void {
  const ctrl = input.control || input.meta;

  // DevTools toggle (Ctrl+Shift+I)
  if (ctrl && input.shift && input.key.toLowerCase() === "i") {
    event.preventDefault();
    if (isDevelopment) toggleDevTools(win);
    return;
  }

  // Zoom reset (Ctrl+0)
  if (ctrl && (input.key === "0" || input.code === "Digit0")) {
    event.preventDefault();
    win?.webContents.setZoomLevel(0);
    return;
  }

  // Zoom in (Ctrl+= or Ctrl++)
  if (ctrl && (input.key === "=" || input.key === "+" || input.code === "Equal")) {
    event.preventDefault();
    if (win) {
      const next = Math.min(5, win.webContents.getZoomLevel() + 0.5);
      win.webContents.setZoomLevel(next);
    }
    return;
  }

  // Zoom out (Ctrl+-)
  if (ctrl && (input.key === "-" || input.code === "Minus")) {
    event.preventDefault();
    if (win) {
      const next = Math.max(-5, win.webContents.getZoomLevel() - 0.5);
      win.webContents.setZoomLevel(next);
    }
    return;
  }
}

function blockOutboundRequests() {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (details, callback) => {
    if (isDevelopment) {
      const url = new URL(details.url);
      if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
        callback({ cancel: false });
        return;
      }
    }
    callback({ cancel: true });
  });
}

function registerIpcHandlers() {
  ipcMain.handle("dialog:choose-files", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile", "multiSelections"],
      filters: documentFilters,
    });

    return result.canceled ? [] : entriesFromPaths(result.filePaths);
  });

  ipcMain.handle("dialog:choose-folders", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "multiSelections"],
    });

    if (result.canceled) {
      return [];
    }

    const entries: DesktopFileEntry[] = [];
    for (const folderPath of result.filePaths) {
      entries.push(...(await collectSupportedFiles(folderPath)));
    }

    return entries;
  });

  ipcMain.handle("dialog:choose-output-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
      title: "Choose Markdown Output Folder",
    });

    return result.canceled ? undefined : result.filePaths[0];
  });

  ipcMain.handle("files:convert", async (_event, paths: unknown, outputFolder: unknown) => {
    const filePaths = Array.isArray(paths)
      ? Array.from(new Set(paths.filter((filePath): filePath is string => typeof filePath === "string" && isSupportedFileName(filePath))))
      : [];
    const results = new Map<string, DesktopConversionResult>();
    const outputPaths = await resolveOutputPaths(filePaths, typeof outputFolder === "string" ? outputFolder : undefined);

    await runLimited(filePaths, 4, async (filePath) => {
      const name = path.basename(filePath);
      try {
        const outputPath = await convertFileToMarkdown(filePath, outputPaths.get(filePath));
        results.set(filePath, {
          sourcePath: filePath,
          name,
          status: "done",
          outputPath,
        });
      } catch (error) {
        results.set(filePath, {
          sourcePath: filePath,
          name,
          status: "error",
          error: getErrorMessage(error),
        });
      }
    });

    return filePaths.map((filePath) => results.get(filePath)).filter(Boolean);
  });

  ipcMain.handle("text:convert", (_event, input: unknown) => convertTextToMarkdown(typeof input === "string" ? input : ""));

  ipcMain.handle("markdown:save", async (_event, defaultName: unknown, markdown: unknown) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: typeof defaultName === "string" ? defaultName : "converted.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await fs.writeFile(result.filePath, typeof markdown === "string" ? markdown : "", "utf-8");
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle("clipboard:write", (_event, text: unknown) => {
    clipboard.writeText(typeof text === "string" ? text : "");
  });

  ipcMain.handle("app:check-for-update", () => checkForUpdate());

  ipcMain.handle("shell:open-external", async (_event, url: unknown) => {
    if (typeof url !== "string" || !isTrustedExternalUrl(url)) {
      return;
    }

    await shell.openExternal(url);
  });

  ipcMain.handle("window:is-maximized", () => Boolean(mainWindow?.isMaximized()));
  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:toggle-maximize", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on("window:close", () => exitApp());

  ipcMain.on("window:zoom-delta", (_event, delta: unknown) => {
    if (!mainWindow || typeof delta !== "number") return;
    const current = mainWindow.webContents.getZoomLevel();
    const next = Math.max(-5, Math.min(5, current + delta));
    mainWindow.webContents.setZoomLevel(next);
  });
}

async function entriesFromPaths(filePaths: string[]): Promise<DesktopFileEntry[]> {
  const entries: DesktopFileEntry[] = [];

  for (const filePath of filePaths) {
    if (!isSupportedFileName(filePath)) {
      continue;
    }

    entries.push(await entryFromPath(filePath));
  }

  return entries;
}

async function collectSupportedFiles(rootPath: string): Promise<DesktopFileEntry[]> {
  const entries: DesktopFileEntry[] = [];

  async function walk(directoryPath: string) {
    let dirents;

    try {
      dirents = await fs.readdir(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const dirent of dirents) {
      const currentPath = path.join(directoryPath, dirent.name);
      if (dirent.isSymbolicLink()) {
        continue;
      }

      if (dirent.isDirectory()) {
        await walk(currentPath);
      } else if (dirent.isFile() && isSupportedFileName(currentPath)) {
        entries.push(await entryFromPath(currentPath));
      }
    }
  }

  await walk(rootPath);
  return entries;
}

async function entryFromPath(filePath: string): Promise<DesktopFileEntry> {
  const stat = await fs.stat(filePath).catch(() => undefined);
  return {
    path: filePath,
    name: path.basename(filePath),
    size: stat?.size,
  };
}

async function resolveOutputPaths(filePaths: string[], outputFolder: string | undefined): Promise<Map<string, string>> {
  const outputPaths = new Map<string, string>();
  if (!outputFolder) {
    return outputPaths;
  }

  const stat = await fs.stat(outputFolder).catch(() => undefined);
  if (!stat?.isDirectory()) {
    return outputPaths;
  }

  const usedNames = new Map<string, number>();
  for (const filePath of filePaths) {
    const outputName = uniqueOutputName(markdownOutputName(path.basename(filePath)), usedNames);
    outputPaths.set(filePath, path.join(outputFolder, outputName));
  }

  return outputPaths;
}

function uniqueOutputName(fileName: string, usedNames: Map<string, number>): string {
  const normalized = fileName.toLowerCase();
  const count = usedNames.get(normalized) || 0;
  usedNames.set(normalized, count + 1);

  if (count === 0) {
    return fileName;
  }

  const extension = path.extname(fileName);
  const basename = path.basename(fileName, extension);
  return `${basename}-${count + 1}${extension}`;
}

async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
      }
    }),
  );
}

function notifyMaximizedChange(isMaximized: boolean) {
  mainWindow?.webContents.send("window:maximized-change", isMaximized);
}

function exitApp() {
  if (isExiting) {
    return;
  }

  isExiting = true;
  app.exit(0);
  setTimeout(() => process.exit(0), 250).unref();
}

async function checkForUpdate(): Promise<DesktopUpdateInfo> {
  const currentVersion = app.getVersion();

  try {
    const response = await fetch(latestReleaseApiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "markdown-them-desktop",
      },
    });

    if (!response.ok) {
      return { currentVersion, updateAvailable: false };
    }

    const release = (await response.json()) as GitHubRelease;
    const latestVersion = normalizeVersion(release.tag_name);
    const updateAvailable = Boolean(latestVersion && isNewerVersion(latestVersion, currentVersion));
    const downloadUrl = updateAvailable ? findDownloadUrl(release, latestVersion) : undefined;

    return {
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url || latestReleaseUrl,
      downloadUrl,
      updateAvailable,
    };
  } catch {
    return { currentVersion, updateAvailable: false };
  }
}

function findDownloadUrl(release: GitHubRelease, version: string | undefined): string | undefined {
  if (!version) {
    return latestReleaseUrl;
  }

  const expectedAssetName = desktopAssetName(version);
  const asset = release.assets?.find((item) => item.name === expectedAssetName);
  return asset?.browser_download_url || release.html_url || latestReleaseUrl;
}

function desktopAssetName(version: string): string {
  if (process.platform === "win32") {
    return `markdown-them-${version}-windows-portable.exe`;
  }

  if (process.platform === "darwin") {
    return `markdown-them-${version}-mac.dmg`;
  }

  return `markdown-them-${version}-linux.AppImage`;
}

function normalizeVersion(version: string | undefined): string | undefined {
  return version?.trim().replace(/^v/i, "");
}

function isNewerVersion(latestVersion: string, currentVersion: string): boolean {
  const latest = versionParts(latestVersion);
  const current = versionParts(currentVersion);
  const length = Math.max(latest.length, current.length);

  for (let index = 0; index < length; index += 1) {
    const latestPart = latest[index] || 0;
    const currentPart = current[index] || 0;
    if (latestPart > currentPart) {
      return true;
    }
    if (latestPart < currentPart) {
      return false;
    }
  }

  return false;
}

function versionParts(version: string): number[] {
  return version
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function isTrustedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const normalized = url.toString();
    return (
      trustedExactExternalUrls.has(normalized) ||
      normalized.startsWith(`${repoUrl}/releases/`)
    );
  } catch {
    return false;
  }
}

function toggleDevTools(window: BrowserWindow | undefined) {
  if (!window) {
    return;
  }

  if (window.webContents.isDevToolsOpened()) {
    window.webContents.closeDevTools();
  } else {
    window.webContents.openDevTools({ mode: "detach" });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
