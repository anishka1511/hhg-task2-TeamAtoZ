/**
 * GET /api/health
 * TODO (Builder 2): probe Qdrant / Sarvam / LLM and report real status.
 */

export async function registerHealthRoutes(fastify) {
  fastify.get('/api/health', async () => ({
    status: 'ok',
    services: {
      qdrant: 'not_wired',
      stt: 'not_wired',
      llm: 'not_wired',
    },
  }));
}
