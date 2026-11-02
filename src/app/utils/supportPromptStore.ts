export const SUPPORT_PROMPT_STORAGE_KEY = 'markdown-them-support-prompt-v1';
export const CONVERSION_PROMPT_INTERVAL = 20;

export interface SupportPromptState {
  conversionCount: number;
  lastPromptedCount: number;
  neverShowAgain: boolean;
}

export function getDefaultSupportPromptState(): SupportPromptState {
  return {
    conversionCount: 0,
    lastPromptedCount: 0,
    neverShowAgain: false,
  };
}

export function loadSupportPromptState(): SupportPromptState {
  if (typeof localStorage === 'undefined') {
    return getDefaultSupportPromptState();
  }
  try {
    const raw = localStorage.getItem(SUPPORT_PROMPT_STORAGE_KEY);
    if (!raw) return getDefaultSupportPromptState();
    const parsed = JSON.parse(raw);
    const count =
      typeof parsed?.conversionCount === 'number' && Number.isFinite(parsed.conversionCount)
        ? parsed.conversionCount
        : parsed?.hasConverted
          ? 1
          : 0;
    const lastPrompted =
      typeof parsed?.lastPromptedCount === 'number' && Number.isFinite(parsed.lastPromptedCount)
        ? parsed.lastPromptedCount
        : parsed?.promptShown
          ? 1
          : 0;

    return {
      conversionCount: count,
      lastPromptedCount: lastPrompted,
      neverShowAgain: Boolean(parsed?.neverShowAgain),
    };
  } catch {
    return getDefaultSupportPromptState();
  }
}

export function saveSupportPromptState(state: SupportPromptState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SUPPORT_PROMPT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordConversionAndCheckPrompt(): boolean {
  const state = loadSupportPromptState();
  const nextCount = (state.conversionCount || 0) + 1;
  state.conversionCount = nextCount;

  if (state.neverShowAgain) {
    saveSupportPromptState(state);
    return false;
  }

  // Show on the 1st conversion and every 20 conversions thereafter (20, 40, 60, ...)
  const shouldPrompt = nextCount === 1 || nextCount % CONVERSION_PROMPT_INTERVAL === 0;
  if (shouldPrompt) {
    state.lastPromptedCount = nextCount;
  }

  saveSupportPromptState(state);
  return shouldPrompt;
}

// Backward-compatible alias
export const recordFirstConversionAndPrompt = recordConversionAndCheckPrompt;

export function setSupportPromptNeverShowAgain(): void {
  const state = loadSupportPromptState();
  state.neverShowAgain = true;
  saveSupportPromptState(state);
}

if (typeof window !== 'undefined') {
  const win = window as any;
  win.__openSupportModal = () => {
    window.dispatchEvent(new CustomEvent('markdown-them-open-support-modal'));
  };
  win.__getSupportPromptState = () => loadSupportPromptState();
  win.__resetSupportPromptState = () => {
    try {
      localStorage.removeItem(SUPPORT_PROMPT_STORAGE_KEY);
    } catch {}
  };
}
