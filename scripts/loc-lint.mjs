import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import {
  countPhysicalLines,
  looksArtificiallyCompressed,
  sourceLimit,
} from './lib/source-policy.mjs';

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'Unable to list tracked files.\n');
    process.exit(result.status ?? 1);
  }
  return result.stdout.split('\0').filter(Boolean);
}

const failures = [];
for (const file of trackedFiles()) {
  if (!existsSync(file)) continue;
  const limit = sourceLimit(file);
  if (limit === null) continue;

  const text = readFileSync(file, 'utf8');
  const lines = countPhysicalLines(text);
  if (lines > limit) {
    failures.push(`${file}: ${lines} lines (limit ${limit})`);
  }
  if (looksArtificiallyCompressed(text)) {
    failures.push(`${file}: source appears artificially compressed`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('lint:loc ok');
