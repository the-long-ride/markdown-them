import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { desktopApi, fileAccept, profileUrl, repoUrl } from './app-constants';
import type { DesktopFileEntry } from './desktop-api';
import type { Mode } from './app-types';
import { AppFooter } from './components/AppFooter';
import { FilesMode } from './components/FilesMode';
import { TextMode } from './components/TextMode';
import { Titlebar } from './components/Titlebar';
import { Topline } from './components/Topline';
import { TrustStrip } from './components/TrustStrip';
import { LegalPage } from './components/LegalPage';
import { SupportPromptModal } from './components/SupportPromptModal';
import { useIntroAnimation, useModeAnimation } from './hooks/useAppAnimations';
import { useDesktopZoom } from './hooks/useDesktopZoom';
import { useFileConverter } from './hooks/useFileConverter';
import { useTextConverter } from './hooks/useTextConverter';
import { useTheme } from './hooks/useTheme';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import {
  recordConversionAndCheckPrompt,
  setSupportPromptNeverShowAgain,
} from './utils/supportPromptStore';
import { isAppDebugging } from './utils/debug';

function translateNotice(notice: string, t: (key: string) => string): string {
  if (notice === 'Copied') {
    return t('copiedNotice');
  }
  if (notice.startsWith('Saved ')) {
    const filePath = notice.replace('Saved ', '');
    return `${t('savedNotice')} ${filePath}`;
  }
  return notice;
}

function AppContent() {
  const [mode, setMode] = useState<Mode>('files');
  const [notice, setNotice] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const { setTheme, theme } = useTheme();

  const handleConversionSuccess = useCallback(() => {
    if (recordConversionAndCheckPrompt()) {
      setTimeout(() => {
        setIsSupportModalOpen(true);
      }, 500);
    }
  }, []);

  const text = useTextConverter(setNotice, handleConversionSuccess);
  const files = useFileConverter(setNotice, handleConversionSuccess);
  const workspaceRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const modeAnimationReadyRef = useRef(false);
  const isDesktop = Boolean(
    desktopApi || (typeof window !== 'undefined' && Boolean(window.markdownThemDesktop)),
  );
  const { t } = useLanguage();

  useDesktopZoom(isDesktop);

  useEffect(() => {
    let canceled = false;
    isAppDebugging().then((debugging) => {
      if (!canceled && debugging) {
        setIsSupportModalOpen(true);
      }
    });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const handleOpenSupport = () => {
      setIsSupportModalOpen(true);
    };

    window.addEventListener('markdown-them-open-support-modal', handleOpenSupport);
    return () => window.removeEventListener('markdown-them-open-support-modal', handleOpenSupport);
  }, []);

  function handleCloseSupportModal(neverShowAgain: boolean) {
    if (neverShowAgain) {
      setSupportPromptNeverShowAgain();
    }
    setIsSupportModalOpen(false);
  }

  function handleStarSupport(neverShowAgain: boolean) {
    if (neverShowAgain) {
      setSupportPromptNeverShowAgain();
    }
    setIsSupportModalOpen(false);
    if (desktopApi) {
      desktopApi.openExternal(repoUrl).catch(() => undefined);
    } else {
      window.open(repoUrl, '_blank', 'noreferrer,noopener');
    }
  }

  function handleDonateSupport(neverShowAgain: boolean) {
    if (neverShowAgain) {
      setSupportPromptNeverShowAgain();
    }
    setIsSupportModalOpen(false);
    if (desktopApi) {
      desktopApi.openExternal(profileUrl).catch(() => undefined);
    } else {
      window.open(profileUrl, '_blank', 'noreferrer,noopener');
    }
  }

  useIntroAnimation(workspaceRef);
  useModeAnimation(contentRef, workspaceRef, modeAnimationReadyRef, mode);

  const [currentView, setCurrentView] = useState<'app' | 'privacy' | 'terms'>(() => {
    if (typeof window !== 'undefined' && !desktopApi) {
      const hash = window.location.hash;
      if (hash === '#/privacy') return 'privacy';
      if (hash === '#/terms') return 'terms';
    }
    return 'app';
  });

  const handleNavigateLegal = useCallback(
    (nextView: 'privacy' | 'terms') => {
      setCurrentView(nextView);
      if (!isDesktop && typeof window !== 'undefined') {
        window.location.hash = `#/${nextView}`;
      }
    },
    [isDesktop],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (currentView === 'privacy') {
      document.title = `${t('privacyPolicy')} - Markdown Them`;
    } else if (currentView === 'terms') {
      document.title = `${t('termsOfService')} - Markdown Them`;
    } else {
      document.title = 'Markdown Them - 100% Private Client-Side Document to Markdown Converter';
    }
  }, [currentView, t]);

  useEffect(() => {
    if (isDesktop) {
      return;
    }

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/privacy') {
        setCurrentView('privacy');
      } else if (hash === '#/terms') {
        setCurrentView('terms');
      } else {
        setCurrentView('app');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isDesktop]);

  // Prevent browser default behavior of navigating away when a file is dragged onto the window
  useEffect(() => {
    const preventDragDefaults = (e: globalThis.DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDragDefaults);
    window.addEventListener('drop', preventDragDefaults);
    return () => {
      window.removeEventListener('dragover', preventDragDefaults);
      window.removeEventListener('drop', preventDragDefaults);
    };
  }, []);

  // Listen to native desktop drag-and-drop events (Tauri v2)
  useEffect(() => {
    if (!desktopApi?.onDragDropEvent) {
      return;
    }

    const unlisten = desktopApi.onDragDropEvent((event) => {
      if (event.type === 'enter' || event.type === 'over') {
        setIsDragging(true);
      } else if (event.type === 'leave') {
        setIsDragging(false);
      } else if (event.type === 'drop') {
        setIsDragging(false);
        if (event.paths && event.paths.length > 0) {
          const entries: DesktopFileEntry[] = event.paths.map((p) => ({
            path: p,
            name: p.split(/[\\/]/).pop() || p,
          }));
          files.addDesktopEntries(entries);
        }
      }
    });

    return unlisten;
  }, [files.addDesktopEntries]);

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files || []);
    if (droppedFiles.length === 0) {
      return;
    }

    if (desktopApi) {
      const desktopEntries: DesktopFileEntry[] = [];
      const browserFiles: File[] = [];

      for (const file of droppedFiles) {
        const filePath = (file as any).path;
        if (filePath && typeof filePath === 'string') {
          desktopEntries.push({
            path: filePath,
            name: file.name || filePath.split(/[\\/]/).pop() || filePath,
            size: file.size,
          });
        } else {
          browserFiles.push(file);
        }
      }

      if (desktopEntries.length > 0) {
        files.addDesktopEntries(desktopEntries);
      }
      if (browserFiles.length > 0) {
        files.addBrowserFiles(browserFiles);
      }
    } else {
      files.addBrowserFiles(droppedFiles);
    }
  }

  return (
    <div className={`app-shell ${isDesktop ? 'desktop-shell' : ''}`}>
      {isDesktop ? (
        <Titlebar mode={mode} setMode={setMode} theme={theme} setTheme={setTheme} />
      ) : null}

      <main
        ref={workspaceRef}
        className={`workspace ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {currentView !== 'app' ? (
          <LegalPage
            view={currentView}
            onChangeView={handleNavigateLegal}
            onBack={() => {
              window.location.hash = '';
              setCurrentView('app');
            }}
            theme={theme}
            setTheme={setTheme}
            isDesktop={isDesktop}
          />
        ) : (
          <>
            <Topline
              isDesktop={isDesktop}
              mode={mode}
              setMode={setMode}
              setTheme={setTheme}
              theme={theme}
            />
            <TrustStrip isDesktop={isDesktop} />

            {mode === 'text' ? (
              <TextMode
                contentRef={contentRef}
                isDesktop={isDesktop}
                onClearInput={() => {
                  text.setTextInput('');
                  text.setTextOutput('');
                }}
                onClearOutput={() => text.setTextOutput('')}
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
                onRemoveFile={files.removeFileItem}
                onConvertFiles={files.handleConvertFiles}
                onDownloadAll={files.handleDownloadAll}
                onResetOutputFolder={files.resetOutputFolder}
                outputFolder={files.outputFolder}
                summary={files.summary}
              />
            )}

            <AppFooter onNavigate={setCurrentView} />
          </>
        )}

        {notice ? <div className="toast">{translateNotice(notice, t)}</div> : null}

        <SupportPromptModal
          isOpen={isSupportModalOpen}
          onClose={handleCloseSupportModal}
          onDonate={handleDonateSupport}
          onStar={handleStarSupport}
        />
      </main>
    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
