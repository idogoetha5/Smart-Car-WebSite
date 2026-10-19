#!/usr/bin/env node
/**
 * Runs the WhatsApp question bank against the bot and reports every answer
 * that misses an expected fact, hands off when it should not (or the
 * reverse), or tells the customer it did not understand.
 *
 *   BASE=https://www.smartcar.co.il node scripts/whatsapp-eval/run.mjs
 *   LIMIT=200 TOPIC=deposit node scripts/whatsapp-eval/run.mjs
 *
 * The public simulator is rate limited per visitor, so a full run of the
 * bank takes a while; the script waits and retries on HTTP 429. Results go to
 * scripts/whatsapp-eval/out/report.json and report.md.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
const limit = Number(process.env.LIMIT || 0);
const topic = process.env.TOPIC;
const sample = Number(process.env.SAMPLE || 0);

let bank = JSON.parse(readFileSync(join(here, 'questions.json'), 'utf8'));
if (topic) bank = bank.filter((q) => q.topic === topic);
if (sample) {
  // A few questions from every topic, for a quick health check.
  const byTopic = new Map();
  for (const q of bank) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);
  bank = [...byTopic.values()].flatMap((items) => items.slice(0, sample));
}
if (limit) bank = bank.slice(0, limit);

const NOT_UNDERSTOOD = /לא הצלחתי לזהות|לא זיהיתי|did not recognise|didn't recognise/;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ask(text) {
  const sessionId = `eval_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${base}/api/whatsapp/simulator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: text, state: null }),
    });
    if (response.status === 429) { await sleep(60_000); continue; }
    if (!response.ok) return { error: `HTTP ${response.status}` };
    return response.json();
  }
  return { error: 'rate limited' };
}

function check(question, result) {
  const problems = [];
  if (result.error) return [result.error];
  const reply = result.reply ?? '';
  const { any, escalate, step } = question.expect;
  if (any && !any.some((word) => reply.toLowerCase().includes(word.toLowerCase()))) problems.push(`missing one of: ${any.join(' / ')}`);
  if (escalate !== undefined && Boolean(result.escalated) !== escalate) problems.push(escalate ? 'should hand off to a person' : 'handed off for no reason');
  if (step && result.state?.step !== step) problems.push(`step ${result.state?.step} instead of ${step}`);
  if (NOT_UNDERSTOOD.test(reply)) problems.push('said it did not understand');
  if (!reply.trim()) problems.push('empty reply');
  return problems;
}

const results = [];
for (const [index, question] of bank.entries()) {
  const result = await ask(question.text);
  const problems = check(question, result);
  results.push({ ...question, reply: result.reply, escalated: result.escalated, problems });
  process.stdout.write(`${problems.length ? '✗' : '✓'} ${index + 1}/${bank.length} [${question.topic}] ${question.text}${problems.length ? `  →  ${problems.join('; ')}` : ''}\n`);
}

const failed = results.filter((r) => r.problems.length);
const topics = [...new Set(results.map((r) => r.topic))].map((name) => {
  const items = results.filter((r) => r.topic === name);
  return { topic: name, total: items.length, passed: items.filter((r) => !r.problems.length).length };
});

mkdirSync(join(here, 'out'), { recursive: true });
writeFileSync(join(here, 'out', 'report.json'), JSON.stringify({ base, total: results.length, failed: failed.length, topics, results }, null, 1));
writeFileSync(join(here, 'out', 'report.md'), [
  `# WhatsApp bot evaluation — ${new Date().toISOString()}`,
  `Base: ${base}. Passed ${results.length - failed.length} of ${results.length}.`,
  '',
  '| Topic | Passed |', '|---|---|',
  ...topics.map((t) => `| ${t.topic} | ${t.passed}/${t.total} |`),
  '',
  '## Failures',
  ...failed.map((r) => `- **${r.text}** (${r.topic}): ${r.problems.join('; ')}\n  > ${(r.reply ?? '').replace(/\n+/g, ' ').slice(0, 300)}`),
].join('\n'));

console.log(`\nPassed ${results.length - failed.length} of ${results.length}. Report: scripts/whatsapp-eval/out/report.md`);
process.exitCode = failed.length ? 1 : 0;
