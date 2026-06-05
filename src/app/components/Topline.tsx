import { Clipboard, Files, Moon, Sun } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Mode, ThemeMode } from "../app-types";
import { useLanguage } from "../context/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";

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

  return (
    <section className="topline">
      <div className="brand-lockup">
        <img src="assets/markdown-them-logo.png" alt="" />
        <div>
          <h1>{t("appName")}</h1>
          <p>{t("tagline")}</p>
        </div>
      </div>

      <div className="topline-actions">
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
