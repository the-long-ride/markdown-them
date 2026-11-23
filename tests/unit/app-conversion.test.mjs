import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import JSZip from 'jszip';
import {
  generateDocx,
  generateOdt,
  generatePdf,
  generatePptx,
  generateRtf,
  generateXlsx,
} from '../e2e/fixtures/fixture-generator.mjs';

const require = createRequire(import.meta.url);
const {
  convertBrowserFile,
  convertBufferToMarkdown,
  convertFilesParallel,
} = require('../../out/app/browser-converter.js');
const bytes = (value) => new TextEncoder().encode(value);

test('browser converter dispatches real buffers and leaves the source name intact', async () => {
  const cases = [
    ['input.htm', bytes('<h2>Document HTML</h2>'), '## Document HTML'],
    ['input.MDX', bytes('# Existing Markdown'), '# Existing Markdown'],
    ['input.xlsx', await generateXlsx(), '| Column A | Column B |'],
    ['renamed.xlm', await generateXlsx(), '| Data 1 | Data 2 |'],
    ['input.pptx', await generatePptx(), 'Slide 1 Title'],
    ['input.odt', await generateOdt(), 'OpenDocument Heading'],
    ['input.rtf', generateRtf(), 'Rich Text Document'],
    ['input.docx', await generateDocx(), 'Document Heading'],
    ['renamed.doc', await generateDocx(), 'Document Heading'],
    ['input.pdf', generatePdf(), 'Sample PDF Heading'],
    [
      'sample.doc',
      await readFile(new URL('../fixtures/legacy/SampleDoc.doc', import.meta.url)),
      'I am a test document',
    ],
    [
      'sample.xls',
      await readFile(new URL('../fixtures/legacy/SampleSS.xls', import.meta.url)),
      'Test spreadsheet',
    ],
  ];
  for (const [name, data, expected] of cases) {
    assert.ok((await convertBufferToMarkdown(name, data)).includes(expected), name);
  }
  assert.equal(await convertBufferToMarkdown('empty.txt', new Uint8Array()), '');
  await assert.rejects(convertBufferToMarkdown('empty.pdf', new Uint8Array()), /zero bytes/);
  await assert.rejects(convertBufferToMarkdown('README', bytes('data')), /unknown/);
  await assert.rejects(convertBufferToMarkdown('invalid.rtf', bytes('data')), /rtf signature/);
  assert.deepEqual(await convertBrowserFile(new File(['# Heading'], 'Original.md')), {
    fileName: 'Original.md',
    markdown: '# Heading',
    outputName: 'Original_converted.md',
  });
});

test('specialized office parser errors still give the generic parser a chance', async (t) => {
  const parser = require('officeparser');
  const calls = [];
  t.mock.method(parser, 'parseOffice', async (_bytes, config) => {
    calls.push(config);
    return { content: [{ type: 'text', text: 'Recovered' }] };
  });
  t.mock.method(parser, 'terminateOcr', async () => {
    throw new Error('Already terminated');
  });
  globalThis.window = { location: { href: 'https://example.test/app/index.html' } };
  t.after(() => delete globalThis.window);
  for (const ext of ['xlsx', 'pptx', 'odt', 'odp', 'ods']) {
    assert.equal(await convertBufferToMarkdown(`invalid.${ext}`, bytes('not a zip')), 'Recovered');
    assert.equal(calls.at(-1).fileType, ext);
  }
  assert.deepEqual(calls[0], {
    extractAttachments: false,
    includeRawContent: false,
    ocr: false,
    allowRemoteAssets: false,
    pdfCMapUrl: 'https://example.test/app/assets/cmaps/',
    pdfDecoderUrl: 'https://example.test/app/assets/wasm/',
    outputErrorToConsole: false,
    fileType: 'xlsx',
    pdfWorkerSrc: 'https://example.test/app/assets/pdf.worker.min.mjs',
  });
  window.location.href = 'about:blank';
  const empty = new JSZip();
  empty.file(
    'content.xml',
    '<?xml version="1.0"?><document-content><body><text/></body></document-content>',
  );
  assert.equal(
    await convertBufferToMarkdown('empty.odt', await empty.generateAsync({ type: 'uint8array' })),
    'Recovered',
  );
  assert.equal(await convertBufferToMarkdown('empty.rtf', bytes('{\\rtf1}')), 'Recovered');
  assert.equal(calls.at(-1).pdfCMapUrl, '');
  assert.ok(!('pdfWorkerSrc' in calls.at(-1)));
});

const task = (id, payload) => ({ id, name: `${id}.txt`, status: 'queued', ...payload });

test('queue handles every source type and preserves order on conversion failure', async () => {
  const updates = [];
  const tasks = [
    task('buffer', { buffer: bytes('Buffer text') }),
    task('file', { file: new File(['File text'], 'file.txt') }),
    task('string', { convert: async () => 'String result' }),
    task('object', {
      convert: async () => ({
        markdown: 'Custom output',
        outputPath: '/saved/result.md',
        outputName: 'result.md',
      }),
    }),
    task('existing', {
      outputPath: '/saved/existing.md',
      outputName: 'existing.md',
      convert: async () => ({ markdown: 'Existing output' }),
    }),
    task('empty'),
    task('failure', {
      convert: async () => {
        throw 'Plain error';
      },
    }),
  ];
  const results = await convertFilesParallel(tasks, 0, ({ id, status }) =>
    updates.push([id, status]),
  );
  assert.deepEqual(
    results.map(({ id }) => id),
    tasks.map(({ id }) => id),
  );
  assert.deepEqual(
    results.slice(0, 5).map(({ markdown }) => markdown),
    ['Buffer text', 'File text', 'String result', 'Custom output', 'Existing output'],
  );
  assert.deepEqual(
    results.slice(3, 5).map(({ outputPath, outputName }) => [outputPath, outputName]),
    [
      ['/saved/result.md', 'result.md'],
      ['/saved/existing.md', 'existing.md'],
    ],
  );
  assert.equal(results[5].error, 'No file content or converter provided for empty.txt');
  assert.equal(results[6].error, 'Plain error');
  assert.deepEqual(
    updates.filter(([id]) => id === 'failure'),
    [
      ['failure', 'running'],
      ['failure', 'error'],
    ],
  );
  assert.deepEqual(await convertFilesParallel([]), []);
});

test('queue stops starting work on abort without losing in-flight results', async () => {
  const aborted = AbortSignal.abort();
  const states = [];
  const waiting = task('waiting', { convert: async () => assert.fail('Aborted conversion ran') });
  const [canceled] = await convertFilesParallel(
    [waiting],
    undefined,
    ({ status }) => states.push(status),
    aborted,
  );
  assert.equal(canceled.error, 'Canceled');
  assert.deepEqual(states, ['error']);
  const controller = new AbortController();
  const results = await convertFilesParallel(
    [
      task('active', {
        convert: async () => {
          controller.abort();
          return 'Finished';
        },
      }),
      waiting,
    ],
    1,
    undefined,
    controller.signal,
  );
  assert.deepEqual(
    results.map(({ status }) => status),
    ['done', 'error'],
  );
  assert.equal(results[1].error, 'Canceled');
});
