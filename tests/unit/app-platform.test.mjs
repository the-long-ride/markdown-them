import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { useDom } from './app-dom.mjs';

const require = createRequire(import.meta.url);
const bridge = require('../../out/app/tauri-bridge.js');
const { createTauriDesktopApi, getDesktopApi } = require('../../out/app/tauri-api.js');
const { isAppDebugging } = require('../../out/app/utils/debug.js');
const support = require('../../out/app/utils/supportPromptStore.js');
const helpers = require('../../out/app/hooks/file-converter-helpers.js');
const {
  getSupportPromptTranslations,
} = require('../../out/app/context/supportPromptTranslations.js');

test('desktop API normalizes IPC defaults, batch errors, and official update responses', async (t) => {
  assert.equal(bridge.isTauriEnvironment(), false);
  assert.equal(getDesktopApi(), undefined);
  const { window } = useDom(t);
  const api = createTauriDesktopApi();
  assert.equal(getDesktopApi(), undefined);
  let release = Response.json({ html_url: 'https://example.test/latest' });
  const fetch = t.mock.method(globalThis, 'fetch', async () => release);
  assert.equal((await api.checkForUpdate()).updateAvailable, false);
  assert.match(fetch.mock.calls[0].arguments[0], /releases\/latest$/);
  release = new Response('', { status: 429 });
  assert.equal((await api.checkForUpdate()).updateAvailable, false);
  release = Response.json({ tag_name: 'v0.0.0' });
  assert.equal((await api.checkForUpdate()).updateAvailable, false);
  fetch.mock.mockImplementation(async () => {
    throw new Error('offline');
  });
  assert.equal((await api.checkForUpdate()).updateAvailable, false);

  const commands = [];
  window.__TAURI_INTERNALS__ = {
    async invoke(command, args) {
      commands.push([command, args]);
      switch (command) {
        case 'save_markdown_dialog':
          return undefined;
        case 'app_is_debug':
          throw new Error('not supported by host');
        case 'read_file_binary': {
          if (args.path.endsWith('failed.txt')) throw 'file removed';
          if (args.path.endsWith('bad.txt')) return { bad: 'data' };
          const bytes = new TextEncoder().encode('Desktop data');
          return args.path.endsWith('buffer.txt') ? bytes.buffer : bytes;
        }
        case 'save_converted_file':
          return '/out/result.md';
        default:
          return null;
      }
    },
  };
  assert.equal(getDesktopApi(), window.markdownThemDesktop);
  assert.equal(getDesktopApi().isDesktop, true);
  delete window.markdownThemDesktop;
  assert.equal(getDesktopApi().isDesktop, true);
  assert.deepEqual(await api.chooseFiles(), []);
  assert.deepEqual(await api.chooseFolders(), []);
  assert.equal(await api.chooseOutputFolder(), undefined);
  assert.deepEqual(await api.saveMarkdown('empty.md', ''), { canceled: true, filePath: undefined });
  assert.equal(await api.isDebug(), false);
  assert.deepEqual(await api.convertFiles([]), []);
  const results = await api.convertFiles([
    'C:\\docs\\buffer.txt',
    '/src/good.txt',
    '/src/failed.txt',
    '/src/bad.txt',
  ]);
  assert.deepEqual(
    results.map(({ status, name, error }) => [status, name, error]),
    [
      ['done', 'buffer.txt', undefined],
      ['done', 'good.txt', undefined],
      ['error', 'failed.txt', 'file removed'],
      ['error', 'bad.txt', 'Unexpected binary data format: object'],
    ],
  );
  assert.ok(
    commands.some(([cmd, args]) => cmd === 'save_converted_file' && args.outputFolder === null),
  );
  const previous = window.navigator.clipboard;
  delete window.navigator.clipboard;
  await api.copyText('No clipboard available');
  window.navigator.clipboard = previous;
});

test('desktop listener cleanup works for late, rejected, and immediate subscriptions', async (t) => {
  const { window } = useDom(t);
  const handlers = new Map();
  const removed = [];
  let resolve;
  window.__TAURI_LISTEN__ = (event, handler) => {
    handlers.set(event, handler);
    if (event === 'late')
      return new Promise((r) => {
        resolve = r;
      });
    if (event === 'rejected') return Promise.reject(new Error('listener unavailable'));
    if (event === 'async') return Promise.resolve(() => removed.push(event));
    return () => removed.push(event);
  };
  const late = bridge.registerListener('late', () => {});
  const rejected = bridge.registerListener('rejected', () => {});
  const ready = bridge.registerListener('async', () => {});
  late();
  resolve(() => removed.push('late'));
  await Promise.resolve();
  ready();
  rejected();
  assert.deepEqual(removed, ['late', 'async']);

  const events = [];
  const stop = bridge.createDragDropListener((value) => events.push(value));
  handlers.get('tauri://drag-drop')({ payload: ['/a.txt'] });
  handlers.get('tauri://drag-enter')({ payload: { paths: ['/b.txt'], position: { x: 2, y: 3 } } });
  handlers.get('tauri://drag-enter')({ payload: null });
  handlers.get('tauri://drag-drop')({ payload: { paths: false } });
  handlers.get('tauri://drag-over')({ payload: null });
  assert.deepEqual(events, [
    { type: 'drop', paths: ['/a.txt'], position: undefined },
    { type: 'enter', paths: ['/b.txt'], position: { x: 2, y: 3 } },
    { type: 'enter', paths: [], position: undefined },
    { type: 'drop', paths: [], position: undefined },
    { type: 'over', position: undefined },
  ]);
  stop();
  assert.deepEqual(removed.slice(2).sort(), [
    'tauri://drag-drop',
    'tauri://drag-enter',
    'tauri://drag-leave',
    'tauri://drag-over',
  ]);
});

test('support preferences survive migration and blocked storage, and debug modes are opt-in', async (t) => {
  assert.equal(await isAppDebugging(), false);
  assert.deepEqual(support.loadSupportPromptState(), support.getDefaultSupportPromptState());
  support.saveSupportPromptState(support.getDefaultSupportPromptState());
  const { window } = useDom(t);
  const key = support.SUPPORT_PROMPT_STORAGE_KEY;
  window.localStorage.setItem(
    key,
    JSON.stringify({ hasConverted: true, promptShown: true, neverShowAgain: false }),
  );
  assert.deepEqual(support.loadSupportPromptState(), {
    conversionCount: 1,
    lastPromptedCount: 1,
    neverShowAgain: false,
  });
  window.localStorage.setItem(key, 'invalid');
  assert.equal(support.recordConversionAndCheckPrompt(), true);
  for (let i = 2; i < support.CONVERSION_PROMPT_INTERVAL; i++) {
    assert.equal(support.recordConversionAndCheckPrompt(), false);
  }
  assert.equal(support.recordConversionAndCheckPrompt(), true);
  support.setSupportPromptNeverShowAgain();
  assert.equal(support.recordConversionAndCheckPrompt(), false);
  assert.equal(support.loadSupportPromptState().lastPromptedCount, 20);
  const storage = Object.getPrototypeOf(window.localStorage);
  t.mock.method(storage, 'getItem', () => {
    throw new Error('Storage blocked');
  });
  t.mock.method(storage, 'setItem', () => {
    throw new Error('Storage blocked');
  });
  assert.equal(support.recordConversionAndCheckPrompt(), true);
  assert.deepEqual(getSupportPromptTranslations('unknown'), getSupportPromptTranslations('en'));
  assert.deepEqual(getSupportPromptTranslations(), getSupportPromptTranslations('en'));

  assert.equal(await isAppDebugging(), false);
  window.history.replaceState(null, '', '?debug=1');
  assert.equal(await isAppDebugging(), true);
  window.history.replaceState(null, '', '?debug=true');
  assert.equal(await isAppDebugging(), true);
  window.history.replaceState(null, '', '?#Debug');
  assert.equal(await isAppDebugging(), true);
  window.history.replaceState(null, '', '/');
  window.__DEBUG__ = true;
  assert.equal(await isAppDebugging(), true);
  delete window.__DEBUG__;
  window.markdownThemDesktop = {
    isDebug: async () => {
      throw new Error('IPC unavailable');
    },
  };
  assert.equal(await isAppDebugging(), false);
});

test('desktop tasks support old hosts and stop when cancellation arrives during IO', async () => {
  const item = { id: 'remote', name: 'remote.txt', sourcePath: '/src/remote.txt' };
  const convert = (api, entry = item, signal) =>
    helpers.buildDesktopTasks([entry], api, '', signal)[0].convert();
  assert.deepEqual(
    await convert({
      convertFiles: async () => [{ status: 'done', outputPath: 'C:\\out\\result.md' }],
    }),
    {
      markdown: '',
      outputPath: 'C:\\out\\result.md',
      outputName: 'result.md',
    },
  );
  assert.equal(
    (await convert({ convertFiles: async () => [{ status: 'done' }] })).outputName,
    'remote.md',
  );
  await assert.rejects(convert({ convertFiles: async () => [] }), /Desktop conversion failed/);
  await assert.rejects(
    convert({ convertFiles: async () => [{ status: 'error', error: 'Failed to read' }] }),
    /Failed to read/,
  );
  await assert.rejects(convert({}, { id: 'empty', name: 'empty.txt' }), /No file content/);
  await assert.rejects(convert({}, item, AbortSignal.abort()), /Canceled/);
  const controller = new AbortController();
  await assert.rejects(
    convert(
      {
        readFileBinary: async () => {
          controller.abort();
          return new TextEncoder().encode('Disregard');
        },
      },
      item,
      controller.signal,
    ),
    /Canceled/,
  );
  assert.deepEqual(
    await convert({}, { name: 'browser.md', file: new File(['Data'], 'browser.md') }),
    {
      markdown: 'Data',
      outputPath: undefined,
      outputName: 'browser_converted.md',
    },
  );
  assert.equal(helpers.buildBrowserTasks([{ name: 'browser.txt' }])[0].outputName, 'browser.md');
  await helpers.downloadFilesZip([{ status: 'error', markdown: 'Unusable' }]);
});
