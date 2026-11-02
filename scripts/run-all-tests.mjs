#!/usr/bin/env node
/**
 * Unified Test Suite Orchestrator
 *
 * Runs all validation pipelines in optimal order with parallel execution:
 * Stage 1 (Fast Parallel Gates):
 *   - Cargo format check (`cargo fmt --check`)
 *   - Prettier code style check (`prettier --check`)
 *   - LOC lint limit checks (`scripts/loc-lint.mjs`)
 *   - TypeScript typechecks (`tsc -p ./` & `tsc -p ./tsconfig.app.json`)
 *
 * Stage 2 (Parallel Test Suites):
 *   - Tauri Rust backend tests (`cargo test`)
 *   - End-to-end multi-format & condition coverage suite (`scripts/test-coverage.mjs`)
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function runStep(name, command, args) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const isCmd =
      process.platform === 'win32' &&
      (command === 'npm' || command === 'npx' || command === 'pnpm');
    const child = spawn(command, args, {
      cwd: root,
      shell: isCmd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      if (code === 0) {
        console.log(`\x1b[32m✔ [PASS]\x1b[0m \x1b[1m${name}\x1b[0m \x1b[90m(${duration}s)\x1b[0m`);
        resolve({ name, duration, success: true });
      } else {
        console.error(
          `\x1b[31m✖ [FAIL]\x1b[0m \x1b[1m${name}\x1b[0m \x1b[90m(${duration}s)\x1b[0m`,
        );
        if (stdout.trim()) console.error(`\x1b[90m${stdout.trim()}\x1b[0m`);
        if (stderr.trim()) console.error(`\x1b[31m${stderr.trim()}\x1b[0m`);
        reject(new Error(`Step failed: ${name} (exit code ${code})`));
      }
    });

    child.on('error', (err) => {
      console.error(`\x1b[31m✖ [ERROR]\x1b[0m \x1b[1m${name}\x1b[0m: ${err.message}`);
      reject(err);
    });
  });
}

async function main() {
  const totalStart = Date.now();

  console.log(
    '\x1b[1m\x1b[36m================================================================\x1b[0m',
  );
  console.log(
    '\x1b[1m\x1b[36m       MARKDOWN THEM — UNIFIED TEST SUITE ORCHESTRATOR         \x1b[0m',
  );
  console.log(
    '\x1b[1m\x1b[36m================================================================\x1b[0m',
  );
  console.log(`Execution Mode : Parallel Staged Validation`);
  console.log(`Node Runtime   : ${process.version} on ${process.platform} (${process.arch})`);
  console.log(`Timestamp      : ${new Date().toISOString()}\n`);

  console.log('\x1b[1m► Stage 1: Fast Parallel Verification (Format, Style, Types, LOC)\x1b[0m');
  const stage1Steps = [
    runStep('Cargo Format Check', 'cargo', [
      'fmt',
      '--manifest-path',
      'src-tauri/Cargo.toml',
      '--',
      '--check',
    ]),
    runStep('Prettier Style Check', 'npx', ['prettier', '--check', '.']),
    runStep('LOC Limit Lint Check', process.execPath, ['scripts/loc-lint.mjs']),
    runStep('TypeScript Core & Apps Typecheck', 'npm', ['run', 'typecheck:apps']),
    runStep('TypeScript Root Compilation', 'npm', ['run', 'compile']),
  ];

  await Promise.all(stage1Steps);

  console.log('\n\x1b[1m► Stage 2: Parallel Full Test Suites (Rust & Node.js Coverage)\x1b[0m');
  const stage2Steps = [
    runStep('Tauri Rust Backend Tests', 'cargo', [
      'test',
      '--manifest-path',
      'src-tauri/Cargo.toml',
    ]),
    runStep('Node.js E2E & Condition Coverage Suite', process.execPath, [
      'scripts/test-coverage.mjs',
    ]),
  ];

  await Promise.all(stage2Steps);

  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(2);
  console.log(
    '\n\x1b[1m\x1b[32m================================================================\x1b[0m',
  );
  console.log(`\x1b[1m\x1b[32m✔ ALL PIPELINES PASSED SUCCESSFULLY (${totalDuration}s)\x1b[0m`);
  console.log(
    '\x1b[1m\x1b[32m================================================================\x1b[0m\n',
  );
}

main().catch((err) => {
  console.error('\n\x1b[1m\x1b[31mPipeline aborted due to failure:\x1b[0m', err.message);
  process.exit(1);
});
