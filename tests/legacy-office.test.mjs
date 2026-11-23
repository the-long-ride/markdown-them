import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const fixtures = path.join(root, 'tests', 'fixtures', 'legacy');
const bundleDir = path.join(root, '.test-dist', 'legacy-office');
const require = createRequire(import.meta.url);
const { generateMarkdown } = require('../out/core/converters.js');

const cases = {
  'SampleDoc.doc': ['I am a test document', 'This is page 1', 'It’s Arial Black in 16 point'],
  'simple-table.doc': [
    'created using Word 97 – SR2',
    '| Cell 1,1 | Cell 1,2 | Cell 1,3 |\n| --- | --- | --- |\n| Cell 2,1 | Cell 2,2 | Cell 2,3 |',
    'This text is below the table.',
  ],
  'Bug47286.doc': [
    'АНКЕТА ДЛЯ ПОЛУЧЕНИЯ',
    '| Фамилия<br>Surname |  |',
    '[provisastpet@mfa.gov.cy](mailto:provisastpet@mfa.gov.cy)',
  ],
  'SampleSS.xls': [
    '## First Sheet\n\n| Test spreadsheet |  |\n| --- | --- |\n| 2nd row | 2nd row 2nd column |',
    '## Sheet Number 2',
    '| cb=1 | cb=10 | cb=2 | cb=sum |\n| 1 | 10 | 2 | 13 |',
  ],
};

let convertBufferToMarkdown;
const realFetch = globalThis.fetch;

before(async () => {
  globalThis.fetch = () => {
    throw new Error('legacy conversion must not use the network');
  };
  await mkdir(bundleDir, { recursive: true });
  const outfile = path.join(bundleDir, 'browser-converter.mjs');
  await build({
    entryPoints: [path.join(root, 'src', 'app', 'browser-converter.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    external: ['officeparser'],
    outfile,
    logLevel: 'silent',
  });
  ({ convertBufferToMarkdown } = await import(pathToFileURL(outfile).href));
});

after(async () => {
  globalThis.fetch = realFetch;
  await rm(bundleDir, { recursive: true, force: true });
});

for (const [name, expected] of Object.entries(cases)) {
  test(`converts real OLE binary ${name} in core and browser converters`, async () => {
    const file = path.join(fixtures, name);
    const data = await readFile(file);
    assert.deepEqual([...data.subarray(0, 4)], [0xd0, 0xcf, 0x11, 0xe0]);

    const markdown = await generateMarkdown(file);
    for (const fragment of expected) assert.ok(markdown.includes(fragment), fragment);
    assert.doesNotMatch(markdown, /word\/document\.xml|xl\/workbook\.xml/);

    const browserMarkdown = await convertBufferToMarkdown(name, new Uint8Array(data));
    assert.equal(browserMarkdown, markdown);
  });
}

test('preserves DOC hyperlink targets with unmatched parentheses', async () => {
  const data = await readFile(path.join(fixtures, 'Bug47286.doc'));
  const from = Buffer.from('mailto:provisastpet@mfa.gov.cy', 'utf16le');
  const target = 'https://example.test/folder(xy';
  const to = Buffer.from(target, 'utf16le');
  assert.equal(to.length, from.length);
  for (
    let offset = data.indexOf(from);
    offset >= 0;
    offset = data.indexOf(from, offset + to.length)
  ) {
    to.copy(data, offset);
  }

  const markdown = await convertBufferToMarkdown('parenthesized-link.doc', data);
  assert.ok(markdown.includes(`[provisastpet@mfa.gov.cy](<${target}>)`));
});

test('rejects an OLE file without a Word stream with a DOC error', async () => {
  const data = await readFile(path.join(fixtures, 'SampleSS.xls'));
  await assert.rejects(
    convertBufferToMarkdown('workbook.doc', new Uint8Array(data)),
    /missing WordDocument stream/,
  );
});

test('decodes codepage text in a BIFF5 workbook in the browser converter', async () => {
  const XLSX = require('xlsx');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['QQQQQQ']]), 'Sheet1');
  const data = Buffer.from(XLSX.write(workbook, { bookType: 'biff5', type: 'buffer' }));
  Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]).copy(data, data.indexOf('QQQQQQ'));
  const codepage = data.indexOf(Buffer.from([0x42, 0x00, 0x02, 0x00]));
  data.writeUInt16LE(1251, codepage + 4);

  const markdown = await convertBufferToMarkdown('cp1251.xls', new Uint8Array(data));
  assert.match(markdown, /\| Привет \|/);
});
