import assert from 'node:assert/strict';
import { test } from 'node:test';
import formats from '../../out/shared/formats.js';

test('browser dispatch lists partition the supported extensions', () => {
  const { SUPPORTED_FILE_EXTENSIONS, WEB_DIRECT_FILE_EXTENSIONS, WEB_OFFICE_FILE_EXTENSIONS } =
    formats;
  assert.deepEqual(
    [...WEB_DIRECT_FILE_EXTENSIONS, ...WEB_OFFICE_FILE_EXTENSIONS].sort(),
    [...SUPPORTED_FILE_EXTENSIONS].sort(),
  );
  assert.equal(formats.getFileExtension('annual.report.XLSX'), '.xlsx');
  assert.equal(formats.getFileExtension('README'), '');
  assert.equal(formats.isSupportedFileName('report.XLSX'), true);
  assert.equal(formats.isSupportedFileName('report.exe'), false);
});

test('output names preserve source Markdown and handle extensionless inputs', () => {
  for (const name of ['notes.md', 'notes.markdown', 'notes.MDX']) {
    assert.equal(formats.markdownOutputName(name), 'notes_converted.md');
  }
  assert.equal(formats.markdownOutputName('report.final.docx'), 'report.final.md');
  assert.equal(formats.markdownOutputName('README'), 'README.md');
  assert.equal(formats.markdownOutputName(''), 'converted.md');
});
