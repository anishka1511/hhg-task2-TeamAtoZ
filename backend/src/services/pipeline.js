/**
 * Query orchestration harness — Owner: Builder 2
 * Stages: validate → retrieve → generate → guardrails (+ latency)
 */

import { retrieve } from './retrieve/index.js';
import { generateAnswer } from './generate/index.js';
import { applyGuardrails } from './guardrails/index.js';
import { createTimer } from './latency/timer.js';

const RETRIEVE_HTTP = {
  empty_query: 400,
  unknown_strategy: 400,
  retrieval_failed: 503,
};

const RETRIEVE_TIMEOUT_MS = Number(process.env.RETRIEVE_TIMEOUT_MS || 15000);
const GENERATE_TIMEOUT_MS = Number(process.env.GENERATE_TIMEOUT_MS || 25000);

/** Plan/docs say "metadata"; indexed value is "metadata_aware". */
export function normalizeStrategy(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return 'fixed_overlap';
  if (s === 'metadata') return 'metadata_aware';
  return s;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label}_timeout`);
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isTransientGenerate(generation) {
  if (!generation || generation.ok) return false;
  const msg = String(generation.message || '').toLowerCase();
  const code = generation.statusCode || 0;
  return (
    code >= 500 ||
    msg.includes('timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('upstream') ||
    msg.includes('econnreset')
  );
}

function isTransientRetrieve(retrieval) {
  if (!retrieval || retrieval.ok) return false;
  if (retrieval.error === 'retrieval_failed') return true;
  const detail = String(retrieval.detail || '').toLowerCase();
  return detail.includes('fetch failed') || detail.includes('timeout');
}

async function retrieveOnce(question, strategy) {
  return withTimeout(
    retrieve(question, { strategy, top_k: 5 }),
    RETRIEVE_TIMEOUT_MS,
    'retrieve',
  );
}

async function generateOnce(question, contexts) {
  return withTimeout(
    generateAnswer({ question, contexts }),
    GENERATE_TIMEOUT_MS,
    'generate',
  );
}

export async function runQueryPipeline({ question, source, chunking_strategy }) {
  const timer = createTimer();
  const strategy = normalizeStrategy(chunking_strategy);

  // --- retrieve (Builder 1) ---
  timer.mark('retrieve_start');
  let retrieval;
  try {
    retrieval = await retrieveOnce(question, strategy);
    if (!retrieval.ok && isTransientRetrieve(retrieval)) {
      retrieval = await retrieveOnce(question, strategy);
    }
  } catch (err) {
    timer.mark('retrieve_end');
    const timedOut = err.code === 'TIMEOUT' || /timeout/i.test(err.message || '');
    return {
      ok: false,
      statusCode: timedOut ? 504 : 503,
      error: timedOut ? 'retrieve_timeout' : 'retrieval_failed',
      message: err.message || 'retrieve failed',
      stage: 'retrieve',
    };
  }
  timer.mark('retrieve_end');

  if (!retrieval.ok) {
    const error = retrieval.error || 'retrieval_failed';
    return {
      ok: false,
      statusCode: RETRIEVE_HTTP[error] || 503,
      error,
      message: retrieval.detail || error,
      stage: 'retrieve',
    };
  }

  // --- generate (Builder 2) ---
  timer.mark('generate_start');
  let generation;
  try {
    generation = await generateOnce(question, retrieval.contexts);
    if (isTransientGenerate(generation)) {
      generation = await generateOnce(question, retrieval.contexts);
    }
  } catch (err) {
    timer.mark('generate_end');
    const timedOut = err.code === 'TIMEOUT' || /timeout/i.test(err.message || '');
    return {
      ok: false,
      statusCode: timedOut ? 504 : 503,
      error: timedOut ? 'generate_timeout' : 'generate_failed',
      message: err.message || 'generate failed',
      stage: 'generate',
    };
  }
  timer.mark('generate_end');

  if (!generation.ok) {
    return {
      ok: false,
      statusCode: generation.statusCode || 503,
      error: generation.error || 'generate_failed',
      message: generation.message,
      stage: 'generate',
    };
  }

  // --- guardrails (Builder 2) ---
  timer.mark('guardrail_start');
  const guardrail = await applyGuardrails({
    question,
    answer: generation.answer,
    contexts: retrieval.contexts,
    refuse: generation.refuse,
  });
  timer.mark('guardrail_end');

  const latency_ms = {
    stt: 0,
    retrieve: timer.duration('retrieve_start', 'retrieve_end'),
    generate: timer.duration('generate_start', 'generate_end'),
    guardrail: timer.duration('guardrail_start', 'guardrail_end'),
    total: timer.total(),
  };

  return {
    ok: true,
    payload: {
      answer: guardrail.allowed ? generation.answer : guardrail.fallbackAnswer,
      contexts: retrieval.contexts,
      guardrail: {
        allowed: guardrail.allowed,
        reason: guardrail.reason,
      },
      latency_ms,
      meta: { source, chunking_strategy: strategy },
    },
  };
}
