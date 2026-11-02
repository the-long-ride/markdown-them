import { desktopApi, resolveDesktopApi } from '../app-constants';

/**
 * Detects whether the web app or desktop app is running in debug/development mode.
 * - In web development: NODE_ENV === 'development', localhost dev server, or ?debug=true query flag.
 * - In desktop development: tauri dev server, or Rust binary compiled with debug_assertions (via app_is_debug).
 * - In production builds: returns false so debug behaviors are suppressed.
 */
export async function isAppDebugging(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. Explicit query or hash override (?debug=true, ?debug=1, #debug)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true' || params.get('debug') === '1') {
      return true;
    }
    if (window.location.hash.toLowerCase().includes('debug')) {
      return true;
    }
  } catch {
    // Ignore URL parse error
  }

  // 2. Global window debug flag
  if ((window as unknown as { __DEBUG__?: boolean }).__DEBUG__) {
    return true;
  }

  // 3. Bundler development mode (Vite / esbuild definition)
  try {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return true;
    }
  } catch {
    // Ignore process error
  }

  // 4. Localhost dev server (e.g., port 5173 from start-web.mjs or tauri dev)
  const host = window.location.hostname;
  if ((host === 'localhost' || host === '127.0.0.1') && window.location.port !== '') {
    return true;
  }

  // 5. Desktop app debug binary check via Rust cfg!(debug_assertions)
  const api = desktopApi || resolveDesktopApi();
  if (api && typeof api.isDebug === 'function') {
    try {
      const debugFromRust = await api.isDebug();
      if (debugFromRust) {
        return true;
      }
    } catch {
      // Ignore IPC error
    }
  }

  return false;
}
