import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { build } from 'esbuild';
import { copyLocalAssets } from '../scripts/lib/local-assets.mjs';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

test('installed PDF assets match officeparser browser API version', async () => {
  const officeRequire = createRequire(require.resolve('officeparser'));
  const { version } = officeRequire('pdfjs-dist/package.json');
  const browserPath = path.join(
    path.dirname(require.resolve('officeparser')),
    'officeparser.browser.mjs',
  );
  const browser = await readFile(browserPath, 'utf8');
  assert.ok(browser.includes(`apiVersion:"${version}"`));
  assert.equal(require('../package.json').overrides['pdfjs-dist'], version);
});

test('font stylesheets reference only vendored stylesheets and WOFF2 files', async () => {
  const fonts = path.join(root, 'assets', 'fonts');
  const files = await readdir(fonts);
  const families = new Set();
  for (const name of files.filter((file) => file.endsWith('.css'))) {
    const css = await readFile(path.join(fonts, name), 'utf8');
    assert.doesNotMatch(css, /https?:|data:/);
    for (const [, reference] of css.matchAll(/(?:url\(|@import\s+['"])(\.\/[^)'";]+)/g)) {
      assert.ok(files.includes(reference.slice(2)), `${name}: missing ${reference}`);
    }
    for (const [, family] of css.matchAll(/font-family: '([^']+)'/g)) families.add(family);
  }
  assert.deepEqual([...families].sort(), [
    'Be Vietnam Pro',
    'JetBrains Mono',
    'Noto Sans JP',
    'Noto Sans KR',
    'Noto Sans SC',
    'Orbitron',
    'Outfit',
  ]);
  assert.equal(files.filter((name) => name.endsWith('-LICENSE.txt')).length, 8);
  const html = await readFile(path.join(root, 'src/app/index.html'), 'utf8');
  assert.match(html, /href="\.\/assets\/fonts\/fonts.css"/);
  const tauri = await readFile(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8');
  assert.doesNotMatch(html + tauri, /fonts\.(?:googleapis|gstatic)\.com/);
});

test('Latin/Vietnamese fonts ship only used CSS weights within the size budget', async () => {
  const fonts = path.join(root, 'assets/fonts');
  const files = (await readdir(fonts)).filter((file) => !file.includes('cjk'));
  const weights = {
    'be-vietnam-pro': [400, 500, 600, 700],
    'jetbrains-mono': [400, 500, 550, 600, 700],
    'noto-sans-jp': [400, 500, 550, 600, 700],
    'noto-sans-kr': [400, 500, 550, 600, 700],
    'noto-sans-sc': [400, 500, 550, 600, 700],
    orbitron: [400, 600],
    outfit: [600],
  };
  const referenced = new Set();
  let bytes = 0;
  for (const file of files) bytes += (await stat(path.join(fonts, file))).size;
  assert.ok(bytes < 1_200_000, `font assets grew to ${bytes} bytes`);
  assert.ok(files.length < 100, `font assets grew to ${files.length} files`);
  for (const [family, used] of Object.entries(weights)) {
    const css = await readFile(path.join(fonts, `${family}.css`), 'utf8');
    const declared = new Set();
    for (const [block] of css.matchAll(/@font-face\s*\{[^}]+\}/g)) {
      const weight = Number(block.match(/font-weight: (\d+);/)?.[1]);
      assert.ok(used.includes(weight), `${family}: unexpected weight ${weight}`);
      declared.add(weight);
      assert.match(block, /unicode-range:\s*U\+/);
      const file = block.match(/url\(\.\/([^)]*)\)/)?.[1];
      assert.match(
        file,
        new RegExp(`^${family}-(latin|latin-ext|vietnamese)-${weight}-normal\\.woff2$`),
      );
      referenced.add(file);
    }
    assert.deepEqual([...declared].sort(), [...used].sort());
  }
  assert.deepEqual([...referenced].sort(), files.filter((file) => file.endsWith('.woff2')).sort());
});

test('extension and npm package exclude web font assets', async () => {
  const ignore = await readFile(path.join(root, '.vscodeignore'), 'utf8');
  assert.match(ignore, /^assets\/\*\*$/m);
  assert.deepEqual(
    ignore.split('\n').filter((line) => line.startsWith('!assets/')),
    ['!assets/markdown-them-logo.png'],
  );
  const manifest = JSON.parse(
    await readFile(path.join(root, 'nodejs-package/package.json'), 'utf8'),
  );
  assert.deepEqual(manifest.files, ['dist/**/*', 'README.md', 'LICENSE']);
});

test('asset copying uses the worker package, preserves empty folders and fails on missing assets', async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'local-assets-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const pdfRoot = path.join(temporary, 'pdfjs-dist');
  await mkdir(path.join(pdfRoot, 'build'), { recursive: true });
  await mkdir(path.join(pdfRoot, 'cmaps'), { recursive: true });
  await mkdir(path.join(pdfRoot, 'wasm'), { recursive: true });
  await writeFile(path.join(pdfRoot, 'cmaps', 'sample.bcmap'), 'matching-package');
  const destination = path.join(temporary, 'assets');
  const worker = path.join(pdfRoot, 'build', 'pdf.worker.min.mjs');
  await copyLocalAssets(destination, worker);
  assert.equal(
    await readFile(path.join(destination, 'cmaps/sample.bcmap'), 'utf8'),
    'matching-package',
  );
  assert.deepEqual(await readdir(path.join(destination, 'wasm')), []);
  assert.equal(
    await readFile(path.join(destination, 'fonts/fonts.css'), 'utf8'),
    await readFile(path.join(root, 'assets/fonts/fonts.css'), 'utf8'),
  );
  await rm(path.join(pdfRoot, 'cmaps'), { recursive: true });
  await assert.rejects(copyLocalAssets(destination, worker), { code: 'ENOENT' });
});

async function loadConverter(entryPoint) {
  const result = await build({
    entryPoints: [path.join(root, entryPoint)],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['mammoth', '@opendocsg/pdf2md'],
    plugins: [
      {
        name: 'observe-office-options',
        setup(builder) {
          builder.onResolve({ filter: /^officeparser$/ }, () => ({
            path: 'officeparser',
            namespace: 'stub',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            contents: `
          export async function parseOffice(input, config) {
            globalThis.localFirstCalls.push(config);
            if (globalThis.localFirstError) throw new Error('parser failure');
            return { content: [{ type: 'text', text: 'local conversion' }] };
          }
          export async function terminateOcr() { globalThis.localFirstTerminated++; }
        `,
          }));
        },
      },
    ],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(
    require,
    module,
    module.exports,
  );
  return module.exports;
}

test('browser conversion uses local PDF assets, refuses empty input and propagates parser errors', async (t) => {
  const previousWindow = globalThis.window;
  t.after(() => {
    globalThis.window = previousWindow;
  });
  globalThis.window = { location: { href: 'https://example.test/markdown-them/#/convert' } };
  globalThis.localFirstCalls = [];
  globalThis.localFirstTerminated = 0;
  globalThis.localFirstError = false;
  const { convertBufferToMarkdown } = await loadConverter('src/app/browser-converter.ts');
  assert.equal(
    await convertBufferToMarkdown('sample.pdf', new Uint8Array([1])),
    'local conversion',
  );
  const config = globalThis.localFirstCalls[0];
  assert.equal(config.pdfWorkerSrc, 'https://example.test/markdown-them/assets/pdf.worker.min.mjs');
  assert.equal(config.pdfCMapUrl, 'https://example.test/markdown-them/assets/cmaps/');
  assert.equal(config.pdfDecoderUrl, 'https://example.test/markdown-them/assets/wasm/');
  assert.equal(config.allowRemoteAssets, false);
  assert.equal(config.ocr, false);
  assert.equal(config.extractAttachments, false);
  await assert.rejects(convertBufferToMarkdown('empty.pdf', new Uint8Array()), /zero bytes/);
  globalThis.localFirstError = true;
  await assert.rejects(convertBufferToMarkdown('bad.pdf', new Uint8Array([1])), /parser failure/);
  assert.equal(globalThis.localFirstTerminated, 2);
  globalThis.localFirstError = false;
  delete globalThis.window;
  await convertBufferToMarkdown('sample.pdf', new Uint8Array([1]));
  assert.equal(globalThis.localFirstCalls.at(-1).pdfCMapUrl, '');
  assert.equal(globalThis.localFirstCalls.at(-1).pdfDecoderUrl, '');
  assert.equal(globalThis.localFirstCalls.at(-1).allowRemoteAssets, false);
});

test('Node Office fallback explicitly disables OCR, attachments and remote assets', async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'local-converter-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  globalThis.localFirstCalls = [];
  globalThis.localFirstError = false;
  const { generateMarkdown } = await loadConverter('src/core/converters.ts');
  const file = path.join(temporary, 'sample.doc');
  await writeFile(file, 'non-zip Office content');
  assert.equal(await generateMarkdown(file), 'local conversion');
  assert.deepEqual(globalThis.localFirstCalls[0], {
    ocr: false,
    extractAttachments: false,
    allowRemoteAssets: false,
  });
  globalThis.localFirstError = true;
  await assert.rejects(generateMarkdown(file), /parser failure/);
  await writeFile(file, '');
  await assert.rejects(generateMarkdown(file), /zero bytes/);
});
