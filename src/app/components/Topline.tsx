import { Clipboard, Files, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { appVersion, changelogUrl, desktopApi } from '../app-constants';
import type { Mode, ThemeMode } from '../app-types';
import type { DesktopUpdateInfo } from '../desktop-api';
import { useLanguage } from '../context/LanguageContext';
import { ExternalLink } from './ExternalLink';
import { LanguageSelector } from './LanguageSelector';
import { Tooltip } from './Tooltip';
import { VariantsMenu } from './VariantsMenu';

interface ToplineProps {
  isDesktop: boolean;
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  theme: ThemeMode;
}

export function Topline({ isDesktop, mode, setMode, setTheme, theme }: ToplineProps) {
  const { t } = useLanguage();
  const [displayVersion, setDisplayVersion] = useState(appVersion);
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateInfo | undefined>();

  useEffect(() => {
    if (!isDesktop || !desktopApi) {
      return;
    }

    let canceled = false;
    desktopApi
      .checkForUpdate()
      .then((info) => {
        if (canceled) {
          return;
        }

        setDisplayVersion(info.currentVersion || appVersion);
        setUpdateInfo(info);
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, [isDesktop]);

  const versionText = displayVersion.startsWith('v') ? displayVersion : `v${displayVersion}`;

  return (
    <section className="topline">
      <div className={`brand-lockup ${isDesktop ? 'is-desktop' : ''}`}>
        {!isDesktop ? (
          <div className="brand-identity">
            <img src="assets/markdown-them-logo.png" alt="" />
            <div className="brand-title-row">
              <h1>{t('appName')}</h1>
              <Tooltip content="View changelog on GitHub">
                <ExternalLink className="app-version" href={changelogUrl}>
                  {versionText}
                </ExternalLink>
              </Tooltip>
              {updateInfo?.updateAvailable && updateInfo.downloadUrl ? (
                <ExternalLink className="update-link" href={updateInfo.downloadUrl}>
                  {t('updateAvailable')}
                </ExternalLink>
              ) : null}
            </div>
          </div>
        ) : null}
        <p className="brand-tagline">
          {t('tagline')
            .split('\n')
            .map((line, index) => {
              if (index === 0 && line.toLowerCase().includes('markdown')) {
                const regex = /(markdown)/i;
                const parts = line.split(regex);
                return (
                  <span key={index}>
                    {parts.map((part, i) =>
                      part.toLowerCase() === 'markdown' ? (
                        <span key={i} className="amber-highlight">
                          {part}
                        </span>
                      ) : (
                        part
                      ),
                    )}
                  </span>
                );
              }
              return (
                <span key={index} className={index > 0 ? 'brand-tagline-note' : undefined}>
                  {line}
                </span>
              );
            })}
        </p>
      </div>

      {!isDesktop ? (
        <div className="topline-actions">
          <VariantsMenu isDesktop={isDesktop} />
          <div className="segmented" role="tablist" aria-label="Mode">
            <div className={`segmented-indicator ${mode}`} />
            <Tooltip content={t('files')}>
              <button
                className={mode === 'files' ? 'active' : ''}
                onClick={() => setMode('files')}
                type="button"
                aria-selected={mode === 'files'}
              >
                <Files size={16} />
                <span>{t('files')}</span>
              </button>
            </Tooltip>
            <Tooltip content={t('text')}>
              <button
                className={mode === 'text' ? 'active' : ''}
                onClick={() => setMode('text')}
                type="button"
                aria-selected={mode === 'text'}
              >
                <Clipboard size={16} />
                <span>{t('text')}</span>
              </button>
            </Tooltip>
          </div>
          <div className="topline-end-actions">
            <LanguageSelector />
            <Tooltip
              content={
                theme === 'dark'
                  ? t('useLightMode') || 'Use light mode'
                  : t('useDarkMode') || 'Use dark mode'
              }
            >
              <button
                aria-label={
                  theme === 'dark'
                    ? t('useLightMode') || 'Use light mode'
                    : t('useDarkMode') || 'Use dark mode'
                }
                className="icon-button theme-toggle"
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                type="button"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </Tooltip>
          </div>
        </div>
      ) : null}
    </section>
  );
}
