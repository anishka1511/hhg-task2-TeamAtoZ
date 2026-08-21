/**
 * Sarvam STT adapter — Owner: Builder 2
 * POST https://api.sarvam.ai/speech-to-text
 * Auth: api-subscription-key (never log the key)
 *
 * @see https://docs.sarvam.ai/api-reference/speech-to-text/transcribe
 */

import { File } from 'node:buffer';

const SARVAM_URL = 'https://api.sarvam.ai/speech-to-text';
const MAX_BYTES = Number(process.env.SARVAM_MAX_BYTES || 5 * 1024 * 1024); // ~few MB / ~30s
const DEFAULT_MODEL = process.env.SARVAM_MODEL || 'saaras:v3';
const DEFAULT_MODE = process.env.SARVAM_MODE || 'transcribe';
const MIN_BYTES = Number(process.env.SARVAM_MIN_BYTES || 2500); // tiny blobs ≈ silence / click-only

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

function normalizeMime(mimetype) {
  return String(mimetype || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
}

function isAllowedMime(mimetype, filename = '') {
  const mime = normalizeMime(mimetype);
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

function pickFilename(filename, mimetype) {
  const name = String(filename || '').trim() || 'recording.webm';
  if (/\.[a-z0-9]+$/i.test(name)) return name;
  const mime = normalizeMime(mimetype);
  if (mime.includes('wav')) return `${name}.wav`;
  if (mime.includes('mpeg') || mime.includes('mp3')) return `${name}.mp3`;
  if (mime.includes('ogg')) return `${name}.ogg`;
  if (mime.includes('mp4') || mime.includes('m4a')) return `${name}.m4a`;
  return `${name}.webm`;
}

async function callSarvamOnce({ apiKey, buffer, filename, mimetype, language, withTimestamps }) {
  const form = new FormData();
  const type = normalizeMime(mimetype) || 'audio/webm';
  // File (not bare Blob) so Sarvam gets a real filename + content-type in multipart.
  const file = new File([buffer], pickFilename(filename, type), { type });
  form.append('file', file);
  form.append('model', DEFAULT_MODEL);
  form.append('mode', DEFAULT_MODE);
  form.append('language_code', language);
  if (withTimestamps) form.append('with_timestamps', 'true');

  const res = await fetch(SARVAM_URL, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
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

  if (!buffer || (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array))) {
    return fail(400, 'bad_audio', 'Audio buffer is required.');
  }

  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length === 0) {
    return fail(400, 'bad_audio', 'Audio file is empty.');
  }
  if (bytes.length < MIN_BYTES) {
    return fail(
      400,
      'audio_too_short',
      'Recording too short or silent. Hold Mic 2–3 seconds and speak clearly, then Stop.',
    );
  }
  if (bytes.length > MAX_BYTES) {
    return fail(
      400,
      'audio_too_large',
      `Audio exceeds max size of ${Math.round(MAX_BYTES / (1024 * 1024))}MB.`,
    );
  }

  const filename = meta.filename || 'recording.webm';
  const mimetype = normalizeMime(meta.mimetype) || 'audio/webm';
  if (!isAllowedMime(mimetype, filename)) {
    return fail(
      400,
      'unsupported_mime',
      `Unsupported audio type "${mimetype}". Use wav, mp3, webm, m4a, ogg, or flac.`,
    );
  }

  const languagePrimary = process.env.SARVAM_LANGUAGE || 'en-IN';
  const attempts = [
    { language: languagePrimary, withTimestamps: true },
    { language: languagePrimary, withTimestamps: false },
    { language: 'unknown', withTimestamps: false },
  ];

  const started = Date.now();
  let lastEmpty = null;
  let lastErr = null;

  for (let attempt = 0; attempt < attempts.length; attempt += 1) {
    const opts = attempts[attempt];
    try {
      const { res, data } = await callSarvamOnce({
        apiKey,
        buffer: bytes,
        filename,
        mimetype,
        language: opts.language,
        withTimestamps: opts.withTimestamps,
      });

      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(data.message || data.error?.message || `Sarvam HTTP ${res.status}`);
        lastErr.statusCode = res.status === 429 ? 429 : 503;
        if (attempt < attempts.length - 1) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
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
        lastEmpty = data;
        console.log(
          JSON.stringify({
            event: 'sarvam_stt',
            ok: false,
            reason: 'empty_transcript',
            bytes: bytes.length,
            mime: mimetype,
            language: opts.language,
            language_code: data.language_code || null,
            request_id: data.request_id || null,
          }),
        );
        if (attempt < attempts.length - 1) continue;
        return fail(
          502,
          'stt_empty',
          'Sarvam heard no speech. Hold Mic 2–3s, speak clearly in English (or set SARVAM_LANGUAGE), then Stop.',
        );
      }

      const duration_ms = durationFromTimestamps(data.timestamps);
      const elapsed = Date.now() - started;
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
      if (attempt < attempts.length - 1 && (timedOut || /fetch failed|econnreset|network/i.test(err.message || ''))) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return fail(timedOut ? 504 : 503, timedOut ? 'stt_timeout' : 'stt_failed', err.message || 'STT failed');
    }
  }

  if (lastEmpty) {
    return fail(502, 'stt_empty', 'Sarvam returned an empty transcript.');
  }
  return fail(503, 'stt_failed', lastErr?.message || 'STT failed after retries');
}
