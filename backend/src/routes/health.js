/**
 * GET /api/health
 * Builder 1: services.qdrant from pingQdrant() — do not reshape.
 * Builder 2: stt / llm report whether keys are present.
 *   not_wired  = env key missing
 *   ok         = key present (adapter wired)
 */

import { pingQdrant } from '../services/retrieve/qdrantClient.js';

function hasEnv(name) {
  const value = process.env[name];
  return Boolean(value && String(value).trim());
}

export async function registerHealthRoutes(fastify) {
  fastify.get('/api/health', async () => {
    const qdrant = await pingQdrant();
    return {
      status: 'ok',
      services: {
        qdrant,
        stt: hasEnv('SARVAM_API_KEY') ? 'ok' : 'not_wired',
        llm: hasEnv('LLM_API_KEY') ? 'ok' : 'not_wired',
      },
    };
  });
}
