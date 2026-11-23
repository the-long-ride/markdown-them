import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { act } from 'react';
import { useDom } from './app-dom.mjs';

const require = createRequire(import.meta.url);
const encoder = new TextEncoder();

test('desktop app uses IPC for files, output folders, text, window controls and links', async (t) => {
  const dom = useDom(t);
  const { window, click, emit, get, changeText, until } = dom;
  window.matchMedia = (query) => ({ matches: true, media: query });
  window.localStorage.setItem('markdown-them-zoom-factor', '1.2');
  window.localStorage.setItem('markdown-them-theme', 'dark');
  window.localStorage.setItem('markdown-them-language', 'en');
  const calls = [];
  const listeners = new Map();
  let failZoom = false;
  let saveText = true;
  let rejectFolder = false;
  let rejectOpenPath = false;
  window.__TAURI_LISTEN__ = (event, handler) => {
    listeners.set(event, handler);
    return () => {
      if (listeners.get(event) === handler) listeners.delete(event);
    };
  };
  window.__TAURI_INTERNALS__ = {
    async invoke(cmd, args) {
      calls.push([cmd, args]);
      switch (cmd) {
        case 'app_is_debug':
          return true;
        case 'choose_files':
          return [{ path: '/docs/large.txt', name: 'large.txt', size: 2048 }];
        case 'choose_folders':
          return [{ path: '/docs/report.txt', name: 'report.txt', size: 2097152 }];
        case 'choose_output_folder':
          return rejectFolder ? null : '/saved';
        case 'read_file_binary':
          return [...encoder.encode('From desktop')];
        case 'save_converted_file':
          return `${args.outputFolder || '/docs'}/${args.sourcePath
            .split('/')
            .at(-1)
            .replace(/\.txt$/, '')}.md`;
        case 'save_markdown_dialog':
          return saveText ? '/saved/input.md' : null;
        case 'window_is_maximized':
          return false;
        case 'window_set_zoom':
          if (failZoom) throw new Error('Unsupported zoom');
          return;
        case 'open_path':
          if (rejectOpenPath) throw new Error('Path cannot be opened');
          return;
        default:
          return;
      }
    },
  };
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ tag_name: 'v9.9.9', html_url: 'https://example.test/update' }),
  );

  const { App } = require('../../out/app/App.js');
  await dom.render(App);
  assert.ok(window.markdownThemDesktop?.isDesktop);
  assert.ok(get('.desktop-shell'));
  assert.deepEqual(
    calls.find(([cmd]) => cmd === 'window_set_zoom'),
    ['window_set_zoom', { factor: 1.2 }],
  );
  assert.equal(dom.animations.length, 0);
  await until(() => window.document.querySelector('.titlebar-download-btn'));
  await click('.titlebar-download-btn');
  assert.deepEqual(calls.at(-1), ['open_external', { url: 'https://example.test/update' }]);
  await click('.titlebar-version-link');
  assert.match(calls.at(-1)[1].url, /CHANGELOG/);
  await click('footer a[href*="privacy"]');
  assert.match(calls.at(-1)[1].url, /privacy/);
  await until(() => window.document.querySelector('[role=dialog]'));
  await click('.support-prompt-card__close');

  const chrome = get('.titlebar-title');
  const mouse = { eventClass: window.MouseEvent };
  await emit(chrome, 'mousedown', { ...mouse, button: 1 });
  await emit(get('.titlebar-version-link'), 'mousedown', mouse);
  await emit(chrome, 'mousedown', { ...mouse, detail: 1 });
  assert.equal(calls.at(-1)[0], 'window_start_dragging');
  await emit(chrome, 'mousedown', { ...mouse, detail: 2 });
  await emit(chrome, 'dblclick', { ...mouse, button: 1 });
  await emit(get('.titlebar-version-link'), 'dblclick', mouse);
  await emit(chrome, 'dblclick', mouse);
  assert.equal(calls.filter(([cmd]) => cmd === 'window_toggle_maximize').length, 2);
  await act(async () => listeners.get('window:maximized-change')({ payload: true }));
  await click('button[aria-label="Restore"]');
  await click('button[aria-label="Minimize"]');
  await click('button.close-control');
  assert.deepEqual(
    calls.slice(-3).map(([cmd]) => cmd),
    ['window_toggle_maximize', 'window_minimize', 'window_close'],
  );
  await click('.titlebar .theme-toggle');
  assert.equal(window.document.documentElement.dataset.theme, 'light');

  const key = { eventClass: window.KeyboardEvent };
  const zoomCalls = calls.filter(([cmd]) => cmd === 'window_set_zoom').length;
  await emit(window, 'keydown', { ...key, key: '=' });
  assert.equal(calls.filter(([cmd]) => cmd === 'window_set_zoom').length, zoomCalls);
  await emit(window, 'keydown', { ...key, key: '+', ctrlKey: true });
  assert.deepEqual(calls.at(-1)[1], { factor: 1.3 });
  await emit(window, 'keydown', { ...key, code: 'NumpadSubtract', metaKey: true });
  assert.deepEqual(calls.at(-1)[1], { factor: 1.2 });
  await emit(window, 'keydown', { ...key, key: '0', ctrlKey: true });
  assert.deepEqual(calls.at(-1)[1], { factor: 1 });
  const wheel = { eventClass: window.WheelEvent, ctrlKey: true };
  await emit(window, 'wheel', { eventClass: window.WheelEvent, deltaY: -1 });
  await emit(window, 'wheel', { ...wheel, deltaY: -1 });
  assert.deepEqual(calls.at(-1)[1], { factor: 1.05 });
  failZoom = true;
  await emit(window, 'wheel', { ...wheel, deltaY: 1 });
  await emit(window, 'wheel', { ...wheel, deltaY: 0 });
  await until(() => window.document.documentElement.style.zoom === '1');
  assert.equal(window.localStorage.getItem('markdown-them-zoom-factor'), '1');

  const drag = (event, payload) =>
    act(async () => listeners.get(`tauri://drag-${event}`)({ payload }));
  await drag('enter', ['/docs/native.txt']);
  assert.ok(get('.workspace').classList.contains('is-dragging'));
  await drag('over', { position: { x: 10, y: 20 } });
  await drag('leave');
  assert.ok(!get('.workspace').classList.contains('is-dragging'));
  await drag('drop', { paths: [] });
  await drag('drop', { paths: ['/docs/native.txt'] });
  const browserFile = new File(['From browser'], 'browser.txt');
  const pathFile = new File([], '');
  Object.defineProperty(pathFile, 'path', { value: '/docs/drop.txt' });
  await emit(get('.workspace'), 'drop', {}, { dataTransfer: { files: [browserFile, pathFile] } });
  await click('.drop-zone');
  await click('.split-actions button:nth-of-type(2)');
  assert.match(get('.selection-file-preview').textContent, /2.0 KB.*2.0 MB/s);
  await emit(get('.output-picker'), 'keydown', { ...key, key: 'Escape' });
  await emit(get('.output-picker'), 'keydown', { ...key, key: ' ' });
  assert.equal(get('.output-picker-path').textContent, '/saved');
  await click('.output-picker button:nth-of-type(2)');
  assert.notEqual(get('.output-picker-path').textContent, '/saved');
  rejectFolder = true;
  await click('.output-picker');
  assert.notEqual(get('.output-picker-path').textContent, '/saved');
  rejectFolder = false;
  await click('.output-picker');
  await click('.files-panel .primary-button');
  await until(() => window.document.querySelectorAll('.file-row--done').length === 5);
  const saved = calls.filter(([cmd]) => cmd === 'save_converted_file').map(([, args]) => args);
  assert.ok(
    saved.some(
      ({ sourcePath, markdown }) => sourcePath === 'browser.txt' && markdown === 'From browser',
    ),
  );
  assert.ok(saved.every(({ outputFolder }) => outputFolder === '/saved'));
  await click('.file-name-clickable');
  assert.equal(calls.at(-1)[0], 'open_path');
  rejectOpenPath = true;
  await click('.file-name-clickable');
  await until(() => calls.at(-1)[0] === 'open_external');
  assert.equal(calls.at(-1)[1].url, '/saved/native.md');
  await click('.output-list-panel button[aria-label="Clear"]');
  await until(() => window.document.querySelector('[role=dialog]'));
  await click('.support-prompt-card__close');

  await click('.titlebar .segmented button:nth-of-type(2)');
  await changeText('.input-editor', '# Text from desktop');
  await click('.input-panel .primary-button');
  await until(() => window.document.querySelector('.output-editor'));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await click('.output-panel button[aria-label="Copy"]');
  assert.equal(dom.clipboard.at(-1), '# Text from desktop');
  await act(async () => t.mock.timers.tick(2000));
  t.mock.timers.reset();
  await click('.output-panel button[aria-label="Save"]');
  await until(() =>
    window.document.querySelector('.toast')?.textContent.includes('/saved/input.md'),
  );
  saveText = false;
  await click('.output-panel button[aria-label="Save"]');
  assert.equal(calls.at(-1)[0], 'save_markdown_dialog');
  await click('.titlebar .segmented button:nth-of-type(1)');

  await act(async () => window.__openSupportModal());
  await click('.support-prompt-card__checkbox');
  await click('.support-prompt-card__star-btn');
  assert.match(calls.at(-1)[1].url, /markdown-them/);
  await act(async () => window.__openSupportModal());
  await click('.support-prompt-card__donate-btn');
  assert.equal(calls.at(-1)[1].url, 'https://github.com/the-long-ride');
  await dom.cleanup();
  assert.equal(listeners.size, 0);
});
