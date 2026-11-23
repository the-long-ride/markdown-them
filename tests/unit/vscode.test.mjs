import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire, registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const mockSpecifier = 'mdthem-test:vscode';
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'vscode') return { url: mockSpecifier, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === mockSpecifier) {
      return {
        format: 'commonjs',
        source: 'module.exports = globalThis.mdthemVscode;',
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

class Uri {
  constructor(fsPath, scheme = 'file') {
    this.fsPath = fsPath;
    this.scheme = scheme;
  }

  static file(path) {
    return new Uri(path);
  }

  static parse(url) {
    return new Uri(url, 'https');
  }
}

class TabInputText {
  constructor(uri) {
    this.uri = uri;
  }
}

const commands = new Map();
const messages = [];
const warnings = [];
const errors = [];
const opened = [];
const progress = [];
const settings = [];
let input;
let chooseSupportAction;
let maxConcurrency = 6;
const host = {
  Uri,
  TabInputText,
  ProgressLocation: { Notification: 15 },
  ViewColumn: { Beside: -2 },
  ConfigurationTarget: { Global: 1 },
  commands: {
    registerCommand(name, callback) {
      commands.set(name, callback);
      return { name };
    },
  },
  window: {
    tabGroups: { activeTabGroup: {} },
    async showInformationMessage(message, ...options) {
      messages.push(message);
      return chooseSupportAction?.(options);
    },
    showErrorMessage(message) {
      errors.push(message);
    },
    showWarningMessage(message) {
      warnings.push(message);
    },
    withProgress(options, callback) {
      assert.equal(options.cancellable, false);
      return callback({ report: ({ message }) => progress.push(message) });
    },
    showTextDocument: async (document, options) => opened.push({ document, options }),
    async showInputBox({ value, validateInput }) {
      assert.equal(value, String(maxConcurrency));
      assert.match(validateInput('2.5'), /whole number/);
      assert.match(validateInput('0'), /between 1 and 16/);
      assert.match(validateInput('17'), /between 1 and 16/);
      assert.equal(validateInput(' 16 '), null);
      return input;
    },
  },
  workspace: {
    getConfiguration: () => ({
      get: () => maxConcurrency,
      update: async (...update) => settings.push(update),
    }),
    openTextDocument: async (document) => document,
  },
  env: { openExternal: async (uri) => opened.push(uri.fsPath) },
};
globalThis.mdthemVscode = host;
const { activate, deactivate } = require('../../out/vscode/extension.js');
hook.deregister();
delete globalThis.mdthemVscode;

test('registered VS Code commands convert selections and active documents, and update settings', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mdthem-vscode-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const a = path.join(dir, 'first.html');
  const b = path.join(dir, 'second.txt');
  const c = path.join(dir, 'missing.txt');
  await writeFile(a, '<h2>First report</h2>');
  await writeFile(b, 'Second report');

  const global = new Map();
  const context = {
    subscriptions: [],
    globalState: {
      get: (key, fallback) => global.get(key) ?? fallback,
      update: async (key, value) => global.set(key, value),
    },
  };
  activate(context);
  assert.deepEqual(
    context.subscriptions.map(({ name }) => name),
    [...commands.keys()],
  );
  const convert = commands.get('markdown-them.convertToMarkdown');
  const current = commands.get('markdown-them.convertCurrentToMarkdown');
  const setConcurrency = commands.get('markdown-them.setMaxConcurrentConversions');

  await convert();
  assert.match(messages.at(-1), /Please select files/);
  await current();
  assert.match(errors.at(-1), /No active file/);

  host.window.activeTextEditor = { document: { uri: Uri.file(a) } };
  chooseSupportAction = (options) => options[0];
  await convert();
  assert.match(await readFile(path.join(dir, 'first.md'), 'utf8'), /## First report/);
  assert.match(messages.at(-2), /Converted .*first\.md/);
  assert.equal(opened.at(-1), 'https://github.com/the-long-ride/markdown-them');

  maxConcurrency = 20;
  await convert(Uri.file(a), [Uri.file(a), Uri.file(a), new Uri(b, 'untitled'), 42, Uri.file(b)]);
  assert.match(messages.at(-1), /Converted 2 files/);
  assert.deepEqual(progress.slice(-3), ['0/2', '1/2', '2/2']);

  maxConcurrency = 0;
  await convert([Uri.file(b), Uri.file(c)]);
  assert.match(warnings.at(-1), /second\.md, 1 failed/);
  await convert(Uri.file(c));
  assert.match(warnings.at(-1), /Converted 0 files, 1 failed/);

  const countKey = 'markdownThem.conversionCount';
  global.set(countKey, 19);
  chooseSupportAction = (options) => options[1];
  host.window.activeTextEditor.document.uri = new Uri(a, 'untitled');
  host.window.tabGroups.activeTabGroup.activeTab = { input: new TabInputText(Uri.file(b)) };
  await current();
  assert.deepEqual(opened.at(-2), {
    document: { content: 'Second report', language: 'markdown' },
    options: { preview: false, viewColumn: -2 },
  });
  assert.equal(opened.at(-1), 'https://github.com/the-long-ride');

  global.set(countKey, 39);
  chooseSupportAction = (options) => options[2];
  await current();
  assert.equal(global.get('markdownThem.neverShowSupportPrompt'), true);
  await current();
  assert.equal(global.get(countKey), 40);
  global.delete('markdownThem.neverShowSupportPrompt');
  global.set(countKey, 59);
  chooseSupportAction = () => undefined;
  await current();
  assert.equal(global.get(countKey), 60);

  host.window.tabGroups.activeTabGroup.activeTab.input = new TabInputText(new Uri(c, 'untitled'));
  await current();
  assert.match(errors.at(-1), /No active file/);
  host.window.tabGroups.activeTabGroup.activeTab.input = new TabInputText(Uri.file(c));
  await current();
  assert.match(errors.at(-1), /Failed to convert missing\.txt:/);
  host.workspace.openTextDocument = async () => {
    throw 'editor closed';
  };
  host.window.activeTextEditor.document.uri = Uri.file(a);
  await current();
  assert.equal(errors.at(-1), 'Failed to convert first.html: editor closed');

  await setConcurrency();
  assert.equal(settings.length, 0);
  input = ' 16 ';
  await setConcurrency();
  assert.deepEqual(settings, [['maxConcurrentConversions', 16, 1]]);
  assert.equal(messages.at(-1), 'Markdown Them: Max concurrent conversions set to 16.');
  deactivate();
});
