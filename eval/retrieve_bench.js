#!/usr/bin/env node
/**
 * Retrieve-only latency bench (Builder 1 → Builder 2 handoff).
 *
 * Measurement method: direct function call of retrieve() in
 * backend/src/services/retrieve/index.js — embedQuery (@xenova MiniLM)
 * + Qdrant search. No HTTP / Fastify overhead.
 *
 * Requires: Qdrant running (docker compose up -d qdrant) with the
 * collection already built (python indexing/scripts/build_index.py).
 * Does NOT require the Fastify server.
 *
 * Run from repo root:
 *   node eval/retrieve_bench.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(REPO_ROOT, 'eval', 'retrieve_latency.json');
const STRATEGIES = ['fixed_overlap', 'semantic', 'metadata_aware'];
const NUM_WARMUP = 5;
const TOP_K = 5;

// Load backend dotenv if present (optional).
const backendRequire = createRequire(path.join(REPO_ROOT, 'backend', 'package.json'));
try {
  backendRequire('dotenv').config({ path: path.join(REPO_ROOT, '.env') });
} catch {
  // dotenv optional; QDRANT_URL defaults inside qdrantClient.js
}

const IN_CORPUS = [
  'What was the Manhattan Project and who ran it during World War II?',
  'How did the atomic bomb project change the end of the war?',
  'When can someone start collecting Social Security retirement payments?',
  'How many years of Social Security tax work do you need to qualify?',
  'What does the place name Yucaipa mean in the local Native language?',
  'What are common reasons people get pain in the middle of their back?',
  'How does restorative justice treat crime compared to the state?',
  'What does it mean if someone says the elevator does not go to the top?',
  'Are private security guards allowed to arrest people?',
  'How much should an unarmed security officer typically be paid?',
  'What is the water elevation at Lake Mead near Hoover Dam?',
  'Which actress played Loretta Lynn in Coal Miner\'s Daughter?',
  'What should college students wear to class instead of sweats?',
  'How is phloem different from xylem in how it moves sap?',
  'Can you use food stamps at Costco stores?',
  'What is a crevice and where might animals hide in one?',
  'How much does a Georgia name-change duplicate driver license cost?',
  'When can you renew a Georgia driver license before it expires?',
  'How many shows can an X1 DVR record at the same time?',
  'Who directed the Los Alamos lab that designed the bombs?',
  'What is the meaning of the word elevator in a dictionary sense?',
  'Do professors really teach a full class on the first day of school?',
];

const OFF_TOPIC = [
  'What is the capital of France?',
  'How do I bake a simple loaf of bread at home?',
  'Who won the most recent FIFA World Cup?',
  'What is the best way to train a puppy not to chew furniture?',
  'How far is the Moon from Earth on average?',
  'Can you explain how photosynthesis works in houseplants?',
  'What time zone is Tokyo in?',
  'How do I change a flat bicycle tire?',
  'What are the ingredients in a classic margarita?',
  'Is Pluto still considered a planet by astronomers?',
];

const EDGE = [
  'SSN?',
  'DVR??',
  'phloem / xylem — difference???',
  'Manhattan... project???',
  'cost?? $',
  'back pain.',
  'Yucaipa!',
  'elevator',
];

const QUERIES = [...IN_CORPUS, ...OFF_TOPIC, ...EDGE];

function percentile(samples, p) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
  return sorted[clamped];
}

function stats(samples) {
  return {
    p50: percentile(samples, 50),
    p70: percentile(samples, 70),
    p100: percentile(samples, 100),
  };
}

function formatRow(name, s) {
  return `${name.padEnd(18)} ${String(s.p50).padStart(8)} ${String(s.p70).padStart(8)} ${String(s.p100).padStart(8)}`;
}

async function timedRetrieve(retrieve, question, strategy) {
  const start = process.hrtime.bigint();
  const result = await retrieve(question, { strategy, top_k: TOP_K });
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1e6;
  return { ms, ok: result.ok, error: result.error };
}

async function main() {
  const retrieveUrl = pathToFileURL(
    path.join(REPO_ROOT, 'backend', 'src', 'services', 'retrieve', 'index.js'),
  ).href;
  const { retrieve } = await import(retrieveUrl);

  const warmupQs = QUERIES.slice(0, NUM_WARMUP);
  process.stdout.write(`Warm-up: ${NUM_WARMUP} queries (timings discarded)… `);
  for (const q of warmupQs) {
    await retrieve(q, { strategy: 'fixed_overlap', top_k: TOP_K });
  }
  console.log('done');

  const byStrategy = Object.fromEntries(STRATEGIES.map((s) => [s, []]));
  let failures = 0;

  for (const strategy of STRATEGIES) {
    process.stdout.write(`Measuring ${strategy} (${QUERIES.length} queries)… `);
    for (const q of QUERIES) {
      const { ms, ok, error } = await timedRetrieve(retrieve, q, strategy);
      byStrategy[strategy].push(ms);
      if (!ok) {
        failures += 1;
        console.warn(`\n  retrieve failed (${error}) for strategy=${strategy} q=${JSON.stringify(q).slice(0, 60)}`);
      }
    }
    console.log('done');
  }

  const combined = STRATEGIES.flatMap((s) => byStrategy[s]);
  const rounded = (arr) => arr.map((x) => Math.round(x * 10) / 10);

  const payload = {
    generated_at: new Date().toISOString(),
    num_queries: QUERIES.length,
    num_warmup: NUM_WARMUP,
    measurement_method: 'direct function call',
    by_strategy: {},
    combined: stats(rounded(combined)),
  };
  for (const s of STRATEGIES) {
    payload.by_strategy[s] = stats(rounded(byStrategy[s]));
  }

  console.log('\nRetrieve-only latency (ms)');
  console.log(`${'strategy'.padEnd(18)} ${'P50'.padStart(8)} ${'P70'.padStart(8)} ${'P100'.padStart(8)}`);
  for (const s of STRATEGIES) {
    console.log(formatRow(s, payload.by_strategy[s]));
  }
  console.log(formatRow('combined', payload.combined));
  if (failures) {
    console.warn(`\nWARNING: ${failures} retrieve() calls returned ok:false`);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(REPO_ROOT, OUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
