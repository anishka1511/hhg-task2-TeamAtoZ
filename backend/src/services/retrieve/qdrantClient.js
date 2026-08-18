/**
 * Read-only Qdrant helpers for retrieval.
 * Collection create/reset is indexing/scripts/build_index.py's job.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { vectorConfig, qdrantConfig } from '../../config/vectorConfig.js';

let client = null;

export function getQdrantClient() {
  if (client) return client;
  const url = process.env.QDRANT_URL || qdrantConfig.url || 'http://localhost:6333';
  const apiKey = process.env.QDRANT_API_KEY || undefined;
  client = new QdrantClient({ url, apiKey });
  return client;
}

/**
 * Lightweight health check. Does not throw when Qdrant is up.
 * @returns {Promise<{ok: boolean, message?: string}>}
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

/**
 * Verify msmarco_xi exists. Does not create it.
 * @returns {Promise<boolean>}
 */
export async function ensureCollection() {
  let collections;
  try {
    const c = getQdrantClient();
    collections = await c.getCollections();
  } catch (err) {
    throw new Error(
      `Qdrant is unreachable at ${process.env.QDRANT_URL || qdrantConfig.url}. ` +
        `Start it with: docker compose up -d qdrant (${err.message})`,
    );
  }

  const name = vectorConfig.collectionName;
  const exists = collections.collections.some((col) => col.name === name);
  if (!exists) {
    throw new Error(
      `Qdrant collection '${name}' not found. Run: python indexing/scripts/build_index.py --reset`,
    );
  }
  return true;
}

/**
 * @param {number[]} vector
 * @param {{ strategy: string, top_k: number }} options
 * @returns {Promise<Array<{id: string|number, score: number, payload: object}>>}
 */
export async function search(vector, { strategy, top_k }) {
  const c = getQdrantClient();
  const results = await c.query(vectorConfig.collectionName, {
    query: vector,
    limit: top_k,
    with_payload: true,
    filter: {
      must: [
        {
          key: 'strategy',
          match: { value: strategy },
        },
      ],
    },
  });

  return (results.points || []).map((hit) => ({
    id: hit.id,
    score: hit.score,
    payload: hit.payload || {},
  }));
}
