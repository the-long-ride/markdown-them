import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('end-to-end conversion and packaged CLI', () => {
  execFileSync(process.execPath, ['tests/e2e/run-e2e.mjs'], { stdio: 'inherit' });
});
