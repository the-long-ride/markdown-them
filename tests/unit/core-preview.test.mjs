import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import core from '../../out/core/index.js';
import { generateHtml } from '../e2e/fixtures/fixture-generator.mjs';

test('core package exposes supported document types and consistent preview labels', () => {
  assert.equal(core.isKnownSupportedFilePath('book.xls'), true);
  assert.equal(core.isSupportedFilePath('book.xlsx'), false);
  assert.equal(core.isSupportedFilePath('book.xlsx', true), true);
  assert.equal(core.isSupportedFilePath('intro.MDX'), true);
  assert.equal(core.isSupportedFilePath('notes.TEXT'), true);
  assert.equal(core.isConvertibleDocumentFilePath('content.odt'), true);
  assert.equal(core.isConvertibleDocumentFilePath('photo.jpeg'), false);
  assert.equal(core.isExtraDocumentFilePath('presentation.pptx'), true);
  assert.equal(core.getFileTypeLabel('no_extension'), 'Document');
  assert.equal(core.getExtension(''), '');
  assert.equal(core.stripKnownExtension('no_extension'), 'no_extension');
  assert.equal(core.classifyExtension('report.MD'), 'markdown');
  assert.equal(core.classifyExtension('TXT'), 'text');
  assert.equal(core.classifyExtension('.pdf'), 'convertible');
  assert.equal(core.classifyExtension(''), 'unsupported');
  for (const extension of ['.DOC', '.xls', '.xlm']) {
    assert.equal(core.getConversionQuality(extension).qualityCode, 'legacy-best-effort');
  }
  assert.equal(core.getConversionQuality('').qualityCode, 'converted-preview');
  assert.equal(core.normalizePreviewMarkdown('# Existing', 'report.odt'), '# Existing');
  assert.match(
    core.normalizePreviewMarkdown('', 'line\nbreak.txt'),
    /# line break\n\n_No readable/,
  );
  assert.match(
    core.createFailureMarkdown('a.doc', 'plain error'),
    /this DOC file[\s\S]*plain error/,
  );
  assert.match(core.createFailureMarkdown('b', undefined), /Unknown conversion error/);
  assert.equal(core.getMarkdownThem(), core.getMarkdownThem());
  assert.equal(core.getMarkdownThem().generateMarkdown, core.generateMarkdown);
});

test('preview cache invalidates on file changes and works with each supported generator shape', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mdthem-preview-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const html = path.join(dir, 'report.html');
  const text = path.join(dir, 'notes.txt');
  const md = path.join(dir, 'notes.md');
  await writeFile(html, generateHtml({ heading: 'HTML Document' }));
  await writeFile(text, 'Text document');
  await writeFile(md, '# Direct Markdown\n');
  const defaultConverter = core.createDocumentConverter();
  assert.deepEqual(await defaultConverter.readMarkdown(md), {
    markdown: '# Direct Markdown\n',
    previewInfo: null,
  });
  assert.equal((await defaultConverter.readMarkdown(text)).previewInfo.kind, 'text');
  assert.match((await defaultConverter.readMarkdown(html)).markdown, /HTML Document/);
  assert.match(defaultConverter.createFailureMarkdown(html, new Error('broken')), /broken/);
  await assert.rejects(
    defaultConverter.readMarkdown(path.join(dir, 'report.xyz')),
    /Unsupported file type/,
  );
  await assert.rejects(defaultConverter.readMarkdown(path.join(dir, 'README')), /README/);

  const calls = [];
  const generate = async (file) => {
    calls.push(file);
    return '# Injected preview';
  };
  const converter = new core.DocumentConverter({
    getMarkdownThem: () => ({ generateMarkdown: generate }),
  });
  assert.equal((await converter.readMarkdown(html)).previewInfo.fromCache, false);
  assert.equal((await converter.readMarkdown(html)).previewInfo.fromCache, true);
  assert.deepEqual(calls, [html]);
  await writeFile(html, '<h1>New length</h1>');
  assert.equal((await converter.readMarkdown(html)).previewInfo.fromCache, false);
  converter.clearCache();
  assert.equal((await converter.readMarkdown(html)).previewInfo.fromCache, false);
  assert.equal(calls.length, 3);

  for (const resolver of [() => generate, { generateMarkdown: generate }]) {
    assert.equal(
      (await core.readMarkdownFile('.html', html, resolver, new Map())).markdown,
      '# Injected preview',
    );
  }
  assert.match(
    (await core.readMarkdownFile('.html', html, undefined, new Map())).markdown,
    /New length/,
  );
  const resolver = (file) => file && generate(file);
  assert.equal(
    (await core.createDocumentConverter({ generateMarkdown: resolver }).readMarkdown(html))
      .markdown,
    '# Injected preview',
  );
  const metadata = await stat(html);
  const oldEntry = new Map([
    [html, { mtimeMs: metadata.mtimeMs, size: metadata.size, markdown: 'Old cache' }],
  ]);
  assert.equal(
    (await core.getCachedConversionResult(oldEntry, html, metadata)).previewInfo.qualityCode,
    'converted-preview',
  );
  assert.equal(
    await core.getCachedConversionResult(oldEntry, html, { ...metadata, size: 0 }),
    null,
  );
  assert.equal(
    await core.getCachedConversionResult(oldEntry, html, { ...metadata, mtimeMs: 0 }),
    null,
  );
  const subdirectory = path.join(dir, 'folder');
  await mkdir(subdirectory);
  await assert.rejects(core.generateMarkdown(subdirectory), /file/i);
});
