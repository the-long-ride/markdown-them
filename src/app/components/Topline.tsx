import { Clipboard, Files, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { appVersion, desktopApi } from "../app-constants";
import type { Mode, ThemeMode } from "../app-types";
import type { DesktopUpdateInfo } from "../desktop-api";
import { useLanguage } from "../context/LanguageContext";
import { ExternalLink } from "./ExternalLink";
import { LanguageSelector } from "./LanguageSelector";
import { VariantsMenu } from "./VariantsMenu";

interface ToplineProps {
  isDesktop: boolean;
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  theme: ThemeMode;
}

export function Topline({
  isDesktop,
  mode,
  setMode,
  setTheme,
  theme,
}: ToplineProps) {
  const { t } = useLanguage();
  const [displayVersion, setDisplayVersion] = useState(appVersion);
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateInfo | undefined>();

  useEffect(() => {
    if (!isDesktop || !desktopApi) {
      return;
    }

    let canceled = false;
    desktopApi.checkForUpdate()
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

  const versionText = displayVersion.startsWith("v") ? displayVersion : `v${displayVersion}`;

  return (
    <section className="topline">
      <div className="brand-lockup">
        <img src="assets/markdown-them-logo.png" alt="" />
        <div>
          <div className="brand-title-row">
            <h1>{t("appName")}</h1>
            <span className="app-version">{versionText}</span>
            {isDesktop && updateInfo?.updateAvailable && updateInfo.downloadUrl ? (
              <ExternalLink className="update-link" href={updateInfo.downloadUrl}>
                {t("updateAvailable")}
              </ExternalLink>
            ) : null}
          </div>
          <p>{t("tagline")}</p>
        </div>
      </div>

      <div className="topline-actions">
        <VariantsMenu isDesktop={isDesktop} />
        <div className="segmented" role="tablist" aria-label="Mode">
          <div className={`segmented-indicator ${mode}`} />
          <button
            className={mode === "files" ? "active" : ""}
            onClick={() => setMode("files")}
            type="button"
          >
            <Files size={16} />
            <span>{t("files")}</span>
          </button>
          <button
            className={mode === "text" ? "active" : ""}
            onClick={() => setMode("text")}
            type="button"
          >
            <Clipboard size={16} />
            <span>{t("text")}</span>
          </button>
        </div>
        <LanguageSelector />
        <button
          className="icon-button theme-toggle"
          type="button"
          title={theme === "dark" ? t("useLightMode") || "Use light mode" : t("useDarkMode") || "Use dark mode"}
          aria-label={theme === "dark" ? t("useLightMode") || "Use light mode" : t("useDarkMode") || "Use dark mode"}
          onClick={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </section>
  );
}
