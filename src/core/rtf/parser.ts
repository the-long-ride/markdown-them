import { INITIAL_STATE, SKIP_DESTINATIONS, type RtfRun, type RtfState } from './types';
import { plainText } from './formatter';

export function decodeRtfBytes(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return new TextDecoder('windows-1252').decode(bytes);
}

export function symbolForControl(symbol: string | undefined): string {
  switch (symbol) {
    case '~':
      return ' ';
    case '_':
      return '-';
    case '-':
      return '';
    case ':':
      return '';
    case '|':
      return '';
    default:
      return symbol || '';
  }
}

export function applyControlWord(
  word: string,
  parameter: number | undefined,
  state: RtfState,
  pushText: (text: string) => void,
  flushParagraph: () => void,
): number {
  if (SKIP_DESTINATIONS.has(word)) {
    state.skip = true;
    return 0;
  }

  switch (word) {
    case 'b':
      state.bold = parameter !== 0;
      break;
    case 'bullet':
      pushText('•');
      break;
    case 'emdash':
      pushText('-');
      break;
    case 'endash':
      pushText('-');
      break;
    case 'fs':
      state.fontSize = parameter || 0;
      break;
    case 'i':
      state.italic = parameter !== 0;
      break;
    case 'line':
      pushText('\n');
      break;
    case 'par':
      flushParagraph();
      break;
    case 'plain':
      state.bold = false;
      state.italic = false;
      state.strikethrough = false;
      state.fontSize = 0;
      break;
    case 'strike':
      state.strikethrough = parameter !== 0;
      break;
    case 'tab':
      pushText('\t');
      break;
    case 'uc':
      state.unicodeFallbackChars = typeof parameter === 'number' ? Math.max(0, parameter) : 1;
      break;
    case 'u':
      if (parameter !== undefined) {
        const codePoint = parameter < 0 ? parameter + 65536 : parameter;
        if (codePoint >= 0 && codePoint <= 65535) {
          pushText(String.fromCharCode(codePoint));
        }
        return state.unicodeFallbackChars;
      }
      break;
    default:
      break;
  }

  return 0;
}

export function readRtfParagraphs(rtf: string): RtfRun[][] {
  const paragraphs: RtfRun[][] = [];
  const stack: RtfState[] = [];
  let state: RtfState = { ...INITIAL_STATE };
  let runs: RtfRun[] = [];
  let skipFallbackChars = 0;

  function pushText(text: string): void {
    if (!text || state.skip) {
      return;
    }

    const previous = runs[runs.length - 1];
    if (
      previous &&
      previous.bold === state.bold &&
      previous.italic === state.italic &&
      previous.strikethrough === state.strikethrough &&
      previous.fontSize === state.fontSize
    ) {
      previous.text += text;
      return;
    }

    runs.push({
      bold: state.bold,
      italic: state.italic,
      strikethrough: state.strikethrough,
      fontSize: state.fontSize,
      text,
    });
  }

  function flushParagraph(): void {
    const text = plainText(runs).trim();
    if (text) {
      paragraphs.push(runs);
    }

    runs = [];
  }

  for (let index = 0; index < rtf.length; index += 1) {
    const char = rtf[index];

    if (skipFallbackChars > 0) {
      skipFallbackChars -= 1;
      // A \'xx hex escape is a single fallback character
      if (char === '\\' && rtf[index + 1] === "'") {
        index += 3;
      }
      continue;
    }

    if (char === '{') {
      stack.push({ ...state });
      continue;
    }

    if (char === '}') {
      state = stack.pop() || { ...INITIAL_STATE };
      continue;
    }

    if (char !== '\\') {
      pushText(char);
      continue;
    }

    const next = rtf[index + 1];
    if (next === '\\' || next === '{' || next === '}') {
      pushText(next);
      index += 1;
      continue;
    }

    if (next === "'") {
      const hex = rtf.slice(index + 2, index + 4);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        const byte = parseInt(hex, 16);
        if (byte >= 0x80 && byte <= 0x9f) {
          pushText(new TextDecoder('windows-1252').decode(new Uint8Array([byte])));
        } else {
          pushText(String.fromCharCode(byte));
        }
        index += 3;
      }
      continue;
    }

    if (!next || !/[a-zA-Z*~_\-:|{}]/.test(next)) {
      index += 1;
      pushText(symbolForControl(next));
      continue;
    }

    const controlStart = index + 1;
    let cursor = controlStart;

    if (rtf[cursor] === '*') {
      state.skip = true;
      index = cursor;
      continue;
    }

    while (cursor < rtf.length && /[a-zA-Z]/.test(rtf[cursor])) {
      cursor += 1;
    }

    const word = rtf.slice(controlStart, cursor);
    let parameter = '';
    if (rtf[cursor] === '-') {
      parameter += '-';
      cursor += 1;
    }

    while (cursor < rtf.length && /\d/.test(rtf[cursor])) {
      parameter += rtf[cursor];
      cursor += 1;
    }

    const hasParameter = parameter !== '';
    const numericValue = hasParameter ? Number(parameter) : undefined;

    if (rtf[cursor] === ' ') {
      cursor += 1;
    }

    index = cursor - 1;
    const unicodeFallback = applyControlWord(word, numericValue, state, pushText, flushParagraph);
    if (unicodeFallback > 0) {
      skipFallbackChars = unicodeFallback;
    }
  }

  flushParagraph();
  if (stack.length > 0) {
    throw new Error('Invalid RTF document: unclosed bracket or corrupted syntax');
  }
  return paragraphs;
}
