/**
 * E2E Test Suite - Test Runner Harness
 * Provides suite/test definitions, life-cycle hooks, formatted console output, and status aggregation.
 */

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

export class TestHarness {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      tierFilter: null,
      ...options,
    };
    this.suites = [];
    this.currentSuite = null;
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
    };
  }

  suite(name, fn) {
    const parentSuite = this.currentSuite;
    const suiteObj = {
      name,
      tests: [],
      beforeAllHooks: [],
      afterAllHooks: [],
      beforeEachHooks: [],
      afterEachHooks: [],
      parent: parentSuite,
    };

    if (parentSuite) {
      parentSuite.tests.push({ type: 'suite', suite: suiteObj });
    } else {
      this.suites.push(suiteObj);
    }

    this.currentSuite = suiteObj;
    try {
      fn();
    } finally {
      this.currentSuite = parentSuite;
    }
  }

  test(name, fn) {
    if (!this.currentSuite) {
      this.suite('Default Suite', () => {
        this.currentSuite.tests.push({ type: 'test', name, fn, skipped: false });
      });
      return;
    }
    this.currentSuite.tests.push({ type: 'test', name, fn, skipped: false });
  }

  skip(name, fn) {
    if (!this.currentSuite) {
      this.suite('Default Suite', () => {
        this.currentSuite.tests.push({ type: 'test', name, fn, skipped: true });
      });
      return;
    }
    this.currentSuite.tests.push({ type: 'test', name, fn, skipped: true });
  }

  beforeAll(fn) {
    if (this.currentSuite) this.currentSuite.beforeAllHooks.push(fn);
  }

  afterAll(fn) {
    if (this.currentSuite) this.currentSuite.afterAllHooks.push(fn);
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEachHooks.push(fn);
  }

  async runSuite(suite, indent = '  ') {
    console.log(`\n${indent}${colors.bold}${colors.cyan}► ${suite.name}${colors.reset}`);

    for (const hook of suite.beforeAllHooks) {
      await hook();
    }

    for (const entry of suite.tests) {
      if (entry.type === 'suite') {
        await this.runSuite(entry.suite, indent + '  ');
        continue;
      }

      this.stats.total += 1;
      const testName = entry.name;

      if (entry.skipped) {
        this.stats.skipped += 1;
        console.log(
          `${indent}  ${colors.yellow}○ [SKIP]${colors.reset} ${colors.dim}${testName}${colors.reset}`,
        );
        continue;
      }

      for (const hook of suite.beforeEachHooks) {
        await hook();
      }

      const start = performance.now();
      try {
        await entry.fn();
        const duration = Math.round(performance.now() - start);
        this.stats.passed += 1;
        const durText =
          duration > 100
            ? `${colors.yellow}(${duration}ms)${colors.reset}`
            : `${colors.gray}(${duration}ms)${colors.reset}`;
        console.log(`${indent}  ${colors.green}✓ [PASS]${colors.reset} ${testName} ${durText}`);
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        this.stats.failed += 1;
        console.log(
          `${indent}  ${colors.red}✗ [FAIL]${colors.reset} ${testName} ${colors.gray}(${duration}ms)${colors.reset}`,
        );
        console.log(
          `${indent}      ${colors.red}${err.name || 'Error'}: ${err.message}${colors.reset}`,
        );
        if (err.actual !== undefined && err.expected !== undefined) {
          console.log(
            `${indent}        Expected: ${colors.green}${JSON.stringify(err.expected)}${colors.reset}`,
          );
          console.log(
            `${indent}        Actual:   ${colors.red}${JSON.stringify(err.actual)}${colors.reset}`,
          );
        }
        if (this.options.verbose && err.stack) {
          console.log(
            `${indent}      ${colors.gray}${err.stack
              .split('\n')
              .slice(1, 5)
              .join('\n' + indent + '      ')}${colors.reset}`,
          );
        }
      } finally {
        for (const hook of suite.afterEachHooks) {
          try {
            await hook();
          } catch (e) {
            console.error(
              `${indent}      ${colors.red}afterEach hook failed: ${e.message}${colors.reset}`,
            );
          }
        }
      }
    }

    for (const hook of suite.afterAllHooks) {
      try {
        await hook();
      } catch (e) {
        console.error(
          `${indent}    ${colors.red}afterAll hook failed: ${e.message}${colors.reset}`,
        );
      }
    }
  }

  async run() {
    const overallStart = performance.now();
    for (const s of this.suites) {
      await this.runSuite(s);
    }
    this.stats.durationMs = Math.round(performance.now() - overallStart);
    return this.stats;
  }

  printSummary() {
    console.log(
      `\n${colors.bold}════════════════════════════════════════════════════════════════${colors.reset}`,
    );
    console.log(`${colors.bold}  E2E TEST SUITE EXECUTION SUMMARY${colors.reset}`);
    console.log(
      `${colors.bold}════════════════════════════════════════════════════════════════${colors.reset}`,
    );
    console.log(`  Total Tests : ${this.stats.total}`);
    console.log(`  ${colors.green}Passed      : ${this.stats.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed      : ${this.stats.failed}${colors.reset}`);
    console.log(`  ${colors.yellow}Skipped     : ${this.stats.skipped}${colors.reset}`);
    console.log(`  Duration    : ${(this.stats.durationMs / 1000).toFixed(2)}s`);
    console.log(
      `${colors.bold}════════════════════════════════════════════════════════════════${colors.reset}`,
    );

    if (this.stats.failed > 0) {
      console.log(
        `\n${colors.bold}${colors.red}OVERALL STATUS: FAILED (${this.stats.failed} test failure(s))${colors.reset}\n`,
      );
    } else {
      console.log(
        `\n${colors.bold}${colors.green}OVERALL STATUS: ALL TESTS PASSED SUCCESSFULLY!${colors.reset}\n`,
      );
    }
  }
}
