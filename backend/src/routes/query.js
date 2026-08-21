/**
 * POST /api/query — text (or voice transcript) → grounded answer
 * Owner: Builder 2 harness + Builder 1 retrieve
 */

import { normalizeStrategy, runQueryPipeline } from '../services/pipeline.js';

export async function registerQueryRoutes(fastify) {
  fastify.post('/api/query', async (request, reply) => {
    const body = request.body || {};
    const question = typeof body.question === 'string' ? body.question.trim() : '';
    const source = body.source === 'voice' ? 'voice' : 'text';
    const chunking_strategy = normalizeStrategy(body.chunking_strategy);

    if (!question) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Missing required field: "question"',
      });
    }

    const result = await runQueryPipeline({
      question,
      source,
      chunking_strategy,
    });

    if (!result.ok) {
      return reply.code(result.statusCode || 503).send({
        error: result.error,
        message: result.message,
        stage: result.stage,
      });
    }

    return result.payload;
  });
}
