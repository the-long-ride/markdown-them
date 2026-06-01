import { useEffect, useState } from "react";
import { themeMetaColor, themeStorageKey } from "../app-constants";
import type { ThemeMode } from "../app-types";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", themeMetaColor[theme]);

    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Ignore storage restrictions in privacy-focused browser contexts.
    }
  }, [theme]);

  return { setTheme, theme };
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }
  } catch {
    // Fall through to the system preference when localStorage is unavailable.
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
