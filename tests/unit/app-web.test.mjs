import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { act } from 'react';
import JSZip from 'jszip';
import { useDom } from './app-dom.mjs';

const require = createRequire(import.meta.url);
const converter = '../../out/app/App.js';

test('browser app converts and exports files and text, including failed file rows', async (t) => {
  const dom = useDom(t);
  const { window, click, emit, get, changeText, until } = dom;
  const { App } = require(converter);
  await dom.render(App);
  assert.ok(dom.animations.some(({ timing }) => timing.duration === 420));
  assert.equal(window.document.documentElement.dataset.theme, 'light');
  assert.equal(get('.files-panel .primary-button').disabled, true);
  const fileInput = get('input[type=file]');
  const inputClick = t.mock.method(fileInput, 'click', () => {});
  await emit(get('.drop-zone'), 'keydown', { eventClass: window.KeyboardEvent, key: 'Escape' });
  await emit(get('.drop-zone'), 'keydown', { eventClass: window.KeyboardEvent, key: 'Enter' });
  assert.equal(inputClick.mock.callCount(), 1);

  const html = new File(['<h1>Browser report</h1>'], 'report.html');
  const unsupported = new File(['ignore'], 'broken.bin');
  const extra = new File(['extra'], 'extra.txt');
  const main = get('.workspace');
  assert.equal((await emit(main, 'dragover')).defaultPrevented, true);
  assert.ok(main.classList.contains('is-dragging'));
  await emit(main, 'dragleave');
  assert.ok(!main.classList.contains('is-dragging'));
  await emit(main, 'drop', {}, { dataTransfer: { files: [] } });
  await emit(main, 'drop', {}, { dataTransfer: { files: [html, unsupported] } });
  Object.defineProperty(fileInput, 'files', { value: [html, extra] });
  await emit(fileInput, 'change');
  assert.equal(get('.panel-count-badge').textContent, '3');
  await click([...window.document.querySelectorAll('.remove-row-btn')].at(-1));
  assert.equal(get('.panel-count-badge').textContent, '2');
  await click('.files-panel .primary-button');
  await until(
    () =>
      window.document.querySelector('.file-row--done') &&
      window.document.querySelector('.file-row--error'),
  );
  assert.match(get('.file-row--error').textContent, /Unsupported file type/);
  await click('.download-row-btn');
  assert.equal(dom.downloads.at(-1), 'report.md');
  assert.match(await dom.createObjectURL.mock.calls.at(-1).arguments[0].text(), /# Browser report/);
  await click('.output-list-panel .compact-download');
  await until(() => dom.downloads.at(-1) === 'markdown-them.zip');
  const zipped = dom.createObjectURL.mock.calls.at(-1).arguments[0];
  const zip = await JSZip.loadAsync(await zipped.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files), ['report.md']);
  assert.match(await zip.file('report.md').async('string'), /# Browser report/);

  await click('.files-panel button[aria-label="Clear"]');
  assert.equal(get('.files-panel .primary-button').disabled, true);
  await click('.topline .segmented button:nth-of-type(2)');
  await changeText('.input-editor', 'Editable input');
  await emit(get('.input-editor'), 'keydown', { eventClass: window.KeyboardEvent, key: 'Enter' });
  assert.equal(window.document.querySelector('.output-editor'), null);
  await emit(get('.input-editor'), 'keydown', {
    eventClass: window.KeyboardEvent,
    key: 'Enter',
    ctrlKey: true,
  });
  assert.equal(get('.output-editor').value, 'Editable input');
  await changeText('.output-editor', 'Manual Markdown');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await click('.output-panel button[aria-label="Copy"]');
  assert.equal(dom.clipboard.at(-1), 'Manual Markdown');
  assert.match(get('.toast').textContent, /Copied/i);
  await act(async () => t.mock.timers.tick(2000));
  t.mock.timers.reset();
  assert.match(get('.output-panel .panel-footer-actions button').textContent, /Copy/);
  await click('.output-panel button[aria-label="Download"]');
  assert.equal(dom.downloads.at(-1), 'input.md');
  await click('.output-panel button[aria-label="Clear"]');
  assert.equal(window.document.querySelector('.output-editor'), null);
  await click('.input-panel button[aria-label="Clear"]');
  assert.equal(get('.input-editor').value, '');
  assert.ok(dom.animations.some(({ timing }) => timing.duration === 300));
  await until(() => window.document.querySelector('[role=dialog]'));
  await emit(window, 'keydown', { eventClass: window.KeyboardEvent, key: 'Escape' });
  assert.equal(window.document.querySelector('[role=dialog]'), null);
  await act(async () => window.__openSupportModal());
  assert.ok(window.document.querySelector('[role=dialog]'));
  assert.equal(window.__getSupportPromptState().conversionCount, 2);
  await dom.cleanup();
});

test('web navigation handles menus, locale, theme, legal deep links and support actions', async (t) => {
  const { window, render, click, emit, get, until, cleanup } = useDom(
    t,
    'https://example.test/#/privacy',
  );
  const linksOpened = [];
  window.open = (...args) => linksOpened.push(args);
  const { App } = require(converter);
  await render(App);
  assert.match(window.document.title, /Privacy Policy/);
  await click('.legal-tab-btn:nth-of-type(2)');
  await until(() => /Terms of Service/.test(window.document.title));
  await click('.legal-tab-btn:nth-of-type(1)');
  assert.match(window.document.title, /Privacy Policy/);
  await click('.legal-header .theme-toggle');
  assert.equal(window.document.documentElement.dataset.theme, 'dark');
  await click('.legal-back-button');
  assert.match(window.document.title, /Client-Side/);
  await click('.topline .theme-toggle');
  assert.equal(window.localStorage.getItem('markdown-them-theme'), 'light');
  await click('.variants-trigger');
  assert.equal(window.document.querySelectorAll('[role=menuitem]').length, 4);
  await emit(get('.variants-dropdown'), 'pointerdown');
  assert.ok(window.document.querySelector('.variants-dropdown'));
  await emit(window.document.body, 'pointerdown');
  assert.equal(window.document.querySelector('.variants-dropdown'), null);
  await click('.language-toggle');
  await emit(window.document.body, 'mousedown');
  assert.equal(window.document.querySelector('.language-dropdown'), null);
  await click('.language-toggle');
  await click('.language-dropdown [lang=fr]');
  assert.equal(window.document.documentElement.lang, 'fr');
  assert.equal(window.localStorage.getItem('markdown-them-language'), 'fr');

  await click('footer a[href="#/terms"]');
  assert.ok(window.document.querySelector('.legal-card'));
  await click('.legal-back-button');
  window.location.hash = '#/privacy';
  await until(() => window.document.querySelector('.legal-card'));
  window.location.hash = '#/terms';
  await until(() => get('.legal-tab-btn:nth-of-type(2)').getAttribute('aria-selected') === 'true');
  window.location.hash = '#/';
  await until(() => window.document.querySelector('.files-panel'));

  const openSupport = () => emit(window, 'markdown-them-open-support-modal');
  const support = require('../../out/app/utils/supportPromptStore.js');
  await openSupport();
  await click('.support-prompt-card');
  assert.ok(window.document.querySelector('[role=dialog]'));
  await click('.support-prompt-card__star-btn');
  assert.equal(linksOpened.at(-1)[0], 'https://github.com/the-long-ride/markdown-them');
  await openSupport();
  await click('.support-prompt-card__donate-btn');
  assert.equal(linksOpened.at(-1)[0], 'https://github.com/the-long-ride');
  await openSupport();
  await click('.support-prompt-card__checkbox');
  await click('.support-prompt-card__later-btn');
  assert.equal(support.loadSupportPromptState().neverShowAgain, true);
  await openSupport();
  await click('.support-prompt-modal');
  assert.equal(window.document.querySelector('[role=dialog]'), null);
  await cleanup();
});

test('web entry point requires a mount node and renders the app', async (t) => {
  const dom = useDom(t);
  const css = 'mdthem-test:styles';
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === './styles.css') return { url: css, shortCircuit: true };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url === css) return { format: 'commonjs', source: '', shortCircuit: true };
      return next(url, context);
    },
  });
  t.after(() => hook.deregister());
  const mount = dom.get('#root');
  mount.remove();
  assert.throws(() => require('../../out/app/main.js'), /Missing root element/);
  dom.window.document.body.append(mount);
  await act(async () => require('../../out/app/main.js'));
  assert.match(dom.get('main h1').textContent, /Markdown Them/);
  assert.equal(
    (await dom.emit(dom.window, 'keydown', { eventClass: dom.window.KeyboardEvent, key: 'a' }))
      .defaultPrevented,
    false,
  );
});
