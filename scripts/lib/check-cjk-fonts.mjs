import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cjkFamilies, cjkWeights, localeCharacters } from './cjk-characters.mjs';
import { woff2Characters } from './woff2-cmap.mjs';

export function assertCjkCoverage(required, available, description) {
  const missing = [...required].filter((point) => !available.has(point));
  assert.equal(
    missing.length,
    0,
    `${description}: missing CJK glyphs ${missing.map((point) => `U+${point.toString(16).toUpperCase()}`).join(', ')}; regenerate CJK subsets`,
  );
}

export async function checkCjkFonts(root) {
  const locales = await localeCharacters(root);
  const fonts = path.join(root, 'assets/fonts');
  for (const [code, family] of Object.entries(cjkFamilies)) {
    const css = await readFile(path.join(fonts, `cjk-${code}.css`), 'utf8');
    for (const weight of cjkWeights) {
      const file = `noto-sans-${code === 'zh' ? 'sc' : code === 'ja' ? 'jp' : 'kr'}-cjk-${weight}.woff2`;
      const font = woff2Characters(await readFile(path.join(fonts, file)));
      assertCjkCoverage(locales[code], font, `${code}/${weight}`);
      assert.deepEqual(
        [...font].sort((a, b) => a - b),
        locales[code],
        `${file}: unused characters`,
      );
      const face = [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].find(([block]) =>
        block.includes(`url(./${file})`),
      )?.[0];
      assert.ok(face?.includes(`font-family: '${family}'`), `${file}: missing font-face`);
      assert.ok(face.includes(`font-weight: ${weight};`), `${file}: wrong weight`);
      const declared = new Set();
      const ranges = face.match(/unicode-range:([^;]+);/)?.[1] ?? '';
      for (const [, first, last] of ranges.matchAll(/U\+([\dA-F]+)(?:-([\dA-F]+))?/gi)) {
        for (let point = parseInt(first, 16); point <= parseInt(last ?? first, 16); point++)
          declared.add(point);
      }
      assert.deepEqual(
        [...declared].sort((a, b) => a - b),
        locales[code],
        `${file}: wrong unicode-range`,
      );
    }
  }
  return locales;
}
