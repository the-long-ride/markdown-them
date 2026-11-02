export interface RtfState {
  bold: boolean;
  italic: boolean;
  skip: boolean;
  strikethrough: boolean;
  fontSize: number;
  unicodeFallbackChars: number;
}

export interface RtfRun extends Omit<RtfState, 'skip' | 'unicodeFallbackChars'> {
  text: string;
}

export const INITIAL_STATE: RtfState = {
  bold: false,
  italic: false,
  skip: false,
  strikethrough: false,
  fontSize: 0,
  unicodeFallbackChars: 1,
};

export const SKIP_DESTINATIONS = new Set([
  'annotation',
  'colortbl',
  'datastore',
  'filetbl',
  'fonttbl',
  'footer',
  'footerf',
  'footerl',
  'footerr',
  'footnote',
  'header',
  'headerf',
  'headerl',
  'headerr',
  'info',
  'nonshppict',
  'object',
  'pict',
  'stylesheet',
  'xmlnstbl',
]);
