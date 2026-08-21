/**
 * Soft rate limit + optional demo password gate (Builder 2 — M8).
 * Protects Sarvam / Groq credits on public demos.
 *
 * Env:
 *   DEMO_PASSWORD          if set, require header x-demo-password (or body.demo_password)
 *   RATE_LIMIT_MAX         requests per window per IP (default 60)
 *   RATE_LIMIT_WINDOW_MS   window size (default 60000)
 */

const hits = new Map();

function clientIp(request) {
  const xf = request.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return request.ip || 'unknown';
}

function prune(windowMs) {
  const now = Date.now();
  for (const [key, times] of hits.entries()) {
    const kept = times.filter((t) => now - t < windowMs);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
  }
}

export function registerHardening(fastify) {
  const demoPassword = process.env.DEMO_PASSWORD && String(process.env.DEMO_PASSWORD).trim();
  const max = Number(process.env.RATE_LIMIT_MAX || 60);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);

  fastify.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0];
    const protectedPath =
      url === '/api/query' || url === '/api/stt' || url.startsWith('/api/query') || url.startsWith('/api/stt');
    if (!protectedPath) return;

    // Rate limit
    prune(windowMs);
    const ip = clientIp(request);
    const key = `${ip}:${url.startsWith('/api/stt') ? 'stt' : 'query'}`;
    const times = hits.get(key) || [];
    const recent = times.filter((t) => Date.now() - t < windowMs);
    if (recent.length >= max) {
      return reply.code(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded (${max} req / ${Math.round(windowMs / 1000)}s). Try again shortly.`,
      });
    }
    recent.push(Date.now());
    hits.set(key, recent);

    // Demo password (optional)
    if (demoPassword) {
      const header = request.headers['x-demo-password'];
      const fromHeader = typeof header === 'string' ? header : '';
      // Body not parsed yet on onRequest for JSON — also allow query string for quick demos.
      const fromQuery =
        typeof request.query?.demo_password === 'string' ? request.query.demo_password : '';
      if (fromHeader !== demoPassword && fromQuery !== demoPassword) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Demo password required. Send header x-demo-password.',
        });
      }
    }
  });
}
