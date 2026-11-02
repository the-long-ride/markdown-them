import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DragDropPayload, MarkdownThemDesktopApi } from './desktop-api';

/**
 * Detects whether the current execution context is inside a Tauri v2 desktop webview.
 */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(
    (window as any).isTauri ||
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__,
  );
}

/**
 * Normalizes binary data returned from Tauri IPC (which can be number[] in JSON IPC
 * or Uint8Array/ArrayBuffer in binary IPC) into a standard Uint8Array buffer.
 */
export function toUint8Array(data: Uint8Array | number[] | ArrayBuffer): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  throw new Error(`Unexpected binary data format: ${typeof data}`);
}

/**
 * Internal invoke helper with fallback to window.__TAURI_INTERNALS__.invoke
 */
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.invoke) {
    return (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
  }
  return invoke<T>(cmd, args);
}

/**
 * Internal listen helper with fallback to window.__TAURI_LISTEN__ if provided by test harnesses
 */
export function tauriListen<T>(
  event: string,
  handler: (event: { payload: T }) => void,
): Promise<() => void> | (() => void) {
  if (typeof window !== 'undefined' && typeof (window as any).__TAURI_LISTEN__ === 'function') {
    return (window as any).__TAURI_LISTEN__(event, handler);
  }
  return listen<T>(event, handler);
}

/**
 * Safely registers an event listener handling both synchronous and asynchronous unlisten handles.
 */
export function registerListener<T>(
  event: string,
  handler: (event: { payload: T }) => void,
): () => void {
  let unlisten: (() => void) | undefined;
  let disposed = false;

  const res = tauriListen<T>(event, handler);
  if (typeof res === 'function') {
    unlisten = res;
  } else if (res && typeof (res as Promise<() => void>).then === 'function') {
    (res as Promise<() => void>)
      .then((fn) => {
        if (disposed) {
          if (typeof fn === 'function') {
            fn();
          }
        } else {
          unlisten = fn;
        }
      })
      .catch(() => undefined);
  }

  return () => {
    disposed = true;
    if (typeof unlisten === 'function') {
      unlisten();
    }
  };
}

/**
 * Creates window control methods bound to Tauri window IPC commands.
 */
export function createWindowControls(): MarkdownThemDesktopApi['window'] {
  return {
    minimize(): void {
      tauriInvoke('window_minimize').catch(() => undefined);
    },

    toggleMaximize(): void {
      tauriInvoke('window_toggle_maximize').catch(() => undefined);
    },

    close(): void {
      tauriInvoke('window_close').catch(() => undefined);
    },

    async isMaximized(): Promise<boolean> {
      return await tauriInvoke<boolean>('window_is_maximized');
    },

    startDragging(): void {
      tauriInvoke('window_start_dragging').catch(() => undefined);
    },

    async setZoom(factor: number): Promise<void> {
      await tauriInvoke('window_set_zoom', { factor });
    },

    onMaximizedChange(callback: (isMaximized: boolean) => void): () => void {
      return registerListener<boolean>('window:maximized-change', (event) => {
        callback(Boolean(event.payload));
      });
    },
  };
}

/**
 * Creates a drag-and-drop event listener subscription across Tauri drag-drop events.
 */
export function createDragDropListener(callback: (payload: DragDropPayload) => void): () => void {
  const unlistenDrop = registerListener<
    { paths?: string[]; position?: { x: number; y: number } } | string[]
  >('tauri://drag-drop', (event) => {
    const raw = event.payload;
    const paths = Array.isArray(raw) ? raw : Array.isArray(raw?.paths) ? raw.paths : [];
    callback({
      type: 'drop',
      paths,
      position: !Array.isArray(raw) ? raw?.position : undefined,
    });
  });

  const unlistenEnter = registerListener<
    { paths?: string[]; position?: { x: number; y: number } } | string[]
  >('tauri://drag-enter', (event) => {
    const raw = event.payload;
    const paths = Array.isArray(raw) ? raw : Array.isArray(raw?.paths) ? raw.paths : [];
    callback({
      type: 'enter',
      paths,
      position: !Array.isArray(raw) ? raw?.position : undefined,
    });
  });

  const unlistenLeave = registerListener<unknown>('tauri://drag-leave', () => {
    callback({ type: 'leave' });
  });

  const unlistenOver = registerListener<{ position?: { x: number; y: number } }>(
    'tauri://drag-over',
    (event) => {
      callback({
        type: 'over',
        position: event.payload?.position,
      });
    },
  );

  return () => {
    unlistenDrop();
    unlistenEnter();
    unlistenLeave();
    unlistenOver();
  };
}
