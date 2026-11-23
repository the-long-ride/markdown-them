import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { generateMarkdown } from '../framework/conversion-adapter.mjs';
import fixtures from '../fixtures/real-files.json' with { type: 'json' };

export function registerRealFileTests(harness) {
  const originals = process.env.MARKDOWN_THEM_ORIGINALS;
  let bundle;
  let tmpDir;

  harness.suite('Real documents from the manual test', () => {
    harness.beforeAll(async () => {
      bundle = await JSZip.loadAsync(
        await fs.readFile(new URL('../fixtures/real-files.zip', import.meta.url)),
      );
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-real-files-'));
    });
    harness.afterAll(async () => fs.rm(tmpDir, { recursive: true, force: true }));

    for (const { name, bytes, sha256, external, section, expected } of fixtures) {
      if (external && !originals) {
        harness.skip(`${name} (requires MARKDOWN_THEM_ORIGINALS)`);
        continue;
      }
      harness.test(name, async () => {
        const data = external
          ? await fs.readFile(path.join(originals, name))
          : await bundle.file(name)?.async('nodebuffer');
        assert.ok(data, `Missing fixture: ${name}`);
        assert.equal(data.byteLength, bytes, `Unexpected length: ${name}`);
        assert.equal(
          createHash('sha256').update(data).digest('hex'),
          sha256,
          `Changed fixture: ${name}`,
        );

        const input = path.join(tmpDir, name);
        await fs.writeFile(input, data);
        const markdown = await generateMarkdown(input);
        const content = section
          ? markdown.split(section.separator).find((part) => part.includes(section.heading))
          : markdown;
        assert.ok(content, `Missing section: ${section?.heading ?? name}`);
        for (const snippet of expected) {
          assert.ok(content.includes(snippet), `Missing Markdown: ${snippet}`);
        }
      });
    }
  });
}
