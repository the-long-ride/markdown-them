const XML_NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&apos;': "'",
  '&gt;': '>',
  '&lt;': '<',
  '&quot;': '"',
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&bull;': '•',
};

export function decodeXmlEntities(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let current = text;
  for (let depth = 0; depth < 10; depth++) {
    const next = current
      .replace(
        /&(?:amp|apos|gt|lt|quot|nbsp|copy|reg|trade|mdash|ndash|hellip|bull);/g,
        (match) => {
          return XML_NAMED_ENTITIES[match] || match;
        },
      )
      .replace(/&#(\d+);/g, (_, code) => {
        const num = Number(code);
        if (Number.isFinite(num) && num >= 0 && num <= 0x10ffff) {
          try {
            return String.fromCodePoint(num);
          } catch {
            return '';
          }
        }
        return '';
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const num = parseInt(hex, 16);
        if (Number.isFinite(num) && num >= 0 && num <= 0x10ffff) {
          try {
            return String.fromCodePoint(num);
          } catch {
            return '';
          }
        }
        return '';
      });

    if (next === current) {
      break;
    }
    current = next;
  }

  return current;
}
