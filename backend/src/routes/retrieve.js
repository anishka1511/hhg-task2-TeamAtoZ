/**
 * POST /api/retrieve — debug/isolation path for Builder 1.
 * Builder 2's /api/query calls retrieve() directly; do not wire that here.
 */

import { retrieve } from '../services/retrieve/index.js';

export async function registerRetrieveRoutes(fastify) {
  fastify.post('/api/retrieve', async (request, reply) => {
    const body = request.body || {};
    const question = typeof body.question === 'string' ? body.question : '';
    const strategy = body.strategy || 'fixed_overlap';
    const top_k = body.top_k ?? 5;

    const result = await retrieve(question, { strategy, top_k });

    if (!result.ok) {
      if (result.error === 'empty_query' || result.error === 'unknown_strategy') {
        return reply.code(400).send(result);
      }
      return reply.code(503).send(result);
    }

    return reply.code(200).send(result);
  });
}
