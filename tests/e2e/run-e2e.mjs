#!/usr/bin/env node
/**
 * Markdown Them — E2E Test Suite Runner
 *
 * Usage:
 *   node tests/e2e/run-e2e.mjs              # Run all test tiers (Tiers 1 to 6)
 *   node tests/e2e/run-e2e.mjs --tier=1     # Run specific tier (1, 2, 3, 4, 5, or 6)
 *   node tests/e2e/run-e2e.mjs --verbose    # Enable verbose stack traces
 */

import { TestHarness } from './framework/test-harness.mjs';
import { registerTier1Tests } from './tiers/tier1-feature-coverage.test.mjs';
import { registerTier2Tests } from './tiers/tier2-boundary-corner.test.mjs';
import { registerTier3Tests } from './tiers/tier3-mixed-batches.test.mjs';
import { registerTier4Tests } from './tiers/tier4-scenarios-stress.test.mjs';
import { registerTier5Tests } from './tiers/tier5-cli.test.mjs';
import { registerTier6Tests } from './tiers/tier6-complex-documents.test.mjs';
import { registerTier7Tests } from './tiers/tier7-branch-coverage.test.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tier: null,
    verbose: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      const parsedTier = parseInt(arg.split('=')[1], 10);
      if (isNaN(parsedTier) || parsedTier < 1 || parsedTier > 7) {
        console.error(
          `\x1b[31mError: Invalid tier "${arg.split('=')[1]}". Expected integer between 1 and 7.\x1b[0m`,
        );
        process.exit(1);
      }
      options.tier = parsedTier;
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '-h' || arg === '--help') {
      console.log(`
Markdown Them — E2E Test Suite Runner

Options:
  --tier=<1|2|3|4|5|6|7> Run tests from a specific tier only
  --verbose, -v          Print verbose error traces
  --help, -h             Show this help screen
      `);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log(
    '\x1b[1m\x1b[36m================================================================\x1b[0m',
  );
  console.log(
    '\x1b[1m\x1b[36m       MARKDOWN THEM — END-TO-END AUTOMATED TEST RUNNER        \x1b[0m',
  );
  console.log(
    '\x1b[1m\x1b[36m================================================================\x1b[0m',
  );
  console.log(
    `Execution Mode : ${options.tier ? `Tier ${options.tier} Only` : 'Full Suite (Tiers 1 to 7)'}`,
  );
  console.log(`Node Runtime   : ${process.version} on ${process.platform} (${process.arch})`);
  console.log(`Timestamp      : ${new Date().toISOString()}`);

  const harness = new TestHarness({ verbose: options.verbose });

  if (!options.tier || options.tier === 1) {
    registerTier1Tests(harness);
  }
  if (!options.tier || options.tier === 2) {
    registerTier2Tests(harness);
  }
  if (!options.tier || options.tier === 3) {
    registerTier3Tests(harness);
  }
  if (!options.tier || options.tier === 4) {
    registerTier4Tests(harness);
  }
  if (!options.tier || options.tier === 5) {
    registerTier5Tests(harness);
  }
  if (!options.tier || options.tier === 6) {
    registerTier6Tests(harness);
  }
  if (!options.tier || options.tier === 7) {
    registerTier7Tests(harness);
  }

  const stats = await harness.run();
  harness.printSummary();

  const exitCode = stats.failed > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('\x1b[31mFatal error in E2E test runner:\x1b[0m', err);
  process.exit(1);
});
