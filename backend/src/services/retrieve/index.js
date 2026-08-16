/**
 * Retrieval stub — Owner: Builder 1
 * Wire to Qdrant + chunking strategies after indexing exists.
 */

const ALLOWED = new Set(['fixed_overlap', 'semantic', 'metadata']);

export async function retrieve(query, { strategy = 'fixed_overlap', top_k = 5 } = {}) {
  if (!query || !String(query).trim()) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Empty query',
    };
  }

  if (!ALLOWED.has(strategy)) {
    return {
      ok: false,
      statusCode: 400,
      message: `Unknown chunking_strategy: ${strategy}`,
    };
  }

  return {
    ok: false,
    statusCode: 501,
    message:
      'TODO(Builder 1): implement Qdrant retrieve for strategy=' +
      strategy +
      ', top_k=' +
      top_k,
    contexts: [],
  };
}
