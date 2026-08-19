/**
 * Query orchestration harness (scaffold).
 * Stages: validate → retrieve → generate → guardrails (+ latency)
 *
 * Owner: Builder 2
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

export async function runQueryPipeline({ question, source, chunking_strategy }) {
  const timer = createTimer();

  // --- retrieve (Builder 1) ---
  timer.mark('retrieve_start');
  const retrieval = await retrieve(question, {
    strategy: chunking_strategy,
    top_k: 5,
  });
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
  const generation = await generateAnswer({
    question,
    contexts: retrieval.contexts,
  });
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
      meta: { source, chunking_strategy },
    },
  };
}
