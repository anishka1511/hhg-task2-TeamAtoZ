/**
 * Sarvam streaming STT — WebSocket client (Builder 2).
 * Connects to wss://api.sarvam.ai/speech-to-text/ws; never log the API key.
 *
 * @see https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe/ws
 */

import WebSocket from 'ws';

const SARVAM_WS_BASE =
  process.env.SARVAM_WEBSOCKET_URL || 'wss://api.sarvam.ai/speech-to-text/ws';

/**
 * Open a Sarvam streaming session and wire callbacks.
 * @param {{
 *   onEvent: (evt: { type: string, text?: string, signal?: string, message?: string, raw?: unknown }) => void,
 *   onClose?: () => void,
 *   onError?: (err: Error) => void,
 * }} handlers
 */
export function openSarvamStream(handlers = {}) {
  const apiKey = process.env.SARVAM_API_KEY && String(process.env.SARVAM_API_KEY).trim();
  if (!apiKey) {
    throw new Error('SARVAM_API_KEY not set');
  }

  const model = process.env.SARVAM_STREAM_MODEL || process.env.SARVAM_MODEL || 'saaras:v3';
  const language = process.env.SARVAM_LANGUAGE || 'en-IN';
  const mode = process.env.SARVAM_MODE || 'transcribe';
  const sampleRate = String(process.env.SARVAM_STREAM_SAMPLE_RATE || '16000');

  const params = new URLSearchParams({
    model,
    mode,
    'language-code': language,
    sample_rate: sampleRate,
    input_audio_codec: 'pcm_s16le',
    vad_signals: 'true',
    high_vad_sensitivity: 'true',
    flush_signal: 'true',
  });

  const url = `${SARVAM_WS_BASE}?${params.toString()}`;
  const ws = new WebSocket(url, {
    headers: {
      'api-subscription-key': apiKey,
      'Api-Subscription-Key': apiKey,
    },
  });

  let opened = false;

  ws.on('open', () => {
    opened = true;
    handlers.onEvent?.({ type: 'ready' });
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      handlers.onEvent?.({ type: 'error', message: 'Invalid JSON from Sarvam stream' });
      return;
    }

    const t = msg.type;
    if (t === 'data' || t === 'transcript') {
      const payload = msg.data || msg;
      const text =
        (typeof payload.transcript === 'string' && payload.transcript) ||
        (typeof payload.text === 'string' && payload.text) ||
        '';
      const isFinal = Boolean(payload.is_final || payload.final || payload.speech_final);
      handlers.onEvent?.({
        type: isFinal ? 'final' : 'partial',
        text: text.trim(),
        raw: msg,
      });
      return;
    }

    if (t === 'events' || t === 'event' || t === 'vad') {
      const signal =
        msg.data?.signal ||
        msg.data?.event ||
        msg.signal ||
        msg.event ||
        (typeof msg.data === 'string' ? msg.data : null);
      handlers.onEvent?.({
        type: 'vad',
        signal: signal ? String(signal) : undefined,
        raw: msg,
      });
      return;
    }

    if (t === 'error') {
      const message = msg.data?.message || msg.message || 'Sarvam stream error';
      handlers.onEvent?.({ type: 'error', message: String(message), raw: msg });
      return;
    }

    // Unknown — surface VAD-like signals if present
    const signal = msg.data?.signal || msg.signal;
    if (signal) {
      handlers.onEvent?.({ type: 'vad', signal: String(signal), raw: msg });
    }
  });

  ws.on('error', (err) => {
    handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
  });

  ws.on('close', () => {
    handlers.onClose?.();
  });

  return {
    ready: () => opened && ws.readyState === WebSocket.OPEN,
    /**
     * @param {Buffer|Uint8Array} pcmChunk raw pcm_s16le mono
     */
    sendPcm(pcmChunk) {
      if (ws.readyState !== WebSocket.OPEN) return;
      const buf = Buffer.isBuffer(pcmChunk) ? pcmChunk : Buffer.from(pcmChunk);
      if (!buf.length) return;
      ws.send(
        JSON.stringify({
          audio: {
            data: buf.toString('base64'),
            sample_rate: sampleRate,
            encoding: 'audio/wav',
          },
        }),
      );
    },
    flush() {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'flush' }));
    },
    close() {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'flush' }));
        }
      } catch {
        /* ignore */
      }
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    },
  };
}
