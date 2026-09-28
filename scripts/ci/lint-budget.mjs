#!/usr/bin/env node
/**
 * Lint regression gate.
 *
 * The errors this gate was built to hold the line on are gone: the React
 * Compiler ruleset (react-hooks/set-state-in-effect) fired on every
 * component that fetched data in an effect, and those all read through SWR
 * now. The budget is down to 0 errors.
 *
 * One warning remains and is expected to: react-hooks/incompatible-library
 * on React Hook Form's `watch()` in BookingForm, which React Compiler
 * cannot memoize safely. Clearing it means dropping React Hook Form from
 * the booking form, which is not worth it for a warning.
 *
 * The gate still earns its place as a ratchet. Plain `eslint` exits 0 on
 * warnings, so a slow drift back would go unnoticed — lint had already
 * silently regressed from 115 problems to 127 before anyone spotted it.
 * The committed count is the ceiling and the build fails the moment either
 * number goes UP. Lowering it further is encouraged; the script says when.
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
