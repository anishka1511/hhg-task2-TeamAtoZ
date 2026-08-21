/**
 * Sarvam STT adapter — Owner: Builder 2
 * POST https://api.sarvam.ai/speech-to-text
 * Auth: api-subscription-key (never log the key)
 *
 * @see https://docs.sarvam.ai/api-reference/speech-to-text/transcribe
 */

const SARVAM_URL = 'https://api.sarvam.ai/speech-to-text';
const MAX_BYTES = Number(process.env.SARVAM_MAX_BYTES || 5 * 1024 * 1024); // ~few MB / ~30s
const DEFAULT_MODEL = process.env.SARVAM_MODEL || 'saaras:v3';
const DEFAULT_MODE = process.env.SARVAM_MODE || 'transcribe';

const ALLOWED_MIME = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'audio/aac',
  'audio/amr',
  'video/webm', // MediaRecorder often labels webm this way
  'application/octet-stream',
]);

function fail(statusCode, error, message) {
  return { ok: false, statusCode, error, message, transcript: null, duration_ms: null };
}

function isAllowedMime(mimetype, filename = '') {
  const mime = String(mimetype || '').toLowerCase().split(';')[0].trim();
  if (ALLOWED_MIME.has(mime)) return true;
  const name = String(filename || '').toLowerCase();
  return /\.(wav|mp3|m4a|mp4|webm|ogg|opus|flac|aac|amr)$/.test(name);
}

function durationFromTimestamps(timestamps) {
  const ends = timestamps?.end_time_seconds;
  if (!Array.isArray(ends) || ends.length === 0) return null;
  const last = Number(ends[ends.length - 1]);
  if (!Number.isFinite(last) || last < 0) return null;
  return Math.round(last * 1000);
}

async function callSarvamOnce({ apiKey, buffer, filename, mimetype }) {
  const form = new FormData();
  const type = mimetype || 'application/octet-stream';
  const blob = new Blob([buffer], { type });
  form.append('file', blob, filename || 'audio.wav');
  form.append('model', DEFAULT_MODEL);
  form.append('mode', DEFAULT_MODE);
  form.append('language_code', process.env.SARVAM_LANGUAGE || 'unknown');
  form.append('with_timestamps', 'true');

  const res = await fetch(SARVAM_URL, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      // Let fetch set multipart boundary — do not set Content-Type manually.
    },
    body: form,
    signal: AbortSignal.timeout(Number(process.env.SARVAM_TIMEOUT_MS || 30000)),
  });

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: raw.slice(0, 200) };
  }

  return { res, data };
}

/**
 * @param {Buffer|Uint8Array} buffer
 * @param {{ filename?: string, mimetype?: string }} meta
 */
export async function transcribeAudio(buffer, meta = {}) {
  const apiKey = process.env.SARVAM_API_KEY && String(process.env.SARVAM_API_KEY).trim();
  if (!apiKey) {
    return fail(
      501,
      'stt_not_configured',
      'Set SARVAM_API_KEY in .env to enable Sarvam STT.',
    );
  }

  if (!buffer || !Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    return fail(400, 'bad_audio', 'Audio buffer is required.');
  }

  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length === 0) {
    return fail(400, 'bad_audio', 'Audio file is empty.');
  }
  if (bytes.length > MAX_BYTES) {
    return fail(
      400,
      'audio_too_large',
      `Audio exceeds max size of ${Math.round(MAX_BYTES / (1024 * 1024))}MB.`,
    );
  }

  const filename = meta.filename || 'audio.webm';
  const mimetype = meta.mimetype || 'audio/webm';
  if (!isAllowedMime(mimetype, filename)) {
    return fail(
      400,
      'unsupported_mime',
      `Unsupported audio type "${mimetype}". Use wav, mp3, webm, m4a, ogg, or flac.`,
    );
  }

  const started = Date.now();
  let lastErr = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { res, data } = await callSarvamOnce({
        apiKey,
        buffer: bytes,
        filename,
        mimetype,
      });

      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(data.message || data.error?.message || `Sarvam HTTP ${res.status}`);
        lastErr.statusCode = res.status === 429 ? 429 : 503;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        return fail(lastErr.statusCode, 'stt_upstream', lastErr.message);
      }

      if (!res.ok) {
        const detail = data.message || data.error?.message || `Sarvam HTTP ${res.status}`;
        return fail(res.status === 401 || res.status === 403 ? 502 : 400, 'stt_failed', detail);
      }

      const transcript = typeof data.transcript === 'string' ? data.transcript.trim() : '';
      if (!transcript) {
        return fail(502, 'stt_empty', 'Sarvam returned an empty transcript.');
      }

      const duration_ms = durationFromTimestamps(data.timestamps);
      const elapsed = Date.now() - started;
      // Credit / latency tracking — never log the API key.
      console.log(
        JSON.stringify({
          event: 'sarvam_stt',
          ok: true,
          bytes: bytes.length,
          elapsed_ms: elapsed,
          duration_ms,
          language_code: data.language_code || null,
          model: DEFAULT_MODEL,
        }),
      );

      return {
        ok: true,
        transcript,
        duration_ms,
        language_code: data.language_code || null,
      };
    } catch (err) {
      lastErr = err;
      const timedOut = err?.name === 'TimeoutError' || /timeout/i.test(err.message || '');
      if (attempt < 2 && (timedOut || /fetch failed|econnreset|network/i.test(err.message || ''))) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      return fail(timedOut ? 504 : 503, timedOut ? 'stt_timeout' : 'stt_failed', err.message || 'STT failed');
    }
  }

  return fail(503, 'stt_failed', lastErr?.message || 'STT failed after retries');
}
