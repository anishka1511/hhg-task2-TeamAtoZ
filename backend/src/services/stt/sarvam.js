/**
 * Sarvam STT adapter — STUB
 * Owner: Builder 2
 *
 * Implement: upload audio buffer to Sarvam speech-to-text API.
 * See https://docs.sarvam.ai
 */

export async function transcribeAudio(_buffer, _meta = {}) {
  if (!process.env.SARVAM_API_KEY) {
    return {
      ok: false,
      statusCode: 501,
      error: 'Not Implemented',
      message:
        'Sarvam STT not wired yet. Set SARVAM_API_KEY and implement services/stt/sarvam.js (Builder 2).',
    };
  }

  return {
    ok: false,
    statusCode: 501,
    error: 'Not Implemented',
    message: 'TODO(Builder 2): call Sarvam STT and return { transcript, duration_ms }.',
  };
}
