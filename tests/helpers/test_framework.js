/**
 * Lightweight, zero-dependency Test Runner & Assertion Framework
 * Supports describe/test/it, async tests, lifecycle hooks, and standalone/runner execution.
 */

const assert = require('node:assert/strict');

class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  it(name, fn) {
    this.test(name, fn);
  }

  beforeEach(fn) {
    this.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    this.afterEachHooks.push(fn);
  }

  async run(verbose = true) {
    let passed = 0;
    let failed = 0;
    const failures = [];
    const startTime = Date.now();

    if (verbose) {
      console.log(`\n\x1b[1m\x1b[36m▶ Suite: ${this.name}\x1b[0m (\x1b[33m${this.tests.length} tests\x1b[0m)`);
    }

    for (let i = 0; i < this.tests.length; i++) {
      const t = this.tests[i];
      try {
        for (const hook of this.beforeEachHooks) {
          await hook();
        }
        await t.fn();
        for (const hook of this.afterEachHooks) {
          await hook();
        }
        passed++;
        if (verbose) {
          console.log(`  \x1b[32m✔\x1b[0m [${i + 1}/${this.tests.length}] ${t.name}`);
        }
      } catch (err) {
        failed++;
        failures.push({ testName: t.name, error: err });
        if (verbose) {
          console.log(`  \x1b[31m✖\x1b[0m [${i + 1}/${this.tests.length}] \x1b[1m${t.name}\x1b[0m`);
          console.log(`    \x1b[31mError:\x1b[0m ${err.message}`);
          if (err.stack) {
            const cleanStack = err.stack.split('\n').slice(1, 3).map(l => '   ' + l.trim()).join('\n');
            console.log(`\x1b[90m${cleanStack}\x1b[0m`);
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      suiteName: this.name,
      total: this.tests.length,
      passed,
      failed,
      failures,
      durationMs
    };
  }
}

module.exports = {
  TestSuite,
  assert
};
