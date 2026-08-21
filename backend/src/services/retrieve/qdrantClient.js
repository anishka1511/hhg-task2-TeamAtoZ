/**
 * Read-only Qdrant helpers for retrieval.
 * Collection create/reset is indexing/scripts/build_index.py's job.
 */

import dns from 'node:dns';
import { QdrantClient } from '@qdrant/js-client-rest';
import { vectorConfig, qdrantConfig } from '../../config/vectorConfig.js';

// Free-tier Cloud + some ISP resolvers intermittently fail ("fetch failed").
// Prefer public DNS + IPv4 so cold starts / sleep wakeups are more reliable.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '9.9.9.9']);
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore if restricted
}

let client = null;

function isTransient(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('eai_again') ||
    msg.includes('socket') ||
    msg.includes('network') ||
    msg.includes('other side closed')
  );
}

async function withRetry(fn, { attempts = 5, delayMs = 400 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      // Drop cached client so the next attempt opens a fresh connection.
      client = null;
    }
  }
  throw lastErr;
}

export function getQdrantClient() {
  if (client) return client;
  const url = process.env.QDRANT_URL || qdrantConfig.url || 'http://localhost:6333';
  const apiKey = process.env.QDRANT_API_KEY || undefined;
  client = new QdrantClient({
    url,
    apiKey,
    // Cloud version probes sometimes fail spuriously over flaky TLS.
    checkCompatibility: false,
    timeout: 30000,
  });
  return client;
}

/**
 * Lightweight health check. Does not throw when Qdrant is up.
 * @returns {Promise<{ok: boolean, message?: string}>}
 */
export async function pingQdrant() {
  try {
    await withRetry(async () => {
      const c = getQdrantClient();
      await c.getCollections();
    });
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
  const results = await withRetry(async () => {
    const c = getQdrantClient();
    return c.query(vectorConfig.collectionName, {
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
  });

  return (results.points || []).map((hit) => ({
    id: hit.id,
    score: hit.score,
    payload: hit.payload || {},
  }));
}
