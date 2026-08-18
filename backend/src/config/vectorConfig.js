/**
 * Vector / Qdrant config — aligned with indexing/config.yaml (Builder 1).
 *
 * collection: msmarco_xi
 * vector_size: 384 (sentence-transformers/all-MiniLM-L6-v2)
 * distance: Cosine
 */

export const vectorConfig = {
  collectionName: process.env.QDRANT_COLLECTION || 'msmarco_xi',
  vectorSize: 384,
  distance: 'Cosine',
  // Same MiniLM used by indexing/scripts/build_index.py (sentence-transformers).
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  // ONNX port of those weights for @xenova/transformers (in-process Node).
  xenovaEmbeddingModel: 'Xenova/all-MiniLM-L6-v2',
};

export const qdrantConfig = {
  url: process.env.QDRANT_URL || 'http://localhost:6333',
};
