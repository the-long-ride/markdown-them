/**
 * Tier 5: CLI Automated Integration Test Suite
 *
 * Validates command-line execution, argument parsing, recursive/top-level directory
 * conversions, default output resolution, collision disambiguation, graceful skipping
 * of unsupported files, dual packaging (CJS & ESM), and multi-target repository invariants.
 *
 * Architecture: Zero external test runners, zero external shell dependencies.
 * Uses child_process.execFile with process.execPath for deterministic cross-platform execution.
 */

import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import {
  assert,
  assertEqual,
  assertNotEqual,
  assertContains,
  assertNotContains,
  assertMatches,
  assertTruthy,
  assertGreaterThan,
} from '../framework/assertions.mjs';

import { generateDocx, generateHtml, generateTxt } from '../fixtures/fixture-generator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const cliScriptPath = path.resolve(repoRoot, 'nodejs-package/dist/nodejs-package/cli.js');
const packageJsonPath = path.resolve(repoRoot, 'nodejs-package/package.json');
const require = createRequire(import.meta.url);

if (!fsSync.existsSync(cliScriptPath)) {
  const isCmd = process.platform === 'win32';
  const npmCmd = isCmd ? 'npm.cmd' : 'npm';
  try {
    execFileSync(npmCmd, ['run', 'build:node-package'], {
      cwd: repoRoot,
      stdio: 'pipe',
      shell: isCmd,
      env: { ...process.env },
    });
  } catch (err) {
    console.error('Failed to build nodejs-package before running Tier 5 CLI tests:', err);
  }
}

/**
 * Execute the built CLI using child_process.execFile with process.execPath.
 * Returns { code, stdout, stderr, error }
 */
function runCli(args, options = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [cliScriptPath, ...args],
      {
        cwd: options.cwd || repoRoot,
        timeout: options.timeout || 30000,
        env: { ...process.env, ...options.env },
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === 'number' ? error.code : error ? 1 : 0;
        resolve({
          code: exitCode,
          stdout: stdout ? stdout.toString() : '',
          stderr: stderr ? stderr.toString() : '',
          error,
        });
      },
    );
  });
}

/**
 * Register Tier 5 CLI Automated Integration Tests into the test harness.
 */
export function registerTier5(harness) {
  harness.suite('Tier 5: CLI Automated Integration Suite', () => {
    let tmpDir;
    let pkgVersion;

    harness.beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier5-cli-'));
      const pkgContent = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      pkgVersion = pkg.version || '1.3.2';
    });

    harness.afterAll(async () => {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    // =========================================================================
    // MATRIX 1: CLI Flags & Basic Invocation
    // =========================================================================
    harness.suite('Matrix 1: CLI Flags & Basic Invocation', () => {
      harness.test(
        'Flag: --help displays usage, options, default behavior, and exits 0',
        async () => {
          const res = await runCli(['--help']);
          assertEqual(res.code, 0, 'Expected exit code 0 for --help');
          assertContains(
            res.stdout,
            `mdthem v${pkgVersion}`,
            'Help output must include application name and version',
          );
          assertContains(res.stdout, 'Usage:', 'Help output must include usage instructions');
          assertContains(
            res.stdout,
            '-s, --source <path>',
            'Help output must list -s / --source option',
          );
          assertContains(
            res.stdout,
            '-d, --destination <path>',
            'Help output must list -d / --destination option',
          );
          assertContains(
            res.stdout,
            '-a, --all, -all',
            'Help output must list recursive directory flags',
          );
          assertContains(res.stdout, '-h, --help', 'Help output must list -h / --help option');
          assertContains(
            res.stdout,
            '-v, --version',
            'Help output must list -v / --version option',
          );
          assertContains(
            res.stdout,
            'Default Output Behavior:',
            'Help output must describe default behaviors',
          );
        },
      );

      harness.test('Flag: -h displays help message and exits 0', async () => {
        const res = await runCli(['-h']);
        assertEqual(res.code, 0, 'Expected exit code 0 for -h');
        assertContains(res.stdout, `mdthem v${pkgVersion}`, 'Short flag -h must print help banner');
        assertContains(
          res.stdout,
          '-s, --source <path>',
          'Short flag -h must show option descriptions',
        );
      });

      harness.test('Flag: --version prints version matching package.json and exits 0', async () => {
        const res = await runCli(['--version']);
        assertEqual(res.code, 0, 'Expected exit code 0 for --version');
        assertEqual(
          res.stdout.trim(),
          pkgVersion,
          'Version output must match nodejs-package/package.json version',
        );
      });

      harness.test('Flag: -v prints version matching package.json and exits 0', async () => {
        const res = await runCli(['-v']);
        assertEqual(res.code, 0, 'Expected exit code 0 for -v');
        assertEqual(
          res.stdout.trim(),
          pkgVersion,
          'Short flag -v must match nodejs-package/package.json version',
        );
      });

      harness.test(
        'Error: Invocation without arguments fails with code 1 and required message',
        async () => {
          const res = await runCli([]);
          assertEqual(res.code, 1, 'Expected exit code 1 when no arguments provided');
          assertContains(
            res.stderr,
            'Missing required argument: -s, --source <path>',
            'Stderr must identify missing source argument',
          );
          assertContains(
            res.stderr,
            'Run "mdthem --help" for usage information.',
            'Stderr must direct user to help',
          );
        },
      );

      harness.test('Error: Trailing -s flag without value fails with code 1', async () => {
        const res = await runCli(['-s']);
        assertEqual(res.code, 1, 'Expected exit code 1 when -s has no value');
        assertContains(
          res.stderr,
          'Missing required argument: -s, --source <path>',
          'Stderr must report missing argument value',
        );
      });

      harness.test('Error: Trailing -d flag without value fails with code 1', async () => {
        const testFile = path.join(tmpDir, 'm1_dummy_d.txt');
        await fs.writeFile(testFile, 'sample text', 'utf-8');
        const res = await runCli(['-s', testFile, '-d']);
        assertEqual(res.code, 1, 'Expected exit code 1 when -d has no value');
        assertContains(
          res.stderr,
          'Missing value for option: -d, --destination <path>',
          'Stderr must report missing destination value',
        );
      });

      harness.test(
        'Error: Non-existent source path fails with code 1 and informative error',
        async () => {
          const nonExistentPath = path.join(tmpDir, 'does-not-exist-' + Date.now() + '.docx');
          const res = await runCli(['-s', nonExistentPath]);
          assertEqual(res.code, 1, 'Expected exit code 1 for non-existent source');
          assertContains(
            res.stderr,
            'Source path does not exist',
            'Stderr must specify that source path does not exist',
          );
        },
      );

      harness.test('Error: Unknown command line option fails with code 1', async () => {
        const testFile = path.join(tmpDir, 'm1_dummy.txt');
        await fs.writeFile(testFile, 'sample text', 'utf-8');
        const res = await runCli(['-s', testFile, '--unrecognized-custom-flag']);
        assertEqual(res.code, 1, 'Expected exit code 1 for unrecognized flag');
        assertContains(
          res.stderr,
          'Unknown option: --unrecognized-custom-flag',
          'Stderr must identify the unknown flag',
        );
      });
    });

    // =========================================================================
    // MATRIX 2: Single File Conversion & Destination Resolution
    // =========================================================================
    harness.suite('Matrix 2: Single File Conversion & Destination Resolution', () => {
      let m2Dir;

      harness.beforeAll(async () => {
        m2Dir = path.join(tmpDir, 'matrix2');
        await fs.mkdir(m2Dir, { recursive: true });
      });

      harness.test(
        'Explicit destination file: Converts .docx to specified -d <file.md>',
        async () => {
          const srcFile = path.join(m2Dir, 'document.docx');
          const destFile = path.join(m2Dir, 'custom-output.md');
          const docxBuf = await generateDocx({
            title: 'Architecture Specification',
            paragraphs: ['Markdown-them CLI production validation.'],
          });
          await fs.writeFile(srcFile, docxBuf);

          const res = await runCli(['-s', srcFile, '-d', destFile]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);
          const exists = await fs
            .stat(destFile)
            .then(() => true)
            .catch(() => false);
          assertTruthy(exists, 'Explicit destination file must exist on disk');

          const content = await fs.readFile(destFile, 'utf-8');
          assertContains(
            content,
            'Architecture Specification',
            'Output markdown must contain document title',
          );
          assertContains(
            content,
            'Markdown-them CLI production validation.',
            'Output markdown must contain document body',
          );
        },
      );

      harness.test(
        'Default destination: Converts <dir>/<stem>.docx to <dir>/<stem>.md when -d is omitted',
        async () => {
          const subFolder = path.join(m2Dir, 'default_dest_test');
          await fs.mkdir(subFolder, { recursive: true });
          const srcFile = path.join(subFolder, 'quarterly-report.docx');
          const expectedMd = path.join(subFolder, 'quarterly-report.md');

          const docxBuf = await generateDocx({
            title: 'Quarterly Financial Analysis',
            paragraphs: ['Revenue increased by 24% year-over-year.'],
          });
          await fs.writeFile(srcFile, docxBuf);

          const res = await runCli(['-s', srcFile]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);
          const exists = await fs
            .stat(expectedMd)
            .then(() => true)
            .catch(() => false);
          assertTruthy(exists, 'Expected default output <dir>/<stem>.md to exist');

          const content = await fs.readFile(expectedMd, 'utf-8');
          assertContains(
            content,
            'Quarterly Financial Analysis',
            'Generated markdown must contain document heading',
          );
        },
      );

      harness.test(
        '.md input file: Suffices _converted.md to prevent in-place file overwrite',
        async () => {
          const subFolder = path.join(m2Dir, 'md_input_test');
          await fs.mkdir(subFolder, { recursive: true });
          const srcMd = path.join(subFolder, 'release_notes.md');
          const expectedConvertedMd = path.join(subFolder, 'release_notes_converted.md');
          const initialContent = '# Release Notes v1.0\n\n- Feature A\n- Feature B';
          await fs.writeFile(srcMd, initialContent, 'utf-8');

          const res = await runCli(['-s', srcMd]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);
          const convertedExists = await fs
            .stat(expectedConvertedMd)
            .then(() => true)
            .catch(() => false);
          assertTruthy(convertedExists, 'Expected release_notes_converted.md to be created');

          const originalContent = await fs.readFile(srcMd, 'utf-8');
          assertEqual(
            originalContent,
            initialContent,
            'Original .md file must remain intact and not overwritten',
          );

          const convertedContent = await fs.readFile(expectedConvertedMd, 'utf-8');
          assertContains(
            convertedContent,
            'Release Notes v1.0',
            'Converted markdown must preserve content',
          );
        },
      );

      harness.test(
        'Auto-mkdir: Automatically creates nested non-existent destination directory',
        async () => {
          const srcFile = path.join(m2Dir, 'nested_src.html');
          const deeplyNestedDest = path.join(
            m2Dir,
            'deep',
            'nested',
            'folder',
            'structure',
            'result.md',
          );
          const htmlBuf = generateHtml({
            heading: 'Deep Directory Auto-Creation',
            paragraphs: ['Verifying recursive directory creation before writing.'],
          });
          await fs.writeFile(srcFile, htmlBuf);

          const res = await runCli(['-s', srcFile, '-d', deeplyNestedDest]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);
          const exists = await fs
            .stat(deeplyNestedDest)
            .then(() => true)
            .catch(() => false);
          assertTruthy(
            exists,
            'Deeply nested output file must exist after auto-creation of intermediate folders',
          );

          const content = await fs.readFile(deeplyNestedDest, 'utf-8');
          assertContains(
            content,
            'Deep Directory Auto-Creation',
            'Markdown content must match input HTML heading',
          );
        },
      );

      harness.test(
        '.markdown input file: Suffices _converted.md to prevent in-place file overwrite',
        async () => {
          const subFolder = path.join(m2Dir, 'markdown_input_test');
          await fs.mkdir(subFolder, { recursive: true });
          const srcMarkdown = path.join(subFolder, 'documentation.markdown');
          const expectedConvertedMd = path.join(subFolder, 'documentation_converted.md');
          const initialContent = '# Documentation\n\nParagraph text.';
          await fs.writeFile(srcMarkdown, initialContent, 'utf-8');

          const res = await runCli(['-s', srcMarkdown]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);
          const convertedExists = await fs
            .stat(expectedConvertedMd)
            .then(() => true)
            .catch(() => false);
          assertTruthy(convertedExists, 'Expected documentation_converted.md to be created');

          const originalContent = await fs.readFile(srcMarkdown, 'utf-8');
          assertEqual(
            originalContent,
            initialContent,
            'Original .markdown file must remain intact and not overwritten',
          );

          const convertedContent = await fs.readFile(expectedConvertedMd, 'utf-8');
          assertContains(
            convertedContent,
            'Documentation',
            'Converted markdown must preserve content',
          );
        },
      );

      harness.test(
        'Destination directory: Outputs <dest_dir>/<stem>.md when -d is a directory with trailing slash',
        async () => {
          const srcFile = path.join(m2Dir, 'slash_test.txt');
          const targetDir = path.join(m2Dir, 'out_with_slash');
          await fs.writeFile(srcFile, 'Plain text payload for directory destination.', 'utf-8');

          const destWithSlash = targetDir + path.sep;
          const res = await runCli(['-s', srcFile, '-d', destWithSlash]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);
          const expectedFile = path.join(targetDir, 'slash_test.md');
          const exists = await fs
            .stat(expectedFile)
            .then(() => true)
            .catch(() => false);
          assertTruthy(
            exists,
            'File should be created inside destination directory with original stem name',
          );
        },
      );

      harness.test(
        'Destination directory: Handles quoted directory destination with trailing slash',
        async () => {
          const srcFile = path.join(m2Dir, 'quoted_slash_test.txt');
          const targetDir = path.join(m2Dir, 'quoted_out_dir');
          await fs.writeFile(srcFile, 'Quoted destination test payload.', 'utf-8');

          const quotedDestWithSlash = `"${targetDir}/"`;
          const res = await runCli(['-s', srcFile, '-d', quotedDestWithSlash]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);
          const expectedFile = path.join(targetDir, 'quoted_slash_test.md');
          const exists = await fs
            .stat(expectedFile)
            .then(() => true)
            .catch(() => false);
          assertTruthy(
            exists,
            'File should be created inside quoted directory destination with trailing slash',
          );
        },
      );
    });

    // =========================================================================
    // MATRIX 3: Directory Top-Level Conversion Without -a / --all
    // =========================================================================
    harness.suite('Matrix 3: Directory Top-Level Conversion Without -a / --all', () => {
      let m3SrcDir;

      harness.beforeAll(async () => {
        m3SrcDir = path.join(tmpDir, 'matrix3_src');
        const subDir = path.join(m3SrcDir, 'nested_sub');
        await fs.mkdir(subDir, { recursive: true });

        // Top-level supported files
        await fs.writeFile(
          path.join(m3SrcDir, 'top1.docx'),
          await generateDocx({ title: 'Top 1 Title' }),
        );
        await fs.writeFile(
          path.join(m3SrcDir, 'top2.html'),
          generateHtml({ heading: 'Top 2 Heading' }),
        );
        await fs.writeFile(path.join(m3SrcDir, 'top3.txt'), 'Top 3 text content', 'utf-8');

        // Subdirectory files (must be EXCLUDED in non-recursive mode)
        await fs.writeFile(
          path.join(subDir, 'nested1.docx'),
          await generateDocx({ title: 'Nested 1 Title' }),
        );
        await fs.writeFile(path.join(subDir, 'nested2.txt'), 'Nested 2 text content', 'utf-8');
      });

      harness.test(
        'Default destination: Outputs to <source>/results/ and excludes subfolders',
        async () => {
          const res = await runCli(['-s', m3SrcDir]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);

          const resultsDir = path.join(m3SrcDir, 'results');
          const resultsExist = await fs
            .stat(resultsDir)
            .then(() => true)
            .catch(() => false);
          assertTruthy(resultsExist, 'Default results directory must be auto-created');

          // Top-level files must be converted
          const top1Md = path.join(resultsDir, 'top1.md');
          const top2Md = path.join(resultsDir, 'top2.md');
          const top3Md = path.join(resultsDir, 'top3.md');
          assertTruthy(
            await fs
              .stat(top1Md)
              .then(() => true)
              .catch(() => false),
            'top1.md must exist in results',
          );
          assertTruthy(
            await fs
              .stat(top2Md)
              .then(() => true)
              .catch(() => false),
            'top2.md must exist in results',
          );
          assertTruthy(
            await fs
              .stat(top3Md)
              .then(() => true)
              .catch(() => false),
            'top3.md must exist in results',
          );

          // Nested subfolder files must NOT be converted
          const nested1Md = path.join(resultsDir, 'nested1.md');
          const nested2Md = path.join(resultsDir, 'nested2.md');
          assertTruthy(
            !(await fs
              .stat(nested1Md)
              .then(() => true)
              .catch(() => false)),
            'nested1.md must NOT exist in non-recursive mode',
          );
          assertTruthy(
            !(await fs
              .stat(nested2Md)
              .then(() => true)
              .catch(() => false)),
            'nested2.md must NOT exist in non-recursive mode',
          );
        },
      );

      harness.test(
        'Explicit destination: Converts top-level files to -d <dest_dir> and excludes subfolders',
        async () => {
          const customDest = path.join(tmpDir, 'matrix3_custom_out');
          const res = await runCli(['-s', m3SrcDir, '-d', customDest]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);

          assertTruthy(
            await fs
              .stat(path.join(customDest, 'top1.md'))
              .then(() => true)
              .catch(() => false),
            'top1.md must exist in custom dest',
          );
          assertTruthy(
            await fs
              .stat(path.join(customDest, 'top2.md'))
              .then(() => true)
              .catch(() => false),
            'top2.md must exist in custom dest',
          );
          assertTruthy(
            await fs
              .stat(path.join(customDest, 'top3.md'))
              .then(() => true)
              .catch(() => false),
            'top3.md must exist in custom dest',
          );
          assertTruthy(
            !(await fs
              .stat(path.join(customDest, 'nested1.md'))
              .then(() => true)
              .catch(() => false)),
            'nested files must be excluded',
          );
        },
      );
    });

    // =========================================================================
    // MATRIX 4: Directory Recursive Conversion
    // =========================================================================
    harness.suite('Matrix 4: Directory Recursive Conversion', () => {
      let m4SrcDir;

      harness.beforeAll(async () => {
        m4SrcDir = path.join(tmpDir, 'matrix4_src');
        const branchA = path.join(m4SrcDir, 'dept_a');
        const branchB = path.join(m4SrcDir, 'dept_b', 'team_1');
        const gitDir = path.join(m4SrcDir, '.git');
        const nodeModulesDir = path.join(m4SrcDir, 'node_modules');

        await fs.mkdir(branchA, { recursive: true });
        await fs.mkdir(branchB, { recursive: true });
        await fs.mkdir(gitDir, { recursive: true });
        await fs.mkdir(nodeModulesDir, { recursive: true });

        // Root file
        await fs.writeFile(path.join(m4SrcDir, 'root_readme.txt'), 'Root readme content', 'utf-8');
        // Department A file
        await fs.writeFile(
          path.join(branchA, 'plan_a.html'),
          generateHtml({ heading: 'Department A Plan' }),
        );
        // Department B nested file
        await fs.writeFile(
          path.join(branchB, 'spec_b.docx'),
          await generateDocx({ title: 'Team 1 Technical Spec' }),
        );

        // Internal ignored directories (.git, node_modules)
        await fs.writeFile(path.join(gitDir, 'HEAD.txt'), 'ref: refs/heads/main', 'utf-8');
        await fs.writeFile(path.join(nodeModulesDir, 'package.json'), '{}', 'utf-8');
      });

      harness.test(
        'Flag: -a enables recursive conversion across all nested subdirectories',
        async () => {
          const destA = path.join(tmpDir, 'matrix4_out_short_a');
          const res = await runCli(['-s', m4SrcDir, '-a', '-d', destA]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);

          assertTruthy(
            await fs
              .stat(path.join(destA, 'root_readme.md'))
              .then(() => true)
              .catch(() => false),
            'root_readme.md must exist',
          );
          assertTruthy(
            await fs
              .stat(path.join(destA, 'plan_a.md'))
              .then(() => true)
              .catch(() => false),
            'plan_a.md from dept_a must exist',
          );
          assertTruthy(
            await fs
              .stat(path.join(destA, 'spec_b.md'))
              .then(() => true)
              .catch(() => false),
            'spec_b.md from dept_b/team_1 must exist',
          );

          // Verify .git and node_modules are skipped
          assertTruthy(
            !(await fs
              .stat(path.join(destA, 'HEAD.md'))
              .then(() => true)
              .catch(() => false)),
            '.git directory must be skipped',
          );
        },
      );

      harness.test(
        'Flag: --all enables recursive conversion across all nested subdirectories',
        async () => {
          const destAll = path.join(tmpDir, 'matrix4_out_long_all');
          const res = await runCli(['-s', m4SrcDir, '--all', '-d', destAll]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);

          assertTruthy(
            await fs
              .stat(path.join(destAll, 'root_readme.md'))
              .then(() => true)
              .catch(() => false),
            'root_readme.md must exist',
          );
          assertTruthy(
            await fs
              .stat(path.join(destAll, 'plan_a.md'))
              .then(() => true)
              .catch(() => false),
            'plan_a.md must exist',
          );
          assertTruthy(
            await fs
              .stat(path.join(destAll, 'spec_b.md'))
              .then(() => true)
              .catch(() => false),
            'spec_b.md must exist',
          );
        },
      );

      harness.test('Flag: -all (alias) enables recursive conversion', async () => {
        const destAlias = path.join(tmpDir, 'matrix4_out_alias_all');
        const res = await runCli(['-s', m4SrcDir, '-all', '-d', destAlias]);
        assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);

        assertTruthy(
          await fs
            .stat(path.join(destAlias, 'plan_a.md'))
            .then(() => true)
            .catch(() => false),
          'plan_a.md must exist',
        );
        assertTruthy(
          await fs
            .stat(path.join(destAlias, 'spec_b.md'))
            .then(() => true)
            .catch(() => false),
          'spec_b.md must exist',
        );
      });

      harness.test(
        'Flag-ordering resilience: Handles mdthem -s -all <folder> -d <dest>',
        async () => {
          const destOrder1 = path.join(tmpDir, 'matrix4_out_order1');
          const res = await runCli(['-s', '-all', m4SrcDir, '-d', destOrder1]);
          assertEqual(
            res.code,
            0,
            `Expected exit 0 with tricky flag ordering. Stderr: ${res.stderr}`,
          );

          assertTruthy(
            await fs
              .stat(path.join(destOrder1, 'spec_b.md'))
              .then(() => true)
              .catch(() => false),
            'spec_b.md must exist with -s -all <folder>',
          );
        },
      );

      harness.test(
        'Flag-ordering resilience: Handles mdthem -s --all <folder> -d <dest>',
        async () => {
          const destOrder2 = path.join(tmpDir, 'matrix4_out_order2');
          const res = await runCli(['-s', '--all', m4SrcDir, '-d', destOrder2]);
          assertEqual(
            res.code,
            0,
            `Expected exit 0 with tricky flag ordering. Stderr: ${res.stderr}`,
          );

          assertTruthy(
            await fs
              .stat(path.join(destOrder2, 'spec_b.md'))
              .then(() => true)
              .catch(() => false),
            'spec_b.md must exist with -s --all <folder>',
          );
        },
      );

      harness.test(
        'Recursive with default destination: Outputs to <source>/results/ avoiding self-scan loop',
        async () => {
          const selfScanDir = path.join(tmpDir, 'matrix4_selfscan');
          const sub = path.join(selfScanDir, 'sub');
          await fs.mkdir(sub, { recursive: true });
          await fs.writeFile(path.join(sub, 'item.txt'), 'Self-scan test item', 'utf-8');

          // First run creates <selfScanDir>/results/item.md
          const res1 = await runCli(['-s', selfScanDir, '-a']);
          assertEqual(res1.code, 0, `Run 1 failed: ${res1.stderr}`);
          const resultsItemMd = path.join(selfScanDir, 'results', 'item.md');
          assertTruthy(
            await fs
              .stat(resultsItemMd)
              .then(() => true)
              .catch(() => false),
            'results/item.md must exist',
          );

          // Second run must NOT enter results/ or create results/results or infinite recursion
          const res2 = await runCli(['-s', selfScanDir, '-a']);
          assertEqual(res2.code, 0, `Run 2 failed: ${res2.stderr}`);
          const nestedResultsDir = path.join(selfScanDir, 'results', 'results');
          assertTruthy(
            !(await fs
              .stat(nestedResultsDir)
              .then(() => true)
              .catch(() => false)),
            'results directory must be excluded from recursive scan',
          );
        },
      );
    });

    // =========================================================================
    // MATRIX 5: File Filtering & Unsupported File Skipping
    // =========================================================================
    harness.suite('Matrix 5: File Filtering & Unsupported File Skipping', () => {
      let m5SrcDir;
      let m5DestDir;

      harness.beforeAll(async () => {
        m5SrcDir = path.join(tmpDir, 'matrix5_src');
        m5DestDir = path.join(tmpDir, 'matrix5_out');
        await fs.mkdir(m5SrcDir, { recursive: true });

        // Supported files
        await fs.writeFile(
          path.join(m5SrcDir, 'valid_doc.docx'),
          await generateDocx({ title: 'Valid Document' }),
        );
        await fs.writeFile(
          path.join(m5SrcDir, 'valid_page.html'),
          generateHtml({ heading: 'Valid Page' }),
        );
        await fs.writeFile(path.join(m5SrcDir, 'valid_notes.txt'), 'Valid notes content', 'utf-8');

        // Unsupported binary and executable files
        await fs.writeFile(
          path.join(m5SrcDir, 'picture.png'),
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
        await fs.writeFile(
          path.join(m5SrcDir, 'binary_app.exe'),
          Buffer.from('MZfakebinaryexecutable'),
        );
        await fs.writeFile(
          path.join(m5SrcDir, 'data_dump.bin'),
          Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]),
        );
        await fs.writeFile(path.join(m5SrcDir, 'library.dll'), Buffer.from('fake dll bytes'));
        await fs.writeFile(path.join(m5SrcDir, 'archive.zip'), Buffer.from('fake zip bytes'));
      });

      harness.test(
        'Filtering: Unsupported files (.png, .exe, .bin, .dll, .zip) are skipped without crashing',
        async () => {
          const res = await runCli(['-s', m5SrcDir, '-d', m5DestDir]);
          assertEqual(res.code, 0, `Expected clean exit 0. Stderr: ${res.stderr}`);

          // Supported files must exist
          assertTruthy(
            await fs
              .stat(path.join(m5DestDir, 'valid_doc.md'))
              .then(() => true)
              .catch(() => false),
            'valid_doc.md must exist',
          );
          assertTruthy(
            await fs
              .stat(path.join(m5DestDir, 'valid_page.md'))
              .then(() => true)
              .catch(() => false),
            'valid_page.md must exist',
          );
          assertTruthy(
            await fs
              .stat(path.join(m5DestDir, 'valid_notes.md'))
              .then(() => true)
              .catch(() => false),
            'valid_notes.md must exist',
          );

          // Unsupported files must NOT have generated markdown outputs
          assertTruthy(
            !(await fs
              .stat(path.join(m5DestDir, 'picture.md'))
              .then(() => true)
              .catch(() => false)),
            'picture.png must not be converted',
          );
          assertTruthy(
            !(await fs
              .stat(path.join(m5DestDir, 'binary_app.md'))
              .then(() => true)
              .catch(() => false)),
            'binary_app.exe must not be converted',
          );
          assertTruthy(
            !(await fs
              .stat(path.join(m5DestDir, 'data_dump.md'))
              .then(() => true)
              .catch(() => false)),
            'data_dump.bin must not be converted',
          );
          assertTruthy(
            !(await fs
              .stat(path.join(m5DestDir, 'library.md'))
              .then(() => true)
              .catch(() => false)),
            'library.dll must not be converted',
          );

          // Console summary must accurately report skipped files
          assertContains(res.stdout, 'skipped', 'Summary must report skipped count');
          assertContains(res.stdout, '3 converted', 'Summary must report 3 converted files');
          assertContains(res.stdout, '5 skipped', 'Summary must report 5 skipped files');
          assertContains(res.stdout, '0 failed', 'Summary must report 0 failed files');
        },
      );
    });

    // =========================================================================
    // MATRIX 6: Collision Disambiguation Across Subdirectories
    // =========================================================================
    harness.suite('Matrix 6: Collision Disambiguation Across Subdirectories', () => {
      let m6SrcDir;
      let m6DestDir;

      harness.beforeAll(async () => {
        m6SrcDir = path.join(tmpDir, 'matrix6_src');
        m6DestDir = path.join(tmpDir, 'matrix6_out');
        const dirNorth = path.join(m6SrcDir, 'region_north');
        const dirSouth = path.join(m6SrcDir, 'region_south');
        const dirWest = path.join(m6SrcDir, 'region_west');

        await fs.mkdir(dirNorth, { recursive: true });
        await fs.mkdir(dirSouth, { recursive: true });
        await fs.mkdir(dirWest, { recursive: true });

        // Identical file names with different content across directories
        await fs.writeFile(
          path.join(dirNorth, 'summary.docx'),
          await generateDocx({
            title: 'North Region Financial Summary',
            paragraphs: ['North operational profit: $1.2M'],
          }),
        );
        await fs.writeFile(
          path.join(dirSouth, 'summary.docx'),
          await generateDocx({
            title: 'South Region Financial Summary',
            paragraphs: ['South operational profit: $3.4M'],
          }),
        );
        await fs.writeFile(
          path.join(dirWest, 'summary.docx'),
          await generateDocx({
            title: 'West Region Financial Summary',
            paragraphs: ['West operational profit: $2.1M'],
          }),
        );
      });

      harness.test(
        'Disambiguation: Generates summary.md, summary-2.md, summary-3.md preserving all contents',
        async () => {
          const res = await runCli(['-s', m6SrcDir, '-a', '-d', m6DestDir]);
          assertEqual(res.code, 0, `Expected clean exit 0. Stderr: ${res.stderr}`);

          const file1 = path.join(m6DestDir, 'summary.md');
          const file2 = path.join(m6DestDir, 'summary-2.md');
          const file3 = path.join(m6DestDir, 'summary-3.md');

          assertTruthy(
            await fs
              .stat(file1)
              .then(() => true)
              .catch(() => false),
            'summary.md must exist',
          );
          assertTruthy(
            await fs
              .stat(file2)
              .then(() => true)
              .catch(() => false),
            'summary-2.md must exist',
          );
          assertTruthy(
            await fs
              .stat(file3)
              .then(() => true)
              .catch(() => false),
            'summary-3.md must exist',
          );

          // Verify that all 3 distinct document contents are preserved without overwrite
          const c1 = await fs.readFile(file1, 'utf-8');
          const c2 = await fs.readFile(file2, 'utf-8');
          const c3 = await fs.readFile(file3, 'utf-8');
          const combined = `${c1}\n${c2}\n${c3}`;

          assertContains(
            combined,
            'North Region Financial Summary',
            'North summary content must be present in one file',
          );
          assertContains(
            combined,
            'South Region Financial Summary',
            'South summary content must be present in one file',
          );
          assertContains(
            combined,
            'West Region Financial Summary',
            'West summary content must be present in one file',
          );
        },
      );

      harness.test(
        'Pre-existing collision: Disambiguates when destination directory already contains conflicting file',
        async () => {
          const preCollisionDir = path.join(tmpDir, 'matrix6_pre_exist');
          const preDestDir = path.join(tmpDir, 'matrix6_pre_dest');
          await fs.mkdir(preCollisionDir, { recursive: true });
          await fs.mkdir(preDestDir, { recursive: true });

          // Pre-create existing output file in destination
          await fs.writeFile(
            path.join(preDestDir, 'data.md'),
            'Pre-existing output file content',
            'utf-8',
          );

          // Source directory containing conflicting file name
          await fs.writeFile(
            path.join(preCollisionDir, 'data.txt'),
            'Fresh incoming data payload',
            'utf-8',
          );

          const res = await runCli(['-s', preCollisionDir, '-d', preDestDir]);
          assertEqual(res.code, 0, `Expected exit 0. Stderr: ${res.stderr}`);

          // Original file must NOT be overwritten
          const originalContent = await fs.readFile(path.join(preDestDir, 'data.md'), 'utf-8');
          assertEqual(
            originalContent,
            'Pre-existing output file content',
            'Original data.md must remain untouched',
          );

          // New file must be disambiguated as data-2.md
          const disambiguated = path.join(preDestDir, 'data-2.md');
          assertTruthy(
            await fs
              .stat(disambiguated)
              .then(() => true)
              .catch(() => false),
            'data-2.md must be generated',
          );
          const freshContent = await fs.readFile(disambiguated, 'utf-8');
          assertContains(
            freshContent,
            'Fresh incoming data payload',
            'New file must contain fresh data',
          );
        },
      );
    });

    // =========================================================================
    // MATRIX 7: Dual Library & Packaging Verification
    // =========================================================================
    harness.suite('Matrix 7: Dual Library & Packaging Verification', () => {
      harness.test(
        'Package manifest: Contains required bin, main, types, and name fields',
        async () => {
          const pkgContent = await fs.readFile(packageJsonPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);

          assertEqual(
            pkg.name,
            '@the-long-ride/markdown-them',
            'Package name must match specification',
          );
          assertEqual(
            pkg.bin?.mdthem,
            './dist/nodejs-package/cli.js',
            'Bin field must map mdthem to ./dist/nodejs-package/cli.js',
          );
          assertEqual(
            pkg.main,
            './dist/nodejs-package/index.js',
            'Main entry must point to dist index.js',
          );
          assertEqual(
            pkg.types,
            './dist/nodejs-package/index.d.ts',
            'Types entry must point to dist index.d.ts',
          );
        },
      );

      harness.test(
        'Shebang: Line 1 of CLI entry point is exactly #!/usr/bin/env node',
        async () => {
          const cliContent = await fs.readFile(cliScriptPath, 'utf-8');
          const firstLine = cliContent.split(/\r?\n/)[0];
          assertEqual(
            firstLine,
            '#!/usr/bin/env node',
            'CLI executable must begin with node shebang on line 1',
          );
        },
      );

      harness.test(
        'CommonJS Import: require() imports library and core conversion functions',
        async () => {
          const indexPath = path.resolve(repoRoot, 'nodejs-package/dist/nodejs-package/index.js');
          const cjsLib = require(indexPath);

          assertEqual(
            typeof cjsLib.convertTextToMarkdown,
            'function',
            'CJS export convertTextToMarkdown must be a function',
          );
          assertEqual(
            typeof cjsLib.convertFileToMarkdown,
            'function',
            'CJS export convertFileToMarkdown must be a function',
          );
          assertEqual(
            typeof cjsLib.convertAndReturnMarkdown,
            'function',
            'CJS export convertAndReturnMarkdown must be a function',
          );
          assertEqual(
            typeof cjsLib.generateMarkdown,
            'function',
            'CJS export generateMarkdown must be a function',
          );
          assertEqual(
            typeof cjsLib.convertDirectory,
            'function',
            'CJS export convertDirectory must be a function',
          );
          assertEqual(
            typeof cjsLib.convertSingleFile,
            'function',
            'CJS export convertSingleFile must be a function',
          );
          assertEqual(
            typeof cjsLib.parseCliArgs,
            'function',
            'CJS export parseCliArgs must be a function',
          );
          assertEqual(
            typeof cjsLib.isSupportedFileName,
            'function',
            'CJS export isSupportedFileName must be a function',
          );

          // Functional check through CJS
          const mdResult = cjsLib.convertTextToMarkdown('# CJS Header\n\nBody text');
          assertEqual(
            mdResult.trim(),
            '# CJS Header\n\nBody text',
            'convertTextToMarkdown must process text correctly',
          );

          const isDocxSupported = cjsLib.isSupportedFileName('sample.docx');
          assertEqual(isDocxSupported, true, 'isSupportedFileName must recognize .docx');
          const isExeSupported = cjsLib.isSupportedFileName('sample.exe');
          assertEqual(isExeSupported, false, 'isSupportedFileName must reject .exe');

          // Parse CLI args through CJS
          const parsed = cjsLib.parseCliArgs(['-s', 'my_folder', '-a', '-d', 'out_folder']);
          assertEqual(parsed.source, 'my_folder', 'parseCliArgs must parse source');
          assertEqual(parsed.destination, 'out_folder', 'parseCliArgs must parse destination');
          assertEqual(parsed.all, true, 'parseCliArgs must parse recursive flag');

          // Check inferOutputPath behavior
          assertEqual(
            cjsLib.inferOutputPath('C:/folder/doc.docx'),
            path.normalize('C:/folder/doc.md'),
            'inferOutputPath standard doc',
          );
          assertEqual(
            cjsLib.inferOutputPath('C:/folder/notes.md'),
            path.normalize('C:/folder/notes_converted.md'),
            'inferOutputPath .md',
          );
          assertEqual(
            cjsLib.inferOutputPath('C:/folder/readme.markdown'),
            path.normalize('C:/folder/readme_converted.md'),
            'inferOutputPath .markdown',
          );
        },
      );

      harness.test(
        'ESM Import: Dynamic import() loads library and executes conversion',
        async () => {
          const indexPath = path.resolve(repoRoot, 'nodejs-package/dist/nodejs-package/index.js');
          const esmLib = await import(pathToFileURL(indexPath).href);

          assertEqual(
            typeof esmLib.convertTextToMarkdown,
            'function',
            'ESM named export convertTextToMarkdown must be a function',
          );
          assertEqual(
            typeof esmLib.convertAndReturnMarkdown,
            'function',
            'ESM named export convertAndReturnMarkdown must be a function',
          );

          const sampleTxt = path.join(tmpDir, 'esm_sample.txt');
          await fs.writeFile(sampleTxt, 'ESM text file conversion test.', 'utf-8');
          const res = await esmLib.convertAndReturnMarkdown(sampleTxt);
          assertContains(
            res,
            'ESM text file conversion test.',
            'convertAndReturnMarkdown must return markdown via ESM',
          );
        },
      );
    });

    // =========================================================================
    // MATRIX 8: Multi-Target Invariant Checks
    // =========================================================================
    harness.suite('Matrix 8: Multi-Target Invariant Checks', () => {
      harness.test(
        'VS Code Extension: Extension manifest and entry point remain intact',
        async () => {
          const rootPkgContent = await fs.readFile(path.join(repoRoot, 'package.json'), 'utf-8');
          const rootPkg = JSON.parse(rootPkgContent);

          assertEqual(
            rootPkg.displayName,
            'Markdown Them',
            'Root package.json displayName must be preserved',
          );
          assertTruthy(
            Array.isArray(rootPkg.contributes?.commands),
            'Contributed commands array must exist',
          );
          const cmdIds = rootPkg.contributes.commands.map((c) => c.command);
          assertContains(
            cmdIds,
            'markdown-them.convertToMarkdown',
            'convertToMarkdown command must be registered',
          );
          assertContains(
            cmdIds,
            'markdown-them.convertCurrentToMarkdown',
            'convertCurrentToMarkdown command must be registered',
          );

          const extensionTsExists = await fs
            .stat(path.join(repoRoot, 'src/vscode/extension.ts'))
            .then(() => true)
            .catch(() => false);
          assertTruthy(extensionTsExists, 'VS Code extension.ts must exist');
        },
      );

      harness.test(
        'Tauri Desktop App: Cargo.toml and tauri.conf.json configuration remain valid',
        async () => {
          const cargoPath = path.join(repoRoot, 'src-tauri/Cargo.toml');
          const cargoExists = await fs
            .stat(cargoPath)
            .then(() => true)
            .catch(() => false);
          assertTruthy(cargoExists, 'src-tauri/Cargo.toml must exist');

          const cargoContent = await fs.readFile(cargoPath, 'utf-8');
          assertContains(cargoContent, '[package]', 'Cargo.toml must have [package] header');

          const tauriConfPath = path.join(repoRoot, 'src-tauri/tauri.conf.json');
          const tauriConfExists = await fs
            .stat(tauriConfPath)
            .then(() => true)
            .catch(() => false);
          assertTruthy(tauriConfExists, 'src-tauri/tauri.conf.json must exist');

          const tauriConfContent = await fs.readFile(tauriConfPath, 'utf-8');
          const tauriConf = JSON.parse(tauriConfContent);
          assertTruthy(tauriConf.productName, 'tauri.conf.json must specify productName');
        },
      );

      harness.test('Web Application: Build scripts and web entry points remain valid', async () => {
        const buildAppsPath = path.join(repoRoot, 'scripts/build-apps.mjs');
        assertTruthy(
          await fs
            .stat(buildAppsPath)
            .then(() => true)
            .catch(() => false),
          'scripts/build-apps.mjs must exist',
        );

        const appIndexPath = path.join(repoRoot, 'src/app/index.html');
        assertTruthy(
          await fs
            .stat(appIndexPath)
            .then(() => true)
            .catch(() => false),
          'src/app/index.html must exist',
        );

        const appTsxPath = path.join(repoRoot, 'src/app/App.tsx');
        assertTruthy(
          await fs
            .stat(appTsxPath)
            .then(() => true)
            .catch(() => false),
          'src/app/App.tsx must exist',
        );
      });

      harness.test(
        'Dependency Security: nodejs-package has zero unvetted runtime dependencies',
        async () => {
          const pkgContent = await fs.readFile(packageJsonPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          const deps = Object.keys(pkg.dependencies || {});

          const allowedDependencies = new Set([
            '@opendocsg/pdf2md',
            'fast-xml-parser',
            'jszip',
            'mammoth',
            'officeparser',
            'turndown',
          ]);

          for (const dep of deps) {
            assertTruthy(
              allowedDependencies.has(dep),
              `Disallowed or unvetted dependency found in nodejs-package: ${dep}`,
            );
          }
        },
      );
    });
  });
}

export const registerTier5Tests = registerTier5;
