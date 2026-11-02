if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

if (
  typeof (globalThis as any).navigator === 'undefined' ||
  !(globalThis as any).navigator.platform ||
  !(globalThis as any).navigator.userAgent
) {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      platform: (globalThis as any).navigator?.platform || 'Node.js',
      userAgent: (globalThis as any).navigator?.userAgent || 'Node.js',
    },
    writable: true,
    configurable: true,
  });
}

// Hide Worker from pdfjs-dist before it initializes so it does not require workerSrc.
const originalWorker = (globalThis as any).Worker;
(globalThis as any).Worker = undefined;

export function restoreWorker() {
  (globalThis as any).Worker = originalWorker;
}
