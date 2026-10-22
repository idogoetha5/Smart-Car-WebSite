#!/usr/bin/env node
/**
 * Trains the brain's message classifier and writes it to
 * src/lib/whatsapp-brain-model.ts (read by whatsapp-brain.ts).
 *
 *   node scripts/whatsapp-eval/build-brain-model.mjs          # train on everything, write the model
 *   node scripts/whatsapp-eval/build-brain-model.mjs --eval   # hold out 15% and report accuracy
 *
 * What it learns (labels):
 *   - the 35 everyday situations (scripts/whatsapp-eval/lexicon/brain/situations.json)
 *   - faq:<topic>  questions about the business (lexicon/questions.json)
 *   - rental       asking for a car (lexicon/rental.json)
 *   - urgent:<kind> accident, breakdown, complaint, asking for a person, an existing booking (lexicon/urgent.json)
 *   - detail       a bare booking answer: a place, a date, a car type (brain places/dates/vehicles)
 *
 * The model is a naive Bayes over words, word pairs and three-letter pieces of
 * words (src/lib/whatsapp-brain-features.ts), with every class equally likely
 * up front. Every phrase is also learned with typing mistakes, and questions,
 * rentals and urgent messages with a greeting or "אחי" around them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { brainFeatures } from '../../src/lib/whatsapp-brain-features.ts';

const EVAL = process.argv.includes('--eval');
const here = (path) => new URL(path, import.meta.url);
const json = (path) => JSON.parse(readFileSync(here(path), 'utf8'));
const all = (entry) => (Array.isArray(entry) ? entry : Object.values(entry ?? {}).flat()).filter((s) => typeof s === 'string' && s.trim());

// Deterministic randomness, so the model is the same on every build.
let seed = 20261020;
const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (list) => list[Math.floor(random() * list.length)];

const examples = [];
const add = (label, text) => { if (text && text.trim()) examples.push({ label, text: text.trim() }); };

for (const [situation, value] of Object.entries(json('./lexicon/brain/situations.json'))) for (const text of all(value)) add(situation, text);
for (const [topic, value] of Object.entries(json('./lexicon/questions.json'))) for (const text of all(value)) add(`faq:${topic}`, text);
for (const [topic, value] of Object.entries(json('./lexicon/brain/questions-extra.json'))) if (!topic.startsWith('_')) for (const text of all(value)) add(`faq:${topic}`, text);
// General question frames × each topic's words ("מה הסיפור עם הדלק", "what about tolls").
const frames = json('./lexicon/brain/question-frames.json');
for (const [topic, words] of Object.entries(frames.topics)) {
  for (const locale of ['he', 'en']) for (const word of words[locale] ?? []) for (const frame of frames.frames[locale]) add(`faq:${topic}`, frame.replace('{x}', word));
}
const rental = json('./lexicon/rental.json');
for (const text of [...all(rental.rental_request), ...all(rental.rental_with_details)]) add('rental', text);
const urgent = json('./lexicon/urgent.json');
// Asking for a person and complaining are the same thing as the everyday situations of that name.
const URGENT_LABEL = { accident: 'urgent:accident', breakdown: 'urgent:breakdown', complaint: 'angry', person: 'human_request', existing_booking: 'urgent:existing_booking' };
for (const kind of Object.keys(URGENT_LABEL)) for (const text of all(urgent[kind])) add(URGENT_LABEL[kind], text);
for (const entry of all(urgent.key_words)) { const [kind, word] = entry.split(':'); if (word && URGENT_LABEL[kind]) add(URGENT_LABEL[kind], word); }

// Bare booking answers.
const places = json('./lexicon/brain/places.json');
for (const place of places.places ?? []) {
  add('detail', place.name);
  add('detail', `מ${place.name}`);
  add('detail', `ב${place.name}`);
  if (place.en) add('detail', place.en);
  for (const spelling of (place.spellings ?? []).slice(0, 3)) add('detail', spelling);
}
const dates = json('./lexicon/brain/dates.json');
for (const group of [...(dates.relative_days ?? []), ...(dates.durations ?? []), ...(dates.holidays ?? [])]) for (const phrase of (group.phrases ?? []).slice(0, 12)) add('detail', phrase);
const vehicles = json('./lexicon/brain/vehicles.json');
for (const value of Object.values(vehicles.categories ?? {})) for (const phrase of all(value).slice(0, 60)) add('detail', phrase);
for (const model of (vehicles.models ?? []).slice(0, 200)) add('detail', model.model);
for (const n of ['1', '2', '3', '4', '5', '6', '7', '8', '15/11', '3.12', '12/12/2026', 'ב-5 בנובמבר', 'מה-3 עד ה-7', 'עד ה-20']) add('detail', n);

// Typing mistakes: a dropped, doubled or swapped letter, or a neighbouring Hebrew letter.
const NEAR = { ה: 'ח', ח: 'ה', כ: 'ק', ק: 'כ', ת: 'ט', ט: 'ת', ס: 'ש', ש: 'ס', א: 'ע', ע: 'א', ו: 'י', י: 'ו' };
function typo(text) {
  const chars = [...text];
  const spots = chars.map((ch, i) => (/[א-תa-z]/i.test(ch) ? i : -1)).filter((i) => i >= 0);
  if (spots.length < 4) return null;
  const i = pick(spots);
  const kind = Math.floor(random() * 4);
  if (kind === 0) chars.splice(i, 1);
  else if (kind === 1) chars.splice(i, 0, chars[i]);
  else if (kind === 2 && i + 1 < chars.length) [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
  else chars[i] = NEAR[chars[i]] ?? chars[i];
  return chars.join('');
}
const OPENERS = ['היי ', 'אחי ', 'שלום, ', 'בוקר טוב, ', 'סליחה, ', 'שאלה: ', 'hi ', 'hey, ', 'רגע ', 'תגיד ', 'יו '];
const CLOSERS = [' תודה', ' 🙏', '?', ' בבקשה', ' thanks', ' אחי', ''];

const base = examples.slice();
for (const { label, text } of base) {
  const wrong = typo(text);
  if (wrong) add(label, wrong);
  if (/^(?:faq:|rental|urgent:)/.test(label)) {
    add(label, `${pick(OPENERS)}${text}${pick(CLOSERS)}`);
    add(label, `${pick(OPENERS)}${typo(text) ?? text}`);
  }
}

// ---------------------------------------------------------------------------

function train(rows) {
  const labels = [...new Set(rows.map((row) => row.label))].sort();
  const index = new Map(labels.map((label, i) => [label, i]));
  const counts = new Map(); // feature -> Float64Array per label
  const totals = new Float64Array(labels.length);
  for (const { label, text } of rows) {
    const c = index.get(label);
    for (const feature of brainFeatures(text)) {
      let row = counts.get(feature);
      if (!row) counts.set(feature, (row = new Float64Array(labels.length)));
      row[c] += 1;
      totals[c] += 1;
    }
  }
  // Keep features seen at least twice: rarer ones are mostly noise and size.
  const minCount = Number(process.env.MIN_COUNT ?? 3);
  for (const [feature, row] of counts) if (row.reduce((s, n) => s + n, 0) < minCount) counts.delete(feature);
  const alpha = Number(process.env.ALPHA ?? 0.1);
  const vocabulary = counts.size;
  const defaults = labels.map((_, c) => Math.log(alpha / (totals[c] + alpha * vocabulary)));
  const features = {};
  for (const [feature, row] of counts) {
    const deltas = [];
    row.forEach((n, c) => { if (n >= Number(process.env.MIN_CELL ?? 2)) deltas.push(c, Math.round((Math.log((n + alpha) / (totals[c] + alpha * vocabulary)) - defaults[c]) * 10) / 10); });
    if (deltas.length) features[feature] = deltas;
  }
  return { labels, defaults: defaults.map((d) => Math.round(d * 1000) / 1000), features };
}

/**
 * Multinomial logistic regression trained with plain SGD. Features are the
 * same; the result is stored in the same shape as naive Bayes (defaults are
 * the per-label biases, applied once rather than per feature).
 */
function trainLogistic(rows) {
  const labels = [...new Set(rows.map((row) => row.label))].sort();
  const index = new Map(labels.map((label, i) => [label, i]));
  const L = labels.length;
  const docCount = new Map();
  const docs = rows.map(({ label, text }) => {
    const feats = brainFeatures(text);
    for (const f of feats) docCount.set(f, (docCount.get(f) ?? 0) + 1);
    return { y: index.get(label), feats };
  });
  const weights = new Map();
  for (const [f, n] of docCount) if (n >= Number(process.env.MIN_COUNT ?? 3)) weights.set(f, new Float32Array(L));
  const bias = new Float32Array(L);
  // Every label weighs the same, however many phrases it has.
  const perLabel = new Float64Array(L);
  for (const d of docs) perLabel[d.y] += 1;
  const classWeight = [...perLabel].map((n) => docs.length / (L * n));
  const epochs = Number(process.env.EPOCHS ?? 12);
  const scores = new Float64Array(L);
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = 0.4 / (1 + epoch * 0.5);
    for (let i = docs.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [docs[i], docs[j]] = [docs[j], docs[i]]; }
    for (const { y, feats } of docs) {
      const rows = feats.map((f) => weights.get(f)).filter(Boolean);
      const scale = 1 / Math.sqrt(Math.max(rows.length, 1));
      for (let c = 0; c < L; c += 1) { let s = bias[c]; for (const w of rows) s += w[c] * scale; scores[c] = s; }
      let max = -Infinity; for (let c = 0; c < L; c += 1) if (scores[c] > max) max = scores[c];
      let sum = 0; for (let c = 0; c < L; c += 1) { scores[c] = Math.exp(scores[c] - max); sum += scores[c]; }
      const step = rate * classWeight[y];
      for (let c = 0; c < L; c += 1) {
        const g = (scores[c] / sum - (c === y ? 1 : 0)) * step;
        if (Math.abs(g) < 1e-5) continue;
        bias[c] -= g * 0.1;
        for (const w of rows) w[c] -= g * scale;
      }
    }
  }
  const features = {};
  for (const [f, w] of weights) {
    const deltas = [];
    w.forEach((v, c) => { if (Math.abs(v) >= Number(process.env.LR_MIN ?? 0.3)) deltas.push(c, Math.round(v * 10) / 10); });
    if (deltas.length) features[f] = deltas;
  }
  return { kind: 'lr', labels, defaults: [...bias].map((b) => Math.round(b * 1000) / 1000), features };
}

function classify(model, text) {
  const scores = model.defaults.map(() => 0);
  let seen = 0;
  for (const feature of brainFeatures(text)) {
    const deltas = model.features[feature];
    if (!deltas) continue;
    seen += 1;
    for (let i = 0; i < deltas.length; i += 2) scores[deltas[i]] += deltas[i + 1];
  }
  if (model.kind === 'lr') {
    const scale = 1 / Math.sqrt(Math.max(seen, 1));
    for (let c = 0; c < scores.length; c += 1) scores[c] = scores[c] * scale + model.defaults[c];
  } else for (let c = 0; c < scores.length; c += 1) scores[c] += model.defaults[c] * seen;
  const max = Math.max(...scores);
  const exp = scores.map((s) => Math.exp(s - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  let best = 0;
  for (let c = 1; c < scores.length; c += 1) if (scores[c] > scores[best]) best = c;
  return { label: model.labels[best], confidence: exp[best] / sum, seen };
}

if (EVAL) {
  // Hold out whole base phrases (with their variants) so the test is honest.
  const key = (text) => text.replace(/[^א-תa-z]/gi, '').slice(0, 12);
  const testKeys = new Set();
  for (const { text } of base) if (random() < 0.15) testKeys.add(key(text));
  const trainRows = examples.filter((row) => !testKeys.has(key(row.text)));
  const testRows = base.filter((row) => testKeys.has(key(row.text)));
  const model = process.env.MODEL === 'nb' ? train(trainRows) : trainLogistic(trainRows);
  const group = (label) => label.split(':')[0];
  for (const threshold of [0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99]) {
    let answered = 0; let right = 0; let rightGroup = 0;
    for (const row of testRows) {
      const result = classify(model, row.text);
      if (result.confidence < threshold) continue;
      answered += 1;
      if (result.label === row.label) right += 1;
      if (group(result.label) === group(row.label)) rightGroup += 1;
    }
    console.log(`threshold ${threshold}: answers ${(answered / testRows.length * 100).toFixed(1)}% of ${testRows.length}, exact ${(right / answered * 100).toFixed(1)}%, same family ${(rightGroup / answered * 100).toFixed(1)}%`);
  }
  if (process.env.BOTH) {
    const nb = train(trainRows);
    console.log(`size: nb ${JSON.stringify(nb).length}, lr ${JSON.stringify(model).length}`);
    for (const [minNb, minLr] of [[0, 0], [0.5, 0], [0.5, 0.2], [0.8, 0.3], [0.9, 0.4]]) {
      let answered = 0; let right = 0;
      for (const row of testRows) {
        const a = classify(nb, row.text); const b = classify(model, row.text);
        if (a.label !== b.label || a.confidence < minNb || b.confidence < minLr) continue;
        answered += 1; if (a.label === row.label) right += 1;
      }
      console.log(`agree nb>=${minNb} lr>=${minLr}: answers ${(answered / testRows.length * 100).toFixed(1)}%, exact ${(right / answered * 100).toFixed(1)}%`);
    }
  }
  // The worst mix-ups, to see where more phrases are needed.
  const confusion = new Map();
  for (const row of testRows) {
    const result = classify(model, row.text);
    if (result.label !== row.label && result.confidence >= 0.9) {
      const k = `${row.label} → ${result.label}`;
      confusion.set(k, [...(confusion.get(k) ?? []), row.text]);
    }
  }
  for (const [k, list] of [...confusion].sort((a, b) => b[1].length - a[1].length).slice(0, 25)) console.log(`${list.length}× ${k}: ${list.slice(0, 3).join(' | ')}`);
  process.exit(0);
}

// Two models that read differently; the brain trusts a label only when both agree.
const nb = train(examples);
const lr = trainLogistic(examples);
// Stored as text (one feature per line: "feature<TAB>label:weight,label:weight"),
// which TypeScript reads instantly; whatsapp-brain.ts turns it into a map once.
const asText = (model) => [
  model.labels.join('|'),
  model.defaults.join(','),
  ...Object.entries(model.features).map(([f, d]) => `${f}\t${d.reduce((parts, v, i) => (i % 2 ? parts : [...parts, `${v}:${d[i + 1]}`]), []).join(',')}`),
].join('\n');
const out = `// Generated by scripts/whatsapp-eval/build-brain-model.mjs from the brain phrase lists. Do not edit by hand.
// ${examples.length} training phrases, ${nb.labels.length} labels. Format: labels line, defaults line, then "feature<TAB>label:weight,…".

export const BRAIN_NB_TEXT = ${JSON.stringify(asText(nb))};

export const BRAIN_LR_TEXT = ${JSON.stringify(asText(lr))};
`;
writeFileSync(here('../../src/lib/whatsapp-brain-model.ts'), out);
console.log(JSON.stringify({ examples: examples.length, labels: nb.labels.length, nbFeatures: Object.keys(nb.features).length, lrFeatures: Object.keys(lr.features).length, bytes: out.length }));
