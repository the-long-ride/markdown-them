import { SUPPORTED_FILE_EXTENSIONS } from "../shared/formats";
import type { ThemeMode } from "./app-types";

export const desktopApi = window.markdownThemDesktop;
export const fileAccept = [...SUPPORTED_FILE_EXTENSIONS, ".md", ".markdown", ".txt"].join(",");

export const profileUrl = "https://github.com/the-long-ride";
export const repoUrl = "https://github.com/the-long-ride/markdown-them";
export const desktopDownloadUrl = `${repoUrl}/releases/latest`;
export const npmPackageUrl = "https://www.npmjs.com/package/@the-long-ride/markdown-them";
export const licenseUrl = "https://github.com/the-long-ride/markdown-them/blob/main/LICENSE";

export const webappUrl = "https://markdown-them.com";
export const privacyUrl = `${webappUrl}/#/privacy`;
export const termsUrl = `${webappUrl}/#/terms`;

export const themeStorageKey = "markdown-them-theme";
export const themeMetaColor: Record<ThemeMode, string> = {
  dark: "#171817",
  light: "#f4f7f2",
};

