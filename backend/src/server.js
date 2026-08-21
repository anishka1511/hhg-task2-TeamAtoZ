/**
 * HHG Task 2 — Fastify API
 *
 * Frozen contract (see docs/TEAM_TASKS.md):
 *   GET  /api/health
 *   POST /api/stt
 *   WS   /api/stt/stream  (live Sarvam STT proxy — Google-like mic)
 *   POST /api/query
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import 'dotenv/config';

import { registerHealthRoutes } from './routes/health.js';
import { registerSttRoutes } from './routes/stt.js';
import { registerSttStreamRoutes } from './routes/sttStream.js';
import { registerQueryRoutes } from './routes/query.js';
import { registerRetrieveRoutes } from './routes/retrieve.js';
import { registerHardening } from './plugins/hardening.js';
import { embedQuery } from './services/retrieve/embed.js';

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const fastify = Fastify({ logger: true, trustProxy: true });

await fastify.register(cors, { origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN });
await fastify.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 },
});
await fastify.register(websocket);

registerHardening(fastify);

await registerHealthRoutes(fastify);
await registerSttRoutes(fastify);
await registerSttStreamRoutes(fastify);
await registerQueryRoutes(fastify);
await registerRetrieveRoutes(fastify);

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Backend listening on http://localhost:${PORT} (ws /api/stt/stream)`);
  // Warm MiniLM so the first /api/query is not a cold model load (~1–3s).
  embedQuery('warmup').then(
    () => console.log('Embedding model warmed'),
    (err) => console.warn('Embedding warmup skipped:', err.message),
  );
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
