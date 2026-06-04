interface RtfState {
  bold: boolean;
  italic: boolean;
  skip: boolean;
  strikethrough: boolean;
  fontSize: number;
}

interface RtfRun extends Omit<RtfState, "skip"> {
  text: string;
}

const INITIAL_STATE: RtfState = {
  bold: false,
  italic: false,
  skip: false,
  strikethrough: false,
  fontSize: 0,
};

const SKIP_DESTINATIONS = new Set([
  "annotation",
  "colortbl",
  "datastore",
  "filetbl",
  "fonttbl",
  "footer",
  "footerf",
  "footerl",
  "footerr",
  "footnote",
  "header",
  "headerf",
  "headerl",
  "headerr",
  "info",
  "nonshppict",
  "object",
  "pict",
  "stylesheet",
  "xmlnstbl",
]);

export function convertRtfToMarkdown(input: string | ArrayBuffer | Uint8Array): string {
  const rtf = typeof input === "string" ? input : decodeRtfBytes(input);
  const paragraphs = readRtfParagraphs(rtf);
  return paragraphs.map(formatParagraph).filter(Boolean).join("\n\n").trim();
}

function readRtfParagraphs(rtf: string): RtfRun[][] {
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
      continue;
    }

    if (char === "{") {
      stack.push({ ...state });
      continue;
    }

    if (char === "}") {
      state = stack.pop() || { ...INITIAL_STATE };
      continue;
    }

    if (char !== "\\") {
      pushText(char);
      continue;
    }

    const next = rtf[index + 1];
    if (next === "\\" || next === "{" || next === "}") {
      pushText(next);
      index += 1;
      continue;
    }

    if (next === "'") {
      const hex = rtf.slice(index + 2, index + 4);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        pushText(String.fromCharCode(parseInt(hex, 16)));
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

    if (rtf[cursor] === "*") {
      state.skip = true;
      index = cursor;
      continue;
    }

    while (cursor < rtf.length && /[a-zA-Z]/.test(rtf[cursor])) {
      cursor += 1;
    }

    const word = rtf.slice(controlStart, cursor);
    let parameter = "";
    if (rtf[cursor] === "-") {
      parameter += "-";
      cursor += 1;
    }

    while (cursor < rtf.length && /\d/.test(rtf[cursor])) {
      parameter += rtf[cursor];
      cursor += 1;
    }

    const hasParameter = parameter !== "";
    const numericValue = hasParameter ? Number(parameter) : undefined;

    if (rtf[cursor] === " ") {
      cursor += 1;
    }

    index = cursor - 1;
    const unicodeFallback = applyControlWord(word, numericValue, state, pushText, flushParagraph);
    if (unicodeFallback > 0) {
      skipFallbackChars = unicodeFallback;
    }
  }

  flushParagraph();
  return paragraphs;
}

function applyControlWord(
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
    case "b":
      state.bold = parameter !== 0;
      break;
    case "bullet":
      pushText("•");
      break;
    case "emdash":
      pushText("-");
      break;
    case "endash":
      pushText("-");
      break;
    case "fs":
      state.fontSize = parameter || 0;
      break;
    case "i":
      state.italic = parameter !== 0;
      break;
    case "line":
      pushText("\n");
      break;
    case "par":
      flushParagraph();
      break;
    case "plain":
      state.bold = false;
      state.italic = false;
      state.strikethrough = false;
      state.fontSize = 0;
      break;
    case "strike":
      state.strikethrough = parameter !== 0;
      break;
    case "tab":
      pushText("\t");
      break;
    case "u":
      if (parameter !== undefined) {
        pushText(String.fromCharCode(parameter < 0 ? parameter + 65536 : parameter));
        return 1;
      }
      break;
    default:
      break;
  }

  return 0;
}

function formatParagraph(runs: RtfRun[]): string {
  const text = plainText(runs).replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  const formatted = formatRuns(runs).replace(/[ \t]+\n/g, "\n").trim();
  const maxFontSize = runs.reduce((max, run) => Math.max(max, run.fontSize), 0);
  const hasLetters = /\p{L}/u.test(text);

  if (hasLetters && text.length <= 140) {
    if (maxFontSize >= 56) {
      return `# ${formatted}`;
    }
    if (maxFontSize >= 44) {
      return `## ${formatted}`;
    }
    if (maxFontSize >= 34 && boldRatio(runs) > 0.6) {
      return `### ${formatted}`;
    }
  }

  const bulletMatch = formatted.match(/^[•·]\s*(.+)$/);
  if (bulletMatch) {
    return `- ${bulletMatch[1].trim()}`;
  }

  return formatted;
}

function formatRuns(runs: RtfRun[]): string {
  return runs.map(formatRun).join("");
}

function formatRun(run: RtfRun): string {
  let markdown = run.text;
  if (run.bold) {
    markdown = wrapMarkdown(markdown, "**");
  }
  if (run.italic) {
    markdown = wrapMarkdown(markdown, "*");
  }
  if (run.strikethrough) {
    markdown = wrapMarkdown(markdown, "~~");
  }

  return markdown;
}

function plainText(runs: RtfRun[]): string {
  return runs.map((run) => run.text).join("");
}

function boldRatio(runs: RtfRun[]): number {
  const text = plainText(runs).trim();
  if (!text) {
    return 0;
  }

  const boldLength = runs.filter((run) => run.bold).reduce((sum, run) => sum + run.text.length, 0);
  return boldLength / text.length;
}

function wrapMarkdown(value: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match || !match[2]) {
    return value;
  }

  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

function symbolForControl(symbol: string | undefined): string {
  switch (symbol) {
    case "~":
      return " ";
    case "_":
      return "-";
    case "-":
      return "";
    case ":":
      return "";
    case "|":
      return "";
    default:
      return symbol || "";
  }
}

function decodeRtfBytes(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return new TextDecoder("windows-1252").decode(bytes);
}
