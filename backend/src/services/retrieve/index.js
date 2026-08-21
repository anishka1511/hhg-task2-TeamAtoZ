/**
 * Retrieval for Builder 2's pipeline and POST /api/retrieve.
 * Frozen context shape: { id, text, score, strategy }
 */

import { embedQuery } from './embed.js';
import { search } from './qdrantClient.js';

const ALLOWED = new Set([
  'fixed_overlap',
  'semantic',
  'metadata_aware',
  'token_window',
  'structure_aware',
  'recursive',
]);

export async function retrieve(query, { strategy = 'fixed_overlap', top_k = 5 } = {}) {
  if (!query || !String(query).trim()) {
    return { ok: false, error: 'empty_query', contexts: [] };
  }

  if (!ALLOWED.has(strategy)) {
    return { ok: false, error: 'unknown_strategy', contexts: [] };
  }

  const k = Number(top_k);
  const limit = Number.isFinite(k) && k > 0 ? Math.floor(k) : 5;

  try {
    const vector = await embedQuery(String(query).trim());
    const results = await search(vector, { strategy, top_k: limit });
    const contexts = results.map((r) => ({
      id: r.id,
      text: r.payload?.text ?? '',
      score: r.score,
      strategy: r.payload?.strategy ?? strategy,
    }));
    return { ok: true, contexts };
  } catch (err) {
    return {
      ok: false,
      error: 'retrieval_failed',
      detail: err.message || 'retrieval failed',
      contexts: [],
    };
  }
}
