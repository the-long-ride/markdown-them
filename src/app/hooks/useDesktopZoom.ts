import { useCallback, useEffect, useRef, useState } from 'react';
import { desktopApi, resolveDesktopApi } from '../app-constants';

const STORAGE_KEY = 'markdown-them-zoom-factor';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const KEY_STEP = 0.1;
const WHEEL_STEP = 0.05;
const DEFAULT_ZOOM = 1.0;

function roundZoom(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, roundZoom(value)));
}

function getStoredZoom(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_ZOOM;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!Number.isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
        return clampZoom(parsed);
      }
    }
  } catch {
    // Ignore localStorage access errors
  }
  return DEFAULT_ZOOM;
}

export function useDesktopZoom(isDesktop: boolean) {
  const [zoomFactor, setZoomFactorState] = useState<number>(getStoredZoom);
  const zoomRef = useRef<number>(zoomFactor);

  useEffect(() => {
    zoomRef.current = zoomFactor;
  }, [zoomFactor]);

  const applyZoom = useCallback(
    (factor: number) => {
      const clamped = clampZoom(factor);
      zoomRef.current = clamped;
      setZoomFactorState(clamped);

      try {
        window.localStorage.setItem(STORAGE_KEY, String(clamped));
      } catch {
        // Ignore localStorage quota errors
      }

      const api = desktopApi || resolveDesktopApi();
      if (isDesktop && api?.window?.setZoom) {
        api.window.setZoom(clamped).catch(() => {
          (document.documentElement.style as unknown as Record<string, string>).zoom =
            String(clamped);
          (document.body.style as unknown as Record<string, string>).zoom = String(clamped);
        });
      } else {
        (document.documentElement.style as unknown as Record<string, string>).zoom =
          String(clamped);
        (document.body.style as unknown as Record<string, string>).zoom = String(clamped);
      }
    },
    [isDesktop],
  );

  // Apply stored zoom on mount
  useEffect(() => {
    const initial = getStoredZoom();
    applyZoom(initial);
  }, [applyZoom]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      // Check for Zoom In: Ctrl + = or Ctrl + + or NumpadAdd
      if (
        event.key === '=' ||
        event.key === '+' ||
        event.code === 'Equal' ||
        event.code === 'NumpadAdd' ||
        event.keyCode === 187 ||
        event.keyCode === 107
      ) {
        event.preventDefault();
        event.stopPropagation();
        applyZoom(zoomRef.current + KEY_STEP);
        return;
      }

      // Check for Zoom Out: Ctrl + - or Ctrl + _ or NumpadSubtract
      if (
        event.key === '-' ||
        event.key === '_' ||
        event.code === 'Minus' ||
        event.code === 'NumpadSubtract' ||
        event.keyCode === 189 ||
        event.keyCode === 109
      ) {
        event.preventDefault();
        event.stopPropagation();
        applyZoom(zoomRef.current - KEY_STEP);
        return;
      }

      // Check for Reset Zoom: Ctrl + 0 or Numpad0
      if (
        event.key === '0' ||
        event.code === 'Digit0' ||
        event.code === 'Numpad0' ||
        event.keyCode === 48 ||
        event.keyCode === 96 ||
        event.which === 48 ||
        event.which === 96
      ) {
        event.preventDefault();
        event.stopPropagation();
        applyZoom(DEFAULT_ZOOM);
        return;
      }
    }

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();
      if (event.deltaY < 0) {
        // Scrolling up -> zoom in
        applyZoom(zoomRef.current + WHEEL_STEP);
      } else if (event.deltaY > 0) {
        // Scrolling down -> zoom out
        applyZoom(zoomRef.current - WHEEL_STEP);
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    // passive: false is required to allow event.preventDefault() on wheel
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('wheel', handleWheel);
    };
  }, [applyZoom]);

  return {
    zoomFactor,
    setZoomFactor: applyZoom,
    resetZoom: useCallback(() => applyZoom(DEFAULT_ZOOM), [applyZoom]),
  };
}
