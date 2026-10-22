'use strict';
const fs = require('node:fs');
const path = require('node:path');
class SummaryReporter {
  constructor() { this.started = Date.now(); this.errors = []; }
  onBegin(config, suite) { this.suite = suite; this.started = Date.now(); }
  onError(error) { this.errors.push(error.message || String(error)); console.error(error.message || error); }
  onTestEnd(test, result) {
    if (result.status !== 'passed') console.error(`FAIL ${test.title}\n${result.errors.map(e => e.message).join('\n')}`);
  }
  onEnd(result) {
    const tests = (this.suite?.allTests() || []).map(test => ({name: test.title, outcome: test.outcome(),
      durationMs: test.results.reduce((n, r) => n + r.duration, 0)}));
    const summary = {status: result.status, passed: tests.filter(t => t.outcome === 'expected').length,
      failed: tests.filter(t => ['unexpected', 'flaky'].includes(t.outcome)).length,
      skipped: tests.filter(t => t.outcome === 'skipped').length, durationMs: Date.now() - this.started, errors: this.errors, tests};
    fs.writeFileSync(path.join(process.env.BANDIT_BROWSER_ARTIFACTS, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(`Browser tests: ${summary.status} · ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped (${(summary.durationMs / 1000).toFixed(1)}s)`);
  }
}
module.exports = SummaryReporter;
