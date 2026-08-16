/**
 * Shared vector config stub — Owner: Builder 1
 * Update dim/model when embedding choice is finalized.
 */

export const vectorConfig = {
  collectionName: process.env.QDRANT_COLLECTION || 'msmarco_xi',
  // Provisional — change when embedding model is chosen (Builder 1)
  vectorSize: 384,
  distance: 'Cosine',
};

export const qdrantConfig = {
  url: process.env.QDRANT_URL || 'http://localhost:6333',
};
