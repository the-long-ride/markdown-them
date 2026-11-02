/**
 * Tier 3: Cross-Feature Combinations E2E Tests
 * Validates heterogeneous batches containing mixed file formats, fault isolation
 * during batch processing (partial failures), and state isolation across multiple runs.
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
import { convertBatch } from '../framework/conversion-adapter.mjs';
import {
  generateDocx,
  generatePdf,
  generateXlsx,
  generatePptx,
  generateOdt,
  generateRtf,
  generateHtml,
  generateTxt,
  generateCorruptZip,
  generateZeroByte,
} from '../fixtures/fixture-generator.mjs';

export function registerTier3Tests(harness) {
  harness.suite('Tier 3: Cross-Feature Combinations (Mixed Batches)', () => {
    let tmpDir;
    let outDir;

    harness.beforeAll(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier3-src-'));
      outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-tier3-out-'));
    });

    harness.afterAll(async () => {
      if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
      if (outDir) await fs.rm(outDir, { recursive: true, force: true });
    });

    // 1. Heterogeneous batch
    harness.test(
      'Heterogeneous Batch: Converts all 8 formats in a single batch operation',
      async () => {
        const files = [
          {
            name: 'batch_doc.docx',
            buf: await generateDocx({ title: 'Batch DOCX Title', paragraphs: ['Content in docx'] }),
          },
          {
            name: 'batch_pdf.pdf',
            buf: generatePdf({ text: 'Batch PDF Title', lines: ['Content in pdf'] }),
          },
          {
            name: 'batch_sheet.xlsx',
            buf: await generateXlsx({
              sheetName: 'BatchSheet',
              headers: ['A', 'B'],
              rows: [['V1', 'V2']],
            }),
          },
          {
            name: 'batch_slide.pptx',
            buf: await generatePptx({
              slides: [{ title: 'Batch PPTX Title', items: ['Bullet point'] }],
            }),
          },
          {
            name: 'batch_text.odt',
            buf: await generateOdt({ heading: 'Batch ODT Title', paragraphs: ['Content in odt'] }),
          },
          {
            name: 'batch_rtf.rtf',
            buf: generateRtf({ title: 'Batch RTF Title', paragraphs: ['Content in rtf'] }),
          },
          {
            name: 'batch_page.html',
            buf: generateHtml({ heading: 'Batch HTML Title', paragraphs: ['Content in html'] }),
          },
          {
            name: 'batch_notes.txt',
            buf: generateTxt({ heading: 'Batch TXT Title', paragraphs: ['Content in txt'] }),
          },
        ];

        const inputPaths = [];
        for (const item of files) {
          const filePath = path.join(tmpDir, item.name);
          await fs.writeFile(filePath, item.buf);
          inputPaths.push(filePath);
        }

        const results = await convertBatch(inputPaths, { outputFolder: outDir, concurrency: 4 });
        assertEqual(
          results.length,
          files.length,
          'All files must be accounted for in batch results',
        );

        for (const res of results) {
          assertEqual(
            res.status,
            'done',
            `File ${res.name} must convert with status 'done'. Error: ${res.error}`,
          );
          assertTruthy(res.outputPath, `File ${res.name} must have an outputPath`);
          const content = await fs.readFile(res.outputPath, 'utf-8');
          assertGreaterThan(content.length, 0, `Output file for ${res.name} must not be empty`);
        }
      },
    );

    // 2. Fault Isolation in Mixed Valid + Corrupted Batch
    harness.test(
      'Fault Isolation: Corrupted files fail without aborting valid conversions',
      async () => {
        const faultDir = path.join(tmpDir, 'fault_test');
        await fs.mkdir(faultDir, { recursive: true });

        const files = [
          {
            name: 'valid_1.html',
            buf: generateHtml({ heading: 'Valid File 1' }),
            shouldPass: true,
          },
          { name: 'corrupt_1.docx', buf: generateCorruptZip(), shouldPass: false },
          { name: 'valid_2.txt', buf: generateTxt({ heading: 'Valid File 2' }), shouldPass: true },
          { name: 'corrupt_2.pdf', buf: generateZeroByte(), shouldPass: false },
          {
            name: 'valid_3.xlsx',
            buf: await generateXlsx({ headers: ['Col'], rows: [['Val']] }),
            shouldPass: true,
          },
          { name: 'corrupt_3.xlsx', buf: generateCorruptZip(), shouldPass: false },
          { name: 'valid_4.rtf', buf: generateRtf({ title: 'Valid File 4' }), shouldPass: true },
        ];

        const inputPaths = [];
        for (const f of files) {
          const fp = path.join(faultDir, f.name);
          await fs.writeFile(fp, f.buf);
          inputPaths.push(fp);
        }

        const results = await convertBatch(inputPaths, { concurrency: 2 });
        assertEqual(results.length, files.length, 'Batch results must match total submitted files');

        const validResults = results.filter((r) => r.status === 'done');
        const errorResults = results.filter((r) => r.status === 'error');

        assertEqual(validResults.length, 4, 'Exactly 4 valid files must succeed');
        assertEqual(errorResults.length, 3, 'Exactly 3 corrupted files must fail');

        // Verify that every valid file actually produced a markdown file on disk
        for (const vr of validResults) {
          const exists = await fs
            .stat(vr.outputPath)
            .then(() => true)
            .catch(() => false);
          assert(exists, `Output file for valid input ${vr.name} must exist on disk`);
        }

        // Verify that error results contain descriptive error messages
        for (const er of errorResults) {
          assertTruthy(er.error, `Error result for ${er.name} must contain an error description`);
        }
      },
    );

    // 3. State Isolation across multiple runs
    harness.test(
      'State Isolation: Subsequent conversion runs produce identical clean outputs',
      async () => {
        const stateDir = path.join(tmpDir, 'state_test');
        await fs.mkdir(stateDir, { recursive: true });

        const docxPath = path.join(stateDir, 'repeat.docx');
        await fs.writeFile(
          docxPath,
          await generateDocx({ title: 'Repeat Test Title', paragraphs: ['Body'] }),
        );

        const run1Results = await convertBatch([docxPath]);
        const run2Results = await convertBatch([docxPath]);

        assertEqual(run1Results[0].status, 'done');
        assertEqual(run2Results[0].status, 'done');

        const md1 = await fs.readFile(run1Results[0].outputPath, 'utf-8');
        const md2 = await fs.readFile(run2Results[0].outputPath, 'utf-8');
        assertEqual(
          md1,
          md2,
          'Consecutive conversions of the same document must yield identical outputs',
        );
      },
    );

    // 4. Dedicated Output Directory
    harness.test(
      'Output Folder Targeting: Writes all converted markdown to designated output directory',
      async () => {
        const dedicatedTargetDir = path.join(outDir, 'dedicated_subfolder');
        await fs.mkdir(dedicatedTargetDir, { recursive: true });

        const samplePath = path.join(tmpDir, 'target_test.html');
        await fs.writeFile(samplePath, generateHtml({ heading: 'Target Directory Test' }));

        const results = await convertBatch([samplePath], { outputFolder: dedicatedTargetDir });
        assertEqual(results[0].status, 'done');
        const expectedDir = path.resolve(dedicatedTargetDir);
        const actualDir = path.resolve(path.dirname(results[0].outputPath));
        assertEqual(actualDir, expectedDir, 'Output file must reside in specified target folder');
      },
    );
  });
}
