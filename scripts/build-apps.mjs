import * as esbuild from 'esbuild';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || 'all';
const production =
  process.argv.includes('--production') ||
  (process.env.NODE_ENV
    ? process.env.NODE_ENV === 'production'
    : !process.argv.includes('--development'));
const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf-8'));
const appVersion = String(packageJson.version || '0.0.0');
const sharedDefine = {
  MARKDOWN_THEM_VERSION: JSON.stringify(appVersion),
  'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
};

if (!['all', 'web', 'desktop'].includes(target)) {
  throw new Error(`Unknown build target: ${target}`);
}

if (['web', 'desktop', 'all'].includes(target)) {
  await buildWeb(path.join(rootDir, 'dist', 'web'));
}

async function buildWeb(outDir, clean = true) {
  if (clean) {
    await rm(outDir, { recursive: true, force: true });
  }

  const assetsDir = path.join(outDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  let html = await readFile(path.join(rootDir, 'src', 'app', 'index.html'), 'utf-8');
  html = html.replace(
    "connect-src 'none'",
    "connect-src 'self' http://localhost:* http://127.0.0.1:* ipc: http://ipc.localhost",
  );

  if (!production) {
    const devReloadJs = `(function() {
  try {
    const esc = new EventSource('/reload');
    esc.onmessage = function(event) {
      if (event.data === 'reload') {
        console.log('[Dev Reload] File change detected, reloading...');
        window.location.reload();
      }
    };
    esc.onerror = function() {
      console.warn('[Dev Reload] Reload stream disconnected. Retrying...');
    };
  } catch (err) {
    console.warn('[Dev Reload] EventSource unavailable:', err);
  }

  window.addEventListener('keydown', function(event) {
    if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && (event.key === 'r' || event.key === 'R'))) {
      event.preventDefault();
      window.location.reload();
    }
  });
})();
`;
    await writeFile(path.join(assetsDir, 'dev-reload.js'), devReloadJs);
    html = html.replace('</body>', '  <script src="./assets/dev-reload.js"></script>\n  </body>');
  }

  await writeFile(path.join(outDir, 'index.html'), html);
  await copyFile(
    path.join(rootDir, 'assets', 'markdown-them-logo.png'),
    path.join(assetsDir, 'markdown-them-logo.png'),
  );

  // Copy static SEO and manifest assets if present
  for (const staticFile of ['robots.txt', 'sitemap.xml', 'site.webmanifest']) {
    try {
      await copyFile(path.join(rootDir, 'src', 'app', staticFile), path.join(outDir, staticFile));
    } catch {
      // optional file
    }
  }

  let resolvedWorkerPath = null;
  try {
    const officeParserPath = require.resolve('officeparser');
    const officeReq = createRequire(officeParserPath);
    resolvedWorkerPath = officeReq.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
  } catch {
    // try fallback direct resolve
  }

  if (!resolvedWorkerPath) {
    try {
      resolvedWorkerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
    } catch {
      // try fallback paths
    }
  }

  if (!resolvedWorkerPath) {
    const workerCandidates = [
      path.join(
        rootDir,
        'node_modules',
        'officeparser',
        'node_modules',
        'pdfjs-dist',
        'build',
        'pdf.worker.min.mjs',
      ),
      path.join(rootDir, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
    ];
    for (const candidate of workerCandidates) {
      try {
        await readFile(candidate);
        resolvedWorkerPath = candidate;
        break;
      } catch {
        // try next candidate
      }
    }
  }

  if (!resolvedWorkerPath) {
    throw new Error('Could not locate pdf.worker.min.mjs in node_modules');
  }
  await copyFile(resolvedWorkerPath, path.join(assetsDir, 'pdf.worker.min.mjs'));

  await esbuild.build({
    bundle: true,
    conditions: ['browser'],
    define: sharedDefine,
    entryPoints: [path.join(rootDir, 'src', 'app', 'main.tsx')],
    format: 'iife',
    jsx: 'automatic',
    legalComments: 'none',
    mainFields: ['browser', 'module', 'main'],
    minify: production,
    outfile: path.join(assetsDir, 'app.js'),
    platform: 'browser',
    sourcemap: !production,
    target: ['chrome120', 'edge120', 'firefox120', 'safari17'],
  });
}
