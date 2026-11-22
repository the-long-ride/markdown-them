import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assertCjkCoverage, checkCjkFonts } from '../scripts/lib/check-cjk-fonts.mjs';
import { cjkCharacters, localeCharacters } from '../scripts/lib/cjk-characters.mjs';
import { woff2Characters } from '../scripts/lib/woff2-cmap.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('every CJK locale/menu glyph exists in every shipped weight and CSS range', async () => {
  const locales = await checkCjkFonts(root);
  for (const [code, label] of Object.entries({ zh: '中文', ja: '日本語', ko: '한국어' })) {
    assert.ok(locales[code].length > 200);
    for (const point of cjkCharacters(label)) assert.ok(locales[code].includes(point));
  }
  const fonts = path.join(root, 'assets/fonts');
  const cjk = (await readdir(fonts)).filter((file) => file.includes('cjk'));
  let bytes = 0;
  for (const file of cjk) bytes += (await stat(path.join(fonts, file))).size;
  assert.ok(bytes < 750_000, `CJK assets grew to ${bytes} bytes`);
  assert.equal(cjk.filter((file) => file.endsWith('.woff2')).length, 15);
  const entry = await readFile(path.join(fonts, 'fonts.css'), 'utf8');
  assert.match(entry, /@import '\.\/cjk.css'/);
  const imports = await readFile(path.join(fonts, 'cjk.css'), 'utf8');
  for (const code of Object.keys(locales)) assert.ok(imports.includes(`cjk-${code}.css`));
  const menu = await readFile(path.join(root, 'src/app/components/LanguageSelector.tsx'), 'utf8');
  assert.match(menu, /lang=\{lang.code\}/);
  const styles = await readFile(path.join(root, 'src/app/styles/controls.css'), 'utf8');
  for (const [code, family] of Object.entries({ zh: 'SC', ja: 'JP', ko: 'KR' })) {
    assert.ok(styles.includes(`button[lang='${code}'] {\n  font-family: 'Noto Sans ${family}'`));
  }
});

test('coverage gate rejects a new escaped CJK locale character until fonts are regenerated', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'cjk-coverage-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  await cp(path.join(root, 'src/app/context'), path.join(fixture, 'src/app/context'), {
    recursive: true,
  });
  await cp(path.join(root, 'assets/fonts'), path.join(fixture, 'assets/fonts'), {
    recursive: true,
  });
  await appendFile(
    path.join(fixture, 'src/app/context/translations/zh.ts'),
    "\nconst newLabel = '\\u{20000}';\n",
  );
  const locales = await localeCharacters(fixture);
  assert.ok(locales.zh.includes(0x20000));
  await assert.rejects(checkCjkFonts(fixture), /missing CJK glyphs U\+20000/);
});

test('character extraction handles empty/Latin text, all CJK scripts, and supplementary Han', () => {
  assert.deepEqual(cjkCharacters(''), new Set());
  assert.deepEqual(cjkCharacters('English Tiếng Việt'), new Set());
  const text = '中あアー・한。！𠀀';
  assert.deepEqual(
    cjkCharacters(text),
    new Set([...text].map((character) => character.codePointAt(0))),
  );
  assert.doesNotThrow(() => assertCjkCoverage([], new Set(), 'empty locale'));
  assert.throws(
    () => assertCjkCoverage([0x4e2d], new Set(), 'fixture'),
    /missing CJK glyphs U\+4E2D/,
  );
  assert.throws(() => woff2Characters(Buffer.from('not a font')), /Expected a WOFF2 font/);
});
