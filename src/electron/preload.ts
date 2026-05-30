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
