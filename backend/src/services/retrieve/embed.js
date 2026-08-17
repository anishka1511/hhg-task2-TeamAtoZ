/**
 * In-process query embeddings via @xenova/transformers.
 * Uses the ONNX MiniLM that matches indexing/scripts/build_index.py
 * (sentence-transformers/all-MiniLM-L6-v2).
 */

import { pipeline } from '@xenova/transformers';
import { vectorConfig } from '../../config/vectorConfig.js';

let extractorPromise = null;

function l2Normalize(values) {
  let sumSquares = 0;
  for (const v of values) {
    sumSquares += v * v;
  }
  const mag = Math.sqrt(sumSquares);
  if (!Number.isFinite(mag) || mag === 0) {
    throw new Error('Cannot normalize a zero-magnitude embedding');
  }
  return values.map((v) => v / mag);
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      'feature-extraction',
      vectorConfig.xenovaEmbeddingModel,
    ).catch((err) => {
      extractorPromise = null;
      throw new Error(
        `Failed to load embedding model ${vectorConfig.embeddingModel} ` +
          `(Xenova id ${vectorConfig.xenovaEmbeddingModel}): ${err.message}`,
      );
    });
  }
  return extractorPromise;
}

/**
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embedQuery(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    throw new Error('Cannot embed empty query text');
  }

  try {
    const extractor = await getExtractor();
    const output = await extractor(trimmed, {
      pooling: 'mean',
      normalize: true,
    });
    const raw = Array.from(output.data);
    if (raw.length !== vectorConfig.vectorSize) {
      throw new Error(
        `Expected embedding dim ${vectorConfig.vectorSize}, got ${raw.length}`,
      );
    }
    return l2Normalize(raw);
  } catch (err) {
    if (err.message?.startsWith('Cannot embed') || err.message?.startsWith('Failed to load')) {
      throw err;
    }
    throw new Error(`Query embedding failed: ${err.message}`);
  }
}
