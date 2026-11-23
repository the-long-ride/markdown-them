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

test('rejects an OLE file without a Word stream with a DOC error', async () => {
  const data = await readFile(path.join(fixtures, 'SampleSS.xls'));
  await assert.rejects(
    convertBufferToMarkdown('workbook.doc', new Uint8Array(data)),
    /missing WordDocument stream/,
  );
});
