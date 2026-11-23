#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { globSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

const COVERAGE_THRESHOLD = 0;
const VARIANT_MINIMUM = 90;
const threshold = Math.max(COVERAGE_THRESHOLD, VARIANT_MINIMUM);
const variants = new Map([
  ['core', 'out/core/**/*.js'],
  ['nodejs-package', 'nodejs-package/dist/nodejs-package/**/*.js'],
  ['vscode', 'out/vscode/**/*.js'],
  ['app', 'out/app/**/*.js'],
  ['shared', 'out/shared/**/*.js'],
]);
const metrics = ['lines', 'functions', 'branches', 'statements'];

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync(path.join(root, 'out/app'), { recursive: true, force: true });
await build({
  absWorkingDir: root,
  entryPoints: globSync(['src/app/**/*.ts', 'src/app/**/*.tsx'], {
    cwd: root,
    exclude: ['**/*.d.ts'],
  }),
  outbase: 'src',
  outdir: 'out',
  tsconfig: 'tsconfig.app.json',
  jsx: 'automatic',
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  sourcemap: true,
});

const cliDir = path.join(root, 'nodejs-package/dist');
rmSync(cliDir, { recursive: true, force: true });
run(require.resolve('typescript/lib/tsc.js'), ['-p', 'tsconfig.node-package.json', '--sourceMap']);

const c8Args = [
  '--all',
  ...[...variants.values()].flatMap((pattern) => ['--include', pattern]),
  // These files only declare TypeScript types; emitted module markers have no behavior.
  ...[
    'out/core/document-types.js',
    'out/app/app-types.js',
    'out/app/desktop-api.js',
    'out/app/context/language-types.js',
  ].flatMap((pattern) => ['--exclude', pattern]),
  '--reporter',
  'text',
  '--reporter',
  'json-summary',
  '--reporter',
  'lcov',
  process.execPath,
  '--test',
  'tests/unit/*.test.mjs',
  'tests/legacy-office.test.mjs',
];

console.log('\x1b[1m\x1b[36mRunning full test suite with code coverage...\x1b[0m\n');
run(require.resolve('c8/bin/c8.js'), c8Args);

const { total, ...files } = JSON.parse(
  readFileSync(path.join(root, 'coverage/coverage-summary.json'), 'utf8'),
);
console.log('\nTypeScript coverage (minimum %d%% per metric)', threshold);
console.log('Variant\t\tLines\tFunctions\tBranches\tStatements');
let passed = true;
for (const name of [...variants.keys(), 'overall']) {
  const reports =
    name === 'overall'
      ? [total]
      : Object.entries(files)
          .filter(([file]) => {
            const relative = path.relative(root, file).replaceAll(path.sep, '/');
            return relative.startsWith(`src/${name}/`);
          })
          .map(([, report]) => report);
  const percentages = metrics.map((metric) => {
    const covered = reports.reduce((sum, report) => sum + report[metric].covered, 0);
    const count = reports.reduce((sum, report) => sum + report[metric].total, 0);
    if (count === 0) {
      passed = false;
      return 'unmeasured';
    }
    if (covered * 100 < threshold * count) passed = false;
    return ((covered * 100) / count).toFixed(2);
  });
  console.log(`${name.padEnd(16)} ${percentages.join('\t')}`);
}

if (!passed) process.exit(1);
console.log('\x1b[32m✔ Code coverage verified successfully.\x1b[0m');
