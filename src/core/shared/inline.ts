export interface InlineMarks {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}

export function wrapMarkdown(value: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match || !match[2]) {
    return value;
  }

  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

export function applyInlineMarks(text: string, marks: InlineMarks): string {
  let markdown = text;
  if (marks.bold) {
    markdown = wrapMarkdown(markdown, '**');
  }
  if (marks.italic) {
    markdown = wrapMarkdown(markdown, '*');
  }
  if (marks.strikethrough) {
    markdown = wrapMarkdown(markdown, '~~');
  }

  return markdown;
}

export function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

export function markdownHeadingLevel(markdown: string): number | undefined {
  const match = markdown.match(/^(#{1,6})\s+/);
  return match ? match[1].length : undefined;
}
