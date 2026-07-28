#!/usr/bin/env node
/**
 * Lint regression gate.
 *
 * The repo carries a known, documented lint debt: 12 errors from the React
 * Compiler ruleset (react-hooks/set-state-in-effect and one
 * react-hooks/purity) across the components that fetch data in an effect.
 * The code is correct today; clearing them means restructuring every
 * data-loading component, which is its own piece of work.
 *
 * Failing CI on those forever would train everyone to ignore a red build.
 * Disabling the rules would hide real regressions — and lint had already
 * silently regressed from 115 problems to 127 before anyone noticed.
 *
 * So the gate is a budget: the current count is committed, and the build
 * fails the moment the count goes UP. Fixing problems and lowering the
 * budget is encouraged; the script tells you when you can.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BUDGET_FILE = new URL('./lint-budget.json', import.meta.url);
const budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));

let raw = '';
try {
  raw = execFileSync('npx', ['eslint', '.', '-f', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  // eslint exits non-zero when it finds problems; the JSON is still on stdout.
  raw = err.stdout ?? '';
  if (!raw) {
    console.error('[lint-budget] eslint produced no output:\n', err.stderr ?? err.message);
    process.exit(1);
  }
}

const results = JSON.parse(raw);
let errors = 0;
let warnings = 0;
const byRule = new Map();

for (const file of results) {
  for (const m of file.messages) {
    if (m.severity === 2) errors++;
    else warnings++;
    const key = `${m.severity === 2 ? 'error' : 'warn'}  ${m.ruleId ?? '(no rule)'}`;
    byRule.set(key, (byRule.get(key) ?? 0) + 1);
  }
}

console.log(`eslint: ${errors} errors, ${warnings} warnings`);
console.log(`budget: ${budget.errors} errors, ${budget.warnings} warnings`);

if (process.argv.includes('--update')) {
  writeFileSync(BUDGET_FILE, `${JSON.stringify({ errors, warnings }, null, 2)}\n`);
  console.log('budget updated');
  process.exit(0);
}

const over = errors > budget.errors || warnings > budget.warnings;

if (over) {
  console.error('\nLint got worse than the committed budget. Breakdown:');
  for (const [rule, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(n).padStart(4)}  ${rule}`);
  }
  console.error('\nFix the new problems, or run `npm run lint:budget -- --update`');
  console.error('if you have deliberately accepted them.');
  process.exit(1);
}

if (errors < budget.errors || warnings < budget.warnings) {
  console.log('\nBelow budget — run `npm run lint:budget -- --update` to lock in the improvement.');
}
