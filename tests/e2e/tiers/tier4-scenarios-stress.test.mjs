/**
 * Tier 4: Real-World Application Scenarios E2E Tests
 * Validates concurrency limits (parallel worker pools), collision-free output naming,
 * large payload stress, and progress event tracking.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  assert,
  assertEqual,
  assertContains,
  assertGreaterThan,
  assertTruthy,
} from '../framework/assertions.mjs';
import {
  convertBatch,
  resolveOutputPaths,
  uniqueOutputName,
} from '../framework/conversion-adapter.mjs';
import {
  generateDocx,
  generateXlsx,
  generatePptx,
  generateHtml,
  generateTxt,
} from '../fixtures/fixture-generator.mjs';

export function registerTier4Tests(harness) {
  harness.suite('Tier 4: Real-World Application Scenarios (Concurrency & Stress)', () => {
    let tmpDir;
    let outDir;

    harness.beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier4-src-'));
      outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier4-out-'));
    });

    harness.afterAll(async () => {
      if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
      if (outDir) await fs.rm(outDir, { recursive: true, force: true });
    });

    // 1. Collision-Free Naming Resolution
    harness.test(
      'Collision-Free Naming: Disambiguates identical file names to prevent overwrite',
      async () => {
        const collisionDir = path.join(outDir, 'collision_test');
        await fs.mkdir(collisionDir, { recursive: true });

        // Create 4 files in different subdirectories with identical base names
        const subDirs = ['sub1', 'sub2', 'sub3', 'sub4'];
        const filePaths = [];

        for (let i = 0; i < subDirs.length; i++) {
          const subDirPath = path.join(tmpDir, subDirs[i]);
          await fs.mkdir(subDirPath, { recursive: true });
          const filePath = path.join(subDirPath, 'analysis.docx');
          const buf = await generateDocx({
            title: `Analysis from ${subDirs[i]}`,
            paragraphs: [`Unique payload ${i + 1}`],
          });
          await fs.writeFile(filePath, buf);
          filePaths.push(filePath);
        }

        // Convert all 4 to the same destination output folder
        const results = await convertBatch(filePaths, { outputFolder: collisionDir });
        assertEqual(results.length, 4, 'Must process all 4 files');

        const outputFiles = results.map((r) => path.basename(r.outputPath));
        assertEqual(outputFiles[0], 'analysis.md', 'First file gets base name');
        assertEqual(outputFiles[1], 'analysis-2.md', 'Second duplicate gets -2 suffix');
        assertEqual(outputFiles[2], 'analysis-3.md', 'Third duplicate gets -3 suffix');
        assertEqual(outputFiles[3], 'analysis-4.md', 'Fourth duplicate gets -4 suffix');

        // Verify that all 4 files actually exist on disk and preserve their unique content
        for (let i = 0; i < results.length; i++) {
          const res = results[i];
          const content = await fs.readFile(res.outputPath, 'utf-8');
          assertContains(
            content,
            `Analysis from ${subDirs[i]}`,
            `Output ${res.outputPath} must retain source ${subDirs[i]} content`,
          );
        }
      },
    );

    // 2. Concurrency Scalability: Parallel Pool Stress Test
    harness.test(
      'Parallel Concurrency: Correctly converts 16 files across concurrency levels (1, 4, 8)',
      async () => {
        const concurrencyTestDir = path.join(tmpDir, 'parallel_stress');
        await fs.mkdir(concurrencyTestDir, { recursive: true });

        // Create 16 files (mixed HTML, DOCX, TXT)
        const testFiles = [];
        for (let i = 0; i < 16; i++) {
          const fileName = `parallel_item_${i.toString().padStart(2, '0')}.html`;
          const filePath = path.join(concurrencyTestDir, fileName);
          const buf = generateHtml({
            heading: `Parallel Item ${i}`,
            paragraphs: [`Stress test payload for worker ${i}`],
          });
          await fs.writeFile(filePath, buf);
          testFiles.push(filePath);
        }

        // Test with concurrency = 1 (sequential)
        const resSeq = await convertBatch(testFiles.slice(0, 4), { concurrency: 1 });
        assertEqual(
          resSeq.filter((r) => r.status === 'done').length,
          4,
          'Sequential pool must succeed',
        );

        // Test with concurrency = 4 (default desktop pool)
        const resPool4 = await convertBatch(testFiles.slice(4, 10), { concurrency: 4 });
        assertEqual(
          resPool4.filter((r) => r.status === 'done').length,
          6,
          'Concurrency 4 pool must succeed',
        );

        // Test with concurrency = 8 (high parallel pool)
        const resPool8 = await convertBatch(testFiles.slice(10, 16), { concurrency: 8 });
        assertEqual(
          resPool8.filter((r) => r.status === 'done').length,
          6,
          'Concurrency 8 pool must succeed',
        );
      },
    );

    // 3. Progress Event Tracking
    harness.test('Progress Callback: Invoked for each task in batch execution', async () => {
      const progressDir = path.join(tmpDir, 'progress_test');
      await fs.mkdir(progressDir, { recursive: true });

      const files = [];
      for (let i = 0; i < 5; i++) {
        const fp = path.join(progressDir, `progress_${i}.txt`);
        await fs.writeFile(fp, generateTxt({ heading: `Progress ${i}` }));
        files.push(fp);
      }

      const progressEvents = [];
      const results = await convertBatch(files, {
        concurrency: 2,
        onProgress: (task) => {
          progressEvents.push({ name: task.name, status: task.status });
        },
      });

      assertEqual(results.length, 5);
      assertEqual(progressEvents.length, 5, 'Must trigger progress event for every file');
      for (const ev of progressEvents) {
        assertEqual(ev.status, 'done');
      }
    });

    // 4. Large Payload Stress Test (Large tables and multi-slide decks)
    harness.test(
      'Large Payloads: Handles multi-row table in XLSX and multi-slide PPTX without truncation',
      async () => {
        const largeDir = path.join(tmpDir, 'large_payloads');
        await fs.mkdir(largeDir, { recursive: true });

        // Generate 50-row XLSX table
        const rows = [];
        for (let r = 1; r <= 50; r++) {
          rows.push([`Product-${r}`, `${r * 100}`, `SKU-${1000 + r}`]);
        }
        const xlsxBuf = await generateXlsx({
          sheetName: 'LargeDataset',
          headers: ['ProductName', 'Quantity', 'SKUCode'],
          rows,
        });
        const xlsxPath = path.join(largeDir, 'large_dataset.xlsx');
        await fs.writeFile(xlsxPath, xlsxBuf);

        const xlsxResult = await convertBatch([xlsxPath]);
        assertEqual(xlsxResult[0].status, 'done');
        const xlsxContent = await fs.readFile(xlsxResult[0].outputPath, 'utf-8');
        assertContains(xlsxContent, 'Product-1', 'First row in large table must exist');
        assertContains(xlsxContent, 'Product-50', '50th row in large table must exist');
        assertContains(xlsxContent, 'SKU-1050', 'Last SKU in large table must exist');

        // Generate 5-slide PPTX deck
        const slides = [];
        for (let s = 1; s <= 5; s++) {
          slides.push({
            title: `Slide Deck Part ${s}`,
            items: [`Point A for slide ${s}`, `Point B for slide ${s}`],
          });
        }
        const pptxBuf = await generatePptx({ slides });
        const pptxPath = path.join(largeDir, 'presentation_deck.pptx');
        await fs.writeFile(pptxPath, pptxBuf);

        const pptxResult = await convertBatch([pptxPath]);
        assertEqual(pptxResult[0].status, 'done');
        const pptxContent = await fs.readFile(pptxResult[0].outputPath, 'utf-8');
        assertContains(pptxContent, 'Slide Deck Part 1', 'Slide 1 must exist');
        assertContains(pptxContent, 'Slide Deck Part 5', 'Slide 5 must exist');
        assertContains(pptxContent, 'Point B for slide 5', 'Slide 5 bullet point must exist');
      },
    );
  });
}
