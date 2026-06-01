import { useState } from "react";
import { convertTextToMarkdown } from "../browser-converter";
import { desktopApi } from "../app-constants";
import { copyToClipboard, downloadMarkdown, getErrorMessage } from "../app-utils";

export function useTextConverter(setNotice: (notice: string) => void) {
  const [textInput, setTextInput] = useState("");
  const [textOutput, setTextOutput] = useState("");
  const [textBusy, setTextBusy] = useState(false);

  async function handleConvertText() {
    setTextBusy(true);
    setNotice("");

    try {
      const markdown = desktopApi ? await desktopApi.convertText(textInput) : convertTextToMarkdown(textInput);
      setTextOutput(markdown);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setTextBusy(false);
    }
  }

  async function handleCopyText() {
    if (!textOutput) {
      return;
    }

    await copyToClipboard(textOutput);
    setNotice("Copied");
  }

  async function handleSaveText() {
    if (!textOutput) {
      return;
    }

    if (desktopApi) {
      const result = await desktopApi.saveMarkdown("input.md", textOutput);
      if (!result.canceled && result.filePath) {
        setNotice(`Saved ${result.filePath}`);
      }
      return;
    }

    downloadMarkdown("input.md", textOutput);
  }

  return {
    handleConvertText,
    handleCopyText,
    handleSaveText,
    setTextInput,
    setTextOutput,
    textBusy,
    textInput,
    textOutput,
  };
}
