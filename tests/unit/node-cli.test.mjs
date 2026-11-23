import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import cli from '../../nodejs-package/dist/nodejs-package/cli.js';

async function scratch(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'mdthem-cli-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('parses both equals forms, escaped quotes, duplicates, and literal operands', () => {
  assert.deepEqual(cli.parseCliArgs(['-s="a.txt"', '-d=out.md', '-version', '-help']), {
    source: 'a.txt',
    destination: 'out.md',
    all: false,
    help: true,
    version: true,
    unknownArgs: [],
    pendingError: undefined,
  });
  assert.equal(cli.parseCliArgs(['--source=b.txt', '--destination=out']).destination, 'out');
  assert.equal(cli.parseCliArgs(['-s', '--', '-report.txt']).source, '-report.txt');
  assert.equal(
    cli.parseCliArgs(['-s', '-s', 'doc.txt']).pendingError,
    'Missing required argument: -s, --source <path>',
  );
  assert.match(cli.parseCliArgs(['-d', '-s', 'doc.txt']).pendingError, /Missing value for option/);
  assert.match(cli.parseCliArgs(['-s', '-d', 'out.md']).pendingError, /Missing required argument/);
  assert.match(cli.parseCliArgs(['-d', '-d', 'out.md']).pendingError, /Missing value for option/);
  const escaped = String.raw`\" 'two words.txt' \"`;
  assert.equal(cli.cleanPath(escaped), 'two words.txt');
  assert.equal(cli.cleanPath(undefined), '');
});

const bin = fileURLToPath(
  new URL('../../nodejs-package/dist/nodejs-package/cli.js', import.meta.url),
);
function run(args, dir) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: dir,
    env: { ...process.env, HOME: dir, USERPROFILE: dir },
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  return result;
}

test('handles invalid positionals and directory output failures', async (t) => {
  const dir = await scratch(t);
  const occupied = path.join(dir, 'output');
  await writeFile(occupied, 'existing');
  let result = run(['doc.txt', 'another.txt'], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected argument: another\.txt/);
  result = run(['-s', '.', '-d', occupied], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot create destination directory/);
  assert.equal(await readFile(occupied, 'utf8'), 'existing');
});

test('recursive scanning follows file links but handles loops and dangling links', async (t) => {
  const dir = await scratch(t);
  const source = path.join(dir, 'source');
  const external = path.join(dir, 'external.txt');
  await mkdir(source);
  await writeFile(external, 'Referenced content');
  await symlink(external, path.join(source, 'linked.txt'), 'file');
  await symlink(source, path.join(source, 'loop'), 'junction');
  await symlink(path.join(dir, 'absent'), path.join(source, 'dangling.txt'), 'file');
  assert.deepEqual(await cli.scanDirectory(source, true, path.join(source, 'results')), {
    supportedFiles: [path.join(source, 'linked.txt')],
    skippedFiles: [],
  });
  assert.deepEqual(await cli.scanDirectory(path.join(dir, 'absent'), true, dir), {
    supportedFiles: [],
    skippedFiles: [],
  });
});

test('skill install and uninstall only change managed files in an isolated home', async (t) => {
  const home = await scratch(t);
  const global = path.join(home, '.agents', 'skills', 'markdown-them', 'SKILL.md');
  const link = path.join(home, '.claude', 'skills', 'markdown-them');
  const skill = (...args) => run(['--skill', ...args], home);

  assert.match(skill('--skill').stderr, /exactly once/);
  assert.match(skill('--other').stderr, /Usage:/);
  assert.match(skill('unknown').stderr, /Unknown agent/);
  let result = skill('Claude');
  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(global, 'utf8'), /name: markdown-them/);
  assert.ok((await lstat(link)).isSymbolicLink());
  assert.match(skill('claude-code').stdout, /Already linked/);
  assert.match(skill('--uninstall', 'claude').stdout, /Removed managed/);
  await mkdir(link);
  assert.match(skill('claude').stderr, /Refusing to replace existing agent skill/);
  assert.equal((await lstat(link)).isDirectory(), true);

  await writeFile(global, 'unmanaged');
  assert.match(skill('codex').stderr, /Refusing to overwrite unmanaged skill/);
  assert.match(skill('--uninstall').stdout, /Preserved modified skill file/);
  assert.equal(await readFile(global, 'utf8'), 'unmanaged');
  await rm(global);
  await mkdir(global);
  assert.match(skill().stderr, /Cannot replace non-file skill/);
  await rm(global, { recursive: true });
  assert.equal(skill().status, 0);
  await writeFile(path.join(path.dirname(global), 'keep'), 'extra');
  result = skill('--uninstall');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Removed global skill/);
  assert.equal(await readFile(path.join(path.dirname(global), 'keep'), 'utf8'), 'extra');
});
