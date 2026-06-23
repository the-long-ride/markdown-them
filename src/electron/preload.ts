import { contextBridge, ipcRenderer } from "electron";
import type { MarkdownThemDesktopApi } from "../app/desktop-api";

const api: MarkdownThemDesktopApi = {
  isDesktop: true,
  chooseFiles: () => ipcRenderer.invoke("dialog:choose-files"),
  chooseFolders: () => ipcRenderer.invoke("dialog:choose-folders"),
  chooseOutputFolder: () => ipcRenderer.invoke("dialog:choose-output-folder"),
  convertFiles: (paths, outputFolder) => ipcRenderer.invoke("files:convert", paths, outputFolder),
  convertText: (input) => ipcRenderer.invoke("text:convert", input),
  saveMarkdown: (defaultName, markdown) => ipcRenderer.invoke("markdown:save", defaultName, markdown),
  copyText: (text) => ipcRenderer.invoke("clipboard:write", text),
  checkForUpdate: () => ipcRenderer.invoke("app:check-for-update"),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
    close: () => ipcRenderer.send("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    onMaximizedChange: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized);
      ipcRenderer.on("window:maximized-change", listener);
      return () => ipcRenderer.removeListener("window:maximized-change", listener);
    },
  },
};

contextBridge.exposeInMainWorld("markdownThemDesktop", api);

// Ctrl+Wheel → zoom in/out via main process.
// Throttled to avoid flooding IPC with fast scroll events.
let zoomThrottleTimer: ReturnType<typeof setTimeout> | null = null;

window.addEventListener(
  "wheel",
  (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();

    if (zoomThrottleTimer !== null) return;
    zoomThrottleTimer = setTimeout(() => {
      zoomThrottleTimer = null;
    }, 50);

    // Positive deltaY = scroll down = zoom out; negative = zoom in.
    const delta = event.deltaY > 0 ? -0.5 : 0.5;
    ipcRenderer.send("window:zoom-delta", delta);
  },
  { passive: false }
);
