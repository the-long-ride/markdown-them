import { Clipboard, Download, Files, Maximize2, Minus, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import {
  appVersion,
  changelogUrl,
  desktopApi,
  desktopDownloadUrl,
  resolveDesktopApi,
} from '../app-constants';
import type { Mode, ThemeMode } from '../app-types';
import type { DesktopUpdateInfo } from '../desktop-api';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { Tooltip } from './Tooltip';

interface TitlebarProps {
  mode?: Mode;
  setMode?: Dispatch<SetStateAction<Mode>> | ((mode: Mode) => void);
  theme?: ThemeMode;
  setTheme?: Dispatch<SetStateAction<ThemeMode>> | ((theme: ThemeMode) => void);
}

export function Titlebar({ mode, setMode, theme, setTheme }: TitlebarProps) {
  const { t } = useLanguage();
  const [isMaximized, setIsMaximized] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateInfo | undefined>();
  const api = desktopApi || resolveDesktopApi();

  useEffect(() => {
    if (!api) {
      return;
    }

    api.window
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => undefined);
    const unlisten = api.window.onMaximizedChange(setIsMaximized);
    api
      .checkForUpdate?.()
      .then(setUpdateInfo)
      .catch(() => undefined);
    return unlisten;
  }, [api]);

  const handleMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button,input,select,textarea,a,[data-no-window-drag]')) return;
    if (event.detail === 2) {
      api?.window.toggleMaximize();
      return;
    }
    api?.window.startDragging?.();
  };

  const handleDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button,input,select,textarea,a,[data-no-window-drag]')) return;
    api?.window.toggleMaximize();
  };

  const handleVersionClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (api) {
      api.openExternal(changelogUrl).catch(() => undefined);
    } else if (typeof window !== 'undefined') {
      window.open(changelogUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!api) {
    return null;
  }

  const versionTag = appVersion.startsWith('v') ? appVersion : `v${appVersion}`;

  return (
    <div
      className="titlebar"
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="titlebar-brand" data-tauri-drag-region>
        <img
          src="assets/markdown-them-logo.png"
          alt=""
          className="titlebar-logo"
          data-tauri-drag-region
          draggable={false}
        />
        <span className="titlebar-title" data-tauri-drag-region>
          Markdown Them
        </span>
        <Tooltip content="View changelog on GitHub" position="bottom">
          <a
            href={changelogUrl}
            className="titlebar-version-link"
            data-no-window-drag
            onClick={handleVersionClick}
          >
            {versionTag}
          </a>
        </Tooltip>
      </div>

      <div className="titlebar-spacer" data-tauri-drag-region />

      {mode && setMode && theme && setTheme ? (
        <div className="titlebar-actions" data-no-window-drag>
          {updateInfo?.updateAvailable ? (
            <Tooltip
              content={
                updateInfo.latestVersion
                  ? `Update v${updateInfo.latestVersion} available. Click to download.`
                  : 'Download latest update on GitHub'
              }
              position="bottom"
            >
              <a
                href={updateInfo.downloadUrl || desktopDownloadUrl}
                className="titlebar-download-btn"
                data-no-window-drag
                onClick={(e) => {
                  e.preventDefault();
                  api
                    .openExternal(updateInfo.downloadUrl || desktopDownloadUrl)
                    .catch(() => undefined);
                }}
              >
                <Download size={13} />
                <span>
                  {updateInfo.latestVersion
                    ? `v${updateInfo.latestVersion}`
                    : t('download') || 'Download'}
                </span>
              </a>
            </Tooltip>
          ) : null}

          <div className="segmented titlebar-segmented" role="tablist" aria-label="Mode">
            <div className={`segmented-indicator ${mode}`} />
            <Tooltip content={t('files')} position="bottom">
              <button
                className={mode === 'files' ? 'active' : ''}
                onClick={() => setMode('files')}
                type="button"
                aria-selected={mode === 'files'}
              >
                <Files size={13} />
                <span>{t('files')}</span>
              </button>
            </Tooltip>
            <Tooltip content={t('text')} position="bottom">
              <button
                className={mode === 'text' ? 'active' : ''}
                onClick={() => setMode('text')}
                type="button"
                aria-selected={mode === 'text'}
              >
                <Clipboard size={13} />
                <span>{t('text')}</span>
              </button>
            </Tooltip>
          </div>

          <LanguageSelector />

          <Tooltip
            content={
              theme === 'dark'
                ? t('useLightMode') || 'Use light mode'
                : t('useDarkMode') || 'Use dark mode'
            }
            position="bottom"
          >
            <button
              aria-label={
                theme === 'dark'
                  ? t('useLightMode') || 'Use light mode'
                  : t('useDarkMode') || 'Use dark mode'
              }
              className="icon-button theme-toggle titlebar-icon-btn"
              onClick={() =>
                (setTheme as (update: (prev: ThemeMode) => ThemeMode) => void)(
                  (current: ThemeMode) => (current === 'dark' ? 'light' : 'dark'),
                )
              }
              type="button"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </Tooltip>
        </div>
      ) : null}

      <div className="window-controls" data-no-window-drag>
        <Tooltip content="Minimize" position="bottom">
          <button type="button" aria-label="Minimize" onClick={() => api.window.minimize()}>
            <Minus size={14} />
          </button>
        </Tooltip>
        <Tooltip content={isMaximized ? 'Restore' : 'Maximize'} position="bottom">
          <button
            type="button"
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            onClick={() => api.window.toggleMaximize()}
          >
            {isMaximized ? (
              <svg
                viewBox="0 0 24 24"
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="7" y="5" width="12" height="12" rx="1" />
                <path d="M5 8H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" />
              </svg>
            ) : (
              <Maximize2 size={13} />
            )}
          </button>
        </Tooltip>
        <Tooltip content="Close" position="bottom">
          <button
            className="close-control"
            type="button"
            aria-label="Close"
            onClick={() => api.window.close()}
          >
            <X size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
