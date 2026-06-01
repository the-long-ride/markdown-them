import { Clipboard, Files, Moon, Sun } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { Mode, ThemeMode } from "../app-types";

interface ToplineProps {
  isDesktop: boolean;
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  theme: ThemeMode;
}

export function Topline({ isDesktop, mode, setMode, setTheme, theme }: ToplineProps) {
  return (
    <section className="topline">
      <div className="brand-lockup">
        <img src="assets/markdown-them-logo.png" alt="" />
        <div>
          <h1>Markdown Them</h1>
          <p>{isDesktop ? "Desktop" : "Web"} local converter</p>
        </div>
      </div>

      <div className="topline-actions">
        <div className="segmented" role="tablist" aria-label="Mode">
          <button className={mode === "files" ? "active" : ""} onClick={() => setMode("files")} type="button">
            <Files size={16} />
            <span>Files</span>
          </button>
          <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")} type="button">
            <Clipboard size={16} />
            <span>Text</span>
          </button>
        </div>
        <button
          className="icon-button theme-toggle"
          type="button"
          title={theme === "dark" ? "Use light mode" : "Use dark mode"}
          aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </section>
  );
}
