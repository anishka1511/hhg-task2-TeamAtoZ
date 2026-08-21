/**
 * POST /api/stt — multipart audio → transcript (Sarvam)
 * Owner: Builder 2
 */

import { transcribeAudio } from '../services/stt/sarvam.js';

export async function registerSttRoutes(fastify) {
  fastify.post('/api/stt', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Expected multipart field "file" with audio.',
      });
    }

    let buffer;
    try {
      buffer = await file.toBuffer();
    } catch (err) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: err.message || 'Failed to read uploaded audio.',
      });
    }

    const result = await transcribeAudio(buffer, {
      filename: file.filename,
      mimetype: file.mimetype,
    });

    if (!result.ok) {
      return reply.code(result.statusCode || 501).send({
        error: result.error,
        message: result.message,
      });
    }

    return {
      transcript: result.transcript,
      duration_ms: result.duration_ms ?? null,
      provider: 'sarvam',
    };
  });
}
