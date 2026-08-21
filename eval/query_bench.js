#!/usr/bin/env node
/**
 * Full /api/query latency bench (Builder 2).
 *
 * Hits a running backend (default http://127.0.0.1:3001), warmups, then
 * ≥40 text queries. Records latency_ms from the frozen response JSON.
 * Merges Builder 1 retrieve-only numbers from eval/retrieve_latency.json
 * into the report JSON for docs/LATENCY_REPORT.md.
 *
 * Run (backend must be up with Qdrant + LLM keys):
 *   node eval/query_bench.js
 *   node eval/query_bench.js --api http://127.0.0.1:3001 --strategy fixed_overlap
 *
 * Does NOT call Sarvam (text path only) — saves STT credits.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(REPO_ROOT, 'eval', 'query_latency.json');
const RETRIEVE_HANDOFF = path.join(REPO_ROOT, 'eval', 'retrieve_latency.json');

const API_BASE = process.env.BENCH_API_URL || argValue('--api') || 'http://127.0.0.1:3001';
const STRATEGY = process.env.BENCH_STRATEGY || argValue('--strategy') || 'fixed_overlap';
const NUM_WARMUP = Number(process.env.BENCH_WARMUP || 5);
const TOP_N = Number(process.env.BENCH_N || 40); // how many measured queries
const PACE_MS = Number(process.env.BENCH_PACE_MS || 3500); // stay under Groq free TPM

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

// Reuse Builder 1 query mix (in-corpus + off-topic + short edge).
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
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const clamped = Math.max(0, Math.min(sorted.length - 1, idx));
  return sorted[clamped];
}

function stageStats(samples) {
  return {
    n: samples.length,
    p50: percentile(samples, 50),
    p70: percentile(samples, 70),
    p100: percentile(samples, 100),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimited(status, data) {
  const msg = String(data?.message || data?.error || '');
  return status === 429 || /rate limit/i.test(msg);
}

async function oneQuery(question) {
  const maxAttempts = 5;
  let last = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const started = Date.now();
    const res = await fetch(`${API_BASE}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        source: 'text',
        chunking_strategy: STRATEGY,
      }),
    });
    const wall_ms = Date.now() - started;
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    last = { ok: res.ok, status: res.status, wall_ms, data };
    if (res.ok) return last;
    if (isRateLimited(res.status, data) && attempt < maxAttempts - 1) {
      const wait = 4000 * (attempt + 1);
      process.stdout.write(`rate-limited, wait ${wait}ms…          \r`);
      await sleep(wait);
      continue;
    }
    return last;
  }
  return last;
}

async function main() {
  const healthRes = await fetch(`${API_BASE}/api/health`);
  if (!healthRes.ok) {
    console.error(`Health check failed at ${API_BASE}/api/health`);
    process.exit(1);
  }
  const health = await healthRes.json();
  console.log('health:', JSON.stringify(health));

  const measured = QUERIES.slice(0, Math.min(TOP_N, QUERIES.length));
  const warmupQs = measured.slice(0, Math.min(NUM_WARMUP, measured.length));

  console.log(`warmup=${warmupQs.length} measure=${measured.length} strategy=${STRATEGY} api=${API_BASE}`);

  for (let i = 0; i < warmupQs.length; i += 1) {
    process.stdout.write(`warmup ${i + 1}/${warmupQs.length}…\r`);
    await oneQuery(warmupQs[i]);
    if (PACE_MS > 0) await sleep(PACE_MS);
  }
  console.log(`warmup done${' '.repeat(20)}`);

  const buckets = {
    retrieve: [],
    generate: [],
    guardrail: [],
    total: [],
    wall: [],
  };
  const rows = [];
  let failures = 0;

  for (let i = 0; i < measured.length; i += 1) {
    const q = measured[i];
    process.stdout.write(`query ${i + 1}/${measured.length}…\r`);
    const { ok, status, wall_ms, data } = await oneQuery(q);
    const lat = data.latency_ms || {};
    if (!ok || lat.total == null) {
      failures += 1;
      rows.push({
        i,
        ok: false,
        status,
        question: q.slice(0, 80),
        wall_ms,
        error: data.message || data.error || null,
      });
      if (PACE_MS > 0) await sleep(PACE_MS);
      continue;
    }
    buckets.retrieve.push(Number(lat.retrieve) || 0);
    buckets.generate.push(Number(lat.generate) || 0);
    buckets.guardrail.push(Number(lat.guardrail) || 0);
    buckets.total.push(Number(lat.total) || 0);
    buckets.wall.push(wall_ms);
    rows.push({
      i,
      ok: true,
      status,
      question: q.slice(0, 80),
      latency_ms: lat,
      wall_ms,
      allowed: data.guardrail?.allowed ?? null,
      reason: data.guardrail?.reason ?? null,
    });
    if (PACE_MS > 0) await sleep(PACE_MS);
  }
  console.log(`measure done${' '.repeat(20)}`);

  let retrieve_handoff = null;
  try {
    retrieve_handoff = JSON.parse(fs.readFileSync(RETRIEVE_HANDOFF, 'utf8'));
  } catch {
    retrieve_handoff = null;
  }

  const out = {
    generated_at: new Date().toISOString(),
    api: API_BASE,
    strategy: STRATEGY,
    num_warmup: warmupQs.length,
    num_queries: measured.length,
    num_ok: rows.filter((r) => r.ok).length,
    num_failed: failures,
    measurement_method: 'HTTP POST /api/query (text path); latency_ms from response JSON',
    stages: {
      retrieve: stageStats(buckets.retrieve),
      generate: stageStats(buckets.generate),
      guardrail: stageStats(buckets.guardrail),
      total_post_stt: stageStats(buckets.total),
      wall_http: stageStats(buckets.wall),
    },
    retrieve_only_handoff_builder1: retrieve_handoff
      ? {
          source: 'eval/retrieve_latency.json',
          combined: retrieve_handoff.combined,
          by_strategy: retrieve_handoff.by_strategy,
          note: 'Direct retrieve() call; no HTTP/LLM. Prefer this column for retrieve-only in the report.',
        }
      : null,
    stt: {
      sampled: false,
      note: 'Text-path bench only. Sample voice separately if needed; do not burn Sarvam credits in CI.',
    },
    target_ms: 200,
    meets_200ms_p50: (stageStats(buckets.total).p50 ?? Infinity) <= 200,
    rows,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`wrote ${OUT_PATH}`);
  console.log(
    JSON.stringify(
      {
        stages: out.stages,
        meets_200ms_p50: out.meets_200ms_p50,
        retrieve_handoff_combined: out.retrieve_only_handoff_builder1?.combined ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
