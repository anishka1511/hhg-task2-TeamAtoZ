/**
 * HHG Task 2 — Fastify API scaffold
 *
 * Frozen contract (see docs/TEAM_TASKS.md):
 *   GET  /api/health
 *   POST /api/stt
 *   POST /api/query
 *
 * Feature work: Builder 2 owns pipeline; Builder 1 owns retrieve wiring.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import 'dotenv/config';

import { registerHealthRoutes } from './routes/health.js';
import { registerSttRoutes } from './routes/stt.js';
import { registerQueryRoutes } from './routes/query.js';
import { registerRetrieveRoutes } from './routes/retrieve.js';

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: CORS_ORIGIN });
await fastify.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 },
});

await registerHealthRoutes(fastify);
await registerSttRoutes(fastify);
await registerQueryRoutes(fastify);
await registerRetrieveRoutes(fastify);

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Backend listening on http://localhost:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
