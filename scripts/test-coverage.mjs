#!/usr/bin/env node
/**
 * Test Coverage Suite Runner
 * Runs the end-to-end and unit test suites with code coverage analysis using c8,
 * filtering to executable logic files while excluding pure models, enums, AST schemas,
 * and type declaration wrappers.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const c8Args = [
  '--include',
  'out/core/**',
  '--include',
  'out/nodejs-package/**',
  '--exclude',
  '**/types.js',
  '--exclude',
  '**/document-types.js',
  '--exclude',
  '**/office-ast.js',
  '--exclude',
  '**/formats.js',
  '--exclude',
  '**/*.d.ts',
  '--exclude',
  '**/*.test.*',
  '--exclude',
  '**/fixtures/**',
  '--reporter',
  'text',
  '--reporter',
  'json-summary',
  process.execPath,
  'tests/e2e/run-e2e.mjs',
];

console.log('\x1b[1m\x1b[36mRunning full test suite with code coverage...\x1b[0m\n');

const c8Bin = require.resolve('c8/bin/c8.js');
const result = spawnSync(process.execPath, [c8Bin, ...c8Args], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  env: { ...process.env },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('\x1b[32m✔ Code coverage verified successfully.\x1b[0m');
