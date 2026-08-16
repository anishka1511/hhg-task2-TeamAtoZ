/**
 * Qdrant client stub — Owner: Builder 1
 * Port patterns from the RAG spike; do not copy LightRAG.
 */

import { QdrantClient } from '@qdrant/js-client-rest';

let client = null;

export function getQdrantClient() {
  if (client) return client;
  const url = process.env.QDRANT_URL || 'http://localhost:6333';
  const apiKey = process.env.QDRANT_API_KEY || undefined;
  client = new QdrantClient({ url, apiKey });
  return client;
}

/**
 * TODO(Builder 1): ensure collection exists, upsert chunks, search.
 */
export async function pingQdrant() {
  try {
    const c = getQdrantClient();
    await c.getCollections();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}
