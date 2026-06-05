import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, session, shell } from "electron";
import * as fs from "fs/promises";
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

const isDevelopment = !app.isPackaged && process.env.NODE_ENV !== "production";
const documentFilters = [
  {
    name: "Documents",
    extensions: SUPPORTED_FILE_EXTENSIONS.map((extension) => extension.replace(".", "")),
  },
];
const trustedExternalUrls = new Set([
  "https://github.com/the-long-ride",
  "https://github.com/the-long-ride/markdown-them",
  "https://github.com/the-long-ride/markdown-them#markdown-them-variants",
  "https://github.com/the-long-ride/markdown-them/blob/main/LICENSE",
]);
const appId = "com.the-long-ride.markdown-them";

let mainWindow: BrowserWindow | undefined;

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
  if (process.platform !== "darwin") {
    app.quit();
  }
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

  mainWindow.on("maximize", () => notifyMaximizedChange(true));
  mainWindow.on("unmaximize", () => notifyMaximizedChange(false));

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === "i") {
      event.preventDefault();

      if (isDevelopment) {
        toggleDevTools(mainWindow);
      }
    }
  });

  if (isDevelopment) {
    const devPort = process.env.PORT || "5173";
    await mainWindow.loadURL(`http://127.0.0.1:${devPort}`);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "web", "index.html"));
  }
}

function getAppIconPath(): string {
  return path.join(__dirname, "web", "assets", "markdown-them-logo.png");
}

function setDockIcon() {
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(getAppIconPath());
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

  ipcMain.handle("shell:open-external", async (_event, url: unknown) => {
    if (typeof url !== "string" || !trustedExternalUrls.has(url)) {
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
  ipcMain.on("window:close", () => mainWindow?.close());
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
