import { SUPPORTED_FILE_EXTENSIONS } from '../shared/formats';
import type { ThemeMode } from './app-types';
import { getDesktopApi } from './tauri-api';
import { appVersion } from './version';

export { appVersion };

export function resolveDesktopApi() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.markdownThemDesktop || getDesktopApi();
}

export const desktopApi = resolveDesktopApi();
export const fileAccept = Array.from(new Set(SUPPORTED_FILE_EXTENSIONS)).join(',');

export const authorWebsiteUrl = 'https://the-long-ride.github.io/';
export const profileUrl = 'https://github.com/the-long-ride';
export const repoUrl = 'https://github.com/the-long-ride/markdown-them';
export const changelogUrl = `${repoUrl}/blob/main/CHANGELOG.md`;
export const desktopDownloadUrl = `${repoUrl}/releases/latest`;
export const npmPackageUrl = 'https://www.npmjs.com/package/@the-long-ride/markdown-them';
export const openVsxUrl = 'https://open-vsx.org/extension/the-long-ride/markdown-them';
export const vscodeMarketplaceUrl =
  'https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them';
export const licenseUrl = 'https://github.com/the-long-ride/markdown-them/blob/main/LICENSE';

export const webappUrl = 'https://the-long-ride.github.io/markdown-them';
export const privacyUrl = `${webappUrl}/#/privacy`;
export const termsUrl = `${webappUrl}/#/terms`;

export const themeStorageKey = 'markdown-them-theme';
export const themeMetaColor: Record<ThemeMode, string> = {
  dark: '#141413',
  light: '#E9E5DD',
};
