import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { desktopApi, fileAccept } from "./app-constants";
import type { Mode } from "./app-types";
import { AppFooter } from "./components/AppFooter";
import { FilesMode } from "./components/FilesMode";
import { TextMode } from "./components/TextMode";
import { Titlebar } from "./components/Titlebar";
import { Topline } from "./components/Topline";
import { TrustStrip } from "./components/TrustStrip";
import { useIntroAnimation, useModeAnimation } from "./hooks/useAppAnimations";
import { useFileConverter } from "./hooks/useFileConverter";
import { useTextConverter } from "./hooks/useTextConverter";
import { useTheme } from "./hooks/useTheme";

export function App() {
  const [mode, setMode] = useState<Mode>("files");
  const [notice, setNotice] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const { setTheme, theme } = useTheme();
  const text = useTextConverter(setNotice);
  const files = useFileConverter(setNotice);
  const workspaceRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const modeAnimationReadyRef = useRef(false);
  const isDesktop = Boolean(desktopApi);

  useIntroAnimation(workspaceRef);
  useModeAnimation(contentRef, workspaceRef, modeAnimationReadyRef, mode);

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!desktopApi) {
      files.addBrowserFiles(Array.from(event.dataTransfer.files || []));
    }
  }

  return (
    <div className={`app-shell ${isDesktop ? "desktop-shell" : ""}`}>
      {isDesktop ? <Titlebar /> : null}

      <main
        ref={workspaceRef}
        className={`workspace ${isDragging ? "is-dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Topline isDesktop={isDesktop} mode={mode} setMode={setMode} setTheme={setTheme} theme={theme} />
        <TrustStrip isDesktop={isDesktop} />

        {mode === "text" ? (
          <TextMode
            contentRef={contentRef}
            isDesktop={isDesktop}
            onClearInput={() => text.setTextInput("")}
            onConvertText={text.handleConvertText}
            onCopyText={text.handleCopyText}
            onSaveText={text.handleSaveText}
            onTextInputChange={(event) => text.setTextInput(event.target.value)}
            onTextOutputChange={(event) => text.setTextOutput(event.target.value)}
            textBusy={text.textBusy}
            textInput={text.textInput}
            textOutput={text.textOutput}
          />
        ) : (
          <FilesMode
            contentRef={contentRef}
            fileAccept={fileAccept}
            fileInputRef={files.fileInputRef}
            fileItems={files.fileItems}
            filesBusy={files.filesBusy}
            isDesktop={isDesktop}
            onBrowserFileInput={files.handleBrowserFileInput}
            onChooseFiles={files.handleChooseFiles}
            onChooseFolders={files.handleChooseFolders}
            onChooseOutputFolder={files.handleChooseOutputFolder}
            onClearFiles={files.clearFiles}
            onConvertFiles={files.handleConvertFiles}
            onDownloadAll={files.handleDownloadAll}
            onResetOutputFolder={files.resetOutputFolder}
            outputFolder={files.outputFolder}
            summary={files.summary}
          />
        )}

        {!isDesktop ? <AppFooter /> : null}
        {notice ? <div className="toast">{notice}</div> : null}
      </main>
    </div>
  );
}
