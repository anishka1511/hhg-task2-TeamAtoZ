/**
 * GET /api/health
 * Builder 1: services.qdrant from pingQdrant().
 * Builder 2 owns stt / llm — leave those as currently defined.
 */

import { pingQdrant } from '../services/retrieve/qdrantClient.js';

export async function registerHealthRoutes(fastify) {
  fastify.get('/api/health', async () => {
    const qdrant = await pingQdrant();
    return {
      status: 'ok',
      services: {
        qdrant,
        stt: 'not_wired',
        llm: 'not_wired',
      },
    };
  });
}
