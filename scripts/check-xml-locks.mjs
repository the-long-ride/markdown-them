import { readFileSync } from 'node:fs';

const MIN_MAJOR = 5;
const MIN_MINOR = 12;
function patched(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const [, major, minor] = match.map(Number);
  return major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR);
}
function validateNpmLock() {
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const installed = lock.packages?.['node_modules/fast-xml-parser']?.version;
  if (!patched(installed)) {
    throw new Error(`package-lock.json has vulnerable fast-xml-parser: ${installed || 'missing'}`);
  }
  console.log(`npm lockfile: fast-xml-parser ${installed} is patched`);
}
function validatePnpmLock() {
  const lock = readFileSync('pnpm-lock.yaml', 'utf8');
  const found = [...lock.matchAll(/^  fast-xml-parser@(\d+\.\d+\.\d+):/gm)].map((m) => m[1]);
  if (found.length === 0 || found.some((v) => !patched(v))) {
    throw new Error(
      `pnpm-lock.yaml contains vulnerable fast-xml-parser: ${found.join(', ') || 'missing'}`,
    );
  }
  console.log(`pnpm lockfile: fast-xml-parser ${found.join(', ')} is patched`);
}
validateNpmLock();
validatePnpmLock();
