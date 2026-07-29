#!/usr/bin/env node
/**
 * Fails the build on a critical production advisory — and only on that.
 *
 * `npm audit --audit-level=critical` exits non-zero for two very different
 * reasons: a real advisory, and npm's audit endpoint being unreachable. The
 * second one turned CI red on a green commit ("{ error: 'Service
 * Unavailable' }") and says nothing about this code. A gate that goes red
 * for reasons outside the repository is a gate people learn to re-run
 * without reading.
 *
 * So: advisories still fail. An unreachable endpoint warns and passes,
 * because we cannot tell either way and blocking a deploy on npm's uptime is
 * the wrong trade.
 */
import { execFileSync } from 'node:child_process';

let raw = '';
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (err) {
  // npm exits non-zero when it finds anything; the JSON is still on stdout.
  raw = err.stdout ?? '';
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.log('::warning::npm audit returned unparseable output — advisory gate skipped');
  process.exit(0);
}

// The endpoint failure shape: { error: { code, summary, detail } } or a
// bare { error: 'Service Unavailable' }.
if (report.error) {
  const detail =
    typeof report.error === 'string'
      ? report.error
      : (report.error.summary ?? report.error.code ?? 'unknown');
  console.log(`::warning::npm audit endpoint unavailable (${detail}) — advisory gate skipped`);
  process.exit(0);
}

const counts = report.metadata?.vulnerabilities ?? {};
const critical = counts.critical ?? 0;

console.log(
  `advisories (production deps): ` +
    `${critical} critical, ${counts.high ?? 0} high, ` +
    `${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low`,
);

if (critical > 0) {
  console.error(`\n${critical} critical advisory/advisories in production dependencies:`);
  for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
    if (v.severity === 'critical') console.error(`  ${name} — ${v.via?.[0]?.title ?? v.severity}`);
  }
  process.exit(1);
}

process.exit(0);
