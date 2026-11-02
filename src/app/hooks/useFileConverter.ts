import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { desktopApi } from '../app-constants';
import type { FileItem } from '../app-types';
import { createBrowserItem, createDesktopItem, mergeFileItems } from '../app-utils';
import type { DesktopFileEntry } from '../desktop-api';
import { convertFilesParallel } from '../parallel-queue';
import { buildBrowserTasks, buildDesktopTasks, downloadFilesZip } from './file-converter-helpers';

export function useFileConverter(
  setNotice: (notice: string) => void,
  onConversionSuccess?: () => void,
) {
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [outputFolder, setOutputFolder] = useState('');
  const [filesBusy, setFilesBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const summary = useMemo(() => {
    const done = fileItems.filter((item) => item.status === 'done').length;
    const failed = fileItems.filter((item) => item.status === 'error').length;
    return { done, failed, total: fileItems.length };
  }, [fileItems]);

  const getActiveDesktopApi = () =>
    desktopApi || (typeof window !== 'undefined' ? window.markdownThemDesktop : undefined);

  async function handleChooseFiles() {
    setNotice('');

    const api = getActiveDesktopApi();
    if (api) {
      const entries = await api.chooseFiles();
      addDesktopEntries(entries);
      return;
    }

    fileInputRef.current?.click();
  }

  async function handleChooseFolders() {
    const api = getActiveDesktopApi();
    if (!api) {
      return;
    }

    setNotice('');
    const entries = await api.chooseFolders();
    addDesktopEntries(entries);
  }

  async function handleChooseOutputFolder() {
    const api = getActiveDesktopApi();
    if (!api) {
      return;
    }

    const folderPath = await api.chooseOutputFolder();
    if (folderPath) {
      setOutputFolder(folderPath);
    }
  }

  function handleBrowserFileInput(event: ChangeEvent<HTMLInputElement>) {
    addBrowserFiles(Array.from(event.target.files || []));
    event.target.value = '';
  }

  async function handleConvertFiles() {
    const queued = fileItems.filter((item) => item.status !== 'running');
    if (queued.length === 0) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setFilesBusy(true);
    setNotice('');
    setFileItems((items) => items.map((item) => ({ ...item, status: 'queued', error: undefined })));

    try {
      const api = getActiveDesktopApi();
      if (api) {
        await convertDesktopFiles(controller.signal);
      } else {
        await convertBrowserFiles(controller.signal);
      }
    } finally {
      abortControllerRef.current = null;
      setFilesBusy(false);
    }
  }

  function cancelConversion() {
    abortControllerRef.current?.abort();
  }

  async function handleDownloadAll() {
    await downloadFilesZip(fileItems);
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

  function clearFiles() {
    setFileItems([]);
  }

  function removeFileItem(id: string) {
    setFileItems((items) => items.filter((item) => item.id !== id));
  }

  function resetOutputFolder() {
    setOutputFolder('');
  }

  function updateFileItem(id: string, patch: Partial<FileItem>) {
    setFileItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function convertDesktopFiles(signal?: AbortSignal) {
    const api = getActiveDesktopApi();
    if (!api) {
      return;
    }

    const desktopItems = fileItems.filter(
      (item) => (item.sourcePath || item.file) && item.status !== 'done',
    );
    if (desktopItems.length === 0) {
      return;
    }

    const tasks = buildDesktopTasks(desktopItems, api, outputFolder, signal);

    const results = await convertFilesParallel(
      tasks,
      4,
      (updatedTask) => {
        updateFileItem(updatedTask.id, {
          status: updatedTask.status,
          markdown: updatedTask.markdown,
          outputPath: updatedTask.outputPath,
          outputName: updatedTask.outputName,
          error: updatedTask.error,
        });
      },
      signal,
    );

    const hasSuccess = results.some((entry) => entry.status === 'done');
    if (hasSuccess && !signal?.aborted) {
      onConversionSuccess?.();
    }
  }

  async function convertBrowserFiles(signal?: AbortSignal) {
    const browserItems = fileItems.filter((item) => item.file);
    if (browserItems.length === 0) {
      return;
    }

    const tasks = buildBrowserTasks(browserItems);

    const results = await convertFilesParallel(
      tasks,
      4,
      (updatedTask) => {
        updateFileItem(updatedTask.id, {
          status: updatedTask.status,
          markdown: updatedTask.markdown,
          outputName: updatedTask.outputName,
          outputPath: updatedTask.outputPath,
          error: updatedTask.error,
        });
      },
      signal,
    );

    const hasSuccess = results.some((entry) => entry.status === 'done');
    if (hasSuccess && !signal?.aborted) {
      onConversionSuccess?.();
    }
  }

  return {
    addBrowserFiles,
    addDesktopEntries,
    cancelConversion,
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
    removeFileItem,
    resetOutputFolder,
    summary,
  };
}
