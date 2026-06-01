import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { BrowserConversionResult } from "../browser-converter";
import { convertBrowserFile } from "../browser-converter";
import type { DesktopFileEntry } from "../desktop-api";
import { markdownOutputName } from "../../shared/formats";
import { desktopApi } from "../app-constants";
import type { FileItem } from "../app-types";
import {
  createBrowserItem,
  createDesktopItem,
  downloadBlob,
  getErrorMessage,
  mergeFileItems,
  runLimited,
} from "../app-utils";

export function useFileConverter(setNotice: (notice: string) => void) {
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [outputFolder, setOutputFolder] = useState("");
  const [filesBusy, setFilesBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    const done = fileItems.filter((item) => item.status === "done").length;
    const failed = fileItems.filter((item) => item.status === "error").length;
    return { done, failed, total: fileItems.length };
  }, [fileItems]);

  async function handleChooseFiles() {
    setNotice("");

    if (desktopApi) {
      const entries = await desktopApi.chooseFiles();
      addDesktopEntries(entries);
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleChooseFolders() {
    if (!desktopApi) {
      return;
    }

    setNotice("");
    const entries = await desktopApi.chooseFolders();
    addDesktopEntries(entries);
  }

  async function handleChooseOutputFolder() {
    if (!desktopApi) {
      return;
    }

    const folderPath = await desktopApi.chooseOutputFolder();
    if (folderPath) {
      setOutputFolder(folderPath);
    }
  }

  function handleBrowserFileInput(event: ChangeEvent<HTMLInputElement>) {
    addBrowserFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }

  async function handleConvertFiles() {
    const queued = fileItems.filter((item) => item.status !== "running");
    if (queued.length === 0) {
      return;
    }

    setFilesBusy(true);
    setNotice("");
    setFileItems((items) => items.map((item) => ({ ...item, status: "queued", error: undefined })));

    try {
      if (desktopApi) {
        await convertDesktopFiles();
      } else {
        await convertBrowserFiles();
      }
    } finally {
      setFilesBusy(false);
    }
  }

  async function handleDownloadAll() {
    const completeItems = fileItems.filter((item) => item.status === "done" && item.markdown);
    if (completeItems.length === 0) {
      return;
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    for (const item of completeItems) {
      zip.file(item.outputName || markdownOutputName(item.name), item.markdown || "");
    }

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob("markdown-them.zip", blob);
  }

  function addDesktopEntries(entries: DesktopFileEntry[]) {
    if (entries.length === 0) {
      return;
    }

    setFileItems((items) => mergeFileItems(items, entries.map(createDesktopItem)));
  }

  function addBrowserFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setFileItems((items) => mergeFileItems(items, files.map(createBrowserItem)));
  }

  function applyBrowserResult(id: string, result: BrowserConversionResult) {
    updateFileItem(id, {
      status: "done",
      markdown: result.markdown,
      outputName: result.outputName,
      error: undefined,
    });
  }

  function clearFiles() {
    setFileItems([]);
  }

  function resetOutputFolder() {
    setOutputFolder("");
  }

  function updateFileItem(id: string, patch: Partial<FileItem>) {
    setFileItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function convertDesktopFiles() {
    if (!desktopApi) {
      return;
    }

    setFileItems((items) => items.map((item) => ({ ...item, status: "running" })));
    const results = await desktopApi.convertFiles(
      fileItems.map((item) => item.sourcePath).filter(Boolean) as string[],
      outputFolder || undefined,
    );

    setFileItems((items) =>
      items.map((item) => {
        const result = results.find((entry) => entry.sourcePath === item.sourcePath);
        if (!result) {
          return item;
        }

        return {
          ...item,
          status: result.status,
          outputPath: result.outputPath,
          outputName: result.outputPath ? result.outputPath.split(/[\\/]/).pop() : markdownOutputName(item.name),
          error: result.error,
        };
      }),
    );
  }

  async function convertBrowserFiles() {
    await runLimited(
      fileItems.filter((item) => item.file),
      3,
      async (item) => {
        updateFileItem(item.id, { status: "running", error: undefined });
        try {
          const result = await convertBrowserFile(item.file as File);
          applyBrowserResult(item.id, result);
        } catch (error) {
          updateFileItem(item.id, { status: "error", error: getErrorMessage(error) });
        }
      },
    );
  }

  return {
    addBrowserFiles,
    clearFiles,
    fileInputRef,
    fileItems,
    filesBusy,
    handleBrowserFileInput,
    handleChooseFiles,
    handleChooseFolders,
    handleChooseOutputFolder,
    handleConvertFiles,
    handleDownloadAll,
    outputFolder,
    resetOutputFolder,
    summary,
  };
}
