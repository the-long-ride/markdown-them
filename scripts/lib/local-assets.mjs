import { cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('../../', import.meta.url));

export async function copyLocalAssets(assetsDir, pdfWorkerPath) {
  await cp(path.join(rootDir, 'assets', 'fonts'), path.join(assetsDir, 'fonts'), {
    recursive: true,
  });
  const pdfRoot = path.resolve(path.dirname(pdfWorkerPath), '..');
  for (const folder of ['cmaps', 'wasm']) {
    await cp(path.join(pdfRoot, folder), path.join(assetsDir, folder), { recursive: true });
  }
}
