/**
 * WS /api/stt/stream — browser PCM ↔ Sarvam streaming proxy (Builder 2).
 * Client messages:
 *   binary Int16 PCM frames, or JSON { type: "pcm", data: "<base64>" }
 *   JSON { type: "flush" } | { type: "stop" }
 * Server messages:
 *   { type: "ready"|"partial"|"final"|"vad"|"error"|"closed", text?, signal?, message? }
 */

import { openSarvamStream } from '../services/stt/sarvamStream.js';

function sendJson(socket, obj) {
  if (socket.readyState === 1 /* OPEN */) {
    socket.send(JSON.stringify(obj));
  }
}

export async function registerSttStreamRoutes(fastify) {
  // @fastify/websocket v8: handler gets (connection, request); use connection.socket
  fastify.get('/api/stt/stream', { websocket: true }, (connection, _request) => {
    const socket = connection.socket || connection;

    const apiKey = process.env.SARVAM_API_KEY && String(process.env.SARVAM_API_KEY).trim();
    if (!apiKey) {
      sendJson(socket, { type: 'error', message: 'SARVAM_API_KEY not configured' });
      socket.close();
      return;
    }

    let upstream;
    let closed = false;

    const idleMs = Number(process.env.SARVAM_STREAM_IDLE_MS || 120_000);
    let idleTimer = setTimeout(() => {
      sendJson(socket, { type: 'error', message: 'Stream idle timeout' });
      cleanup();
    }, idleMs);

    function bumpIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        sendJson(socket, { type: 'error', message: 'Stream idle timeout' });
        cleanup();
      }, idleMs);
    }

    function cleanup() {
      if (closed) return;
      closed = true;
      clearTimeout(idleTimer);
      try {
        upstream?.close();
      } catch {
        /* ignore */
      }
      try {
        if (socket.readyState === 1) {
          sendJson(socket, { type: 'closed' });
          socket.close();
        }
      } catch {
        /* ignore */
      }
    }

    try {
      upstream = openSarvamStream({
        onEvent: (evt) => {
          bumpIdle();
          sendJson(socket, evt);
        },
        onError: (err) => {
          sendJson(socket, { type: 'error', message: err.message || 'Sarvam WS error' });
          cleanup();
        },
        onClose: () => {
          if (!closed) {
            sendJson(socket, { type: 'closed' });
            cleanup();
          }
        },
      });
    } catch (err) {
      sendJson(socket, { type: 'error', message: err.message || 'Failed to open Sarvam stream' });
      socket.close();
      return;
    }

    socket.on('message', (raw, isBinary) => {
      if (closed) return;
      bumpIdle();

      try {
        if (isBinary || Buffer.isBuffer(raw)) {
          const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          // Skip tiny frames (JSON mistaken as binary unlikely)
          if (buf.length >= 2) upstream.sendPcm(buf);
          return;
        }

        const text = raw.toString();
        let msg;
        try {
          msg = JSON.parse(text);
        } catch {
          upstream.sendPcm(Buffer.from(text, 'base64'));
          return;
        }

        if (msg.type === 'pcm' && typeof msg.data === 'string') {
          upstream.sendPcm(Buffer.from(msg.data, 'base64'));
          return;
        }
        if (msg.type === 'flush') {
          upstream.flush();
          return;
        }
        if (msg.type === 'stop' || msg.type === 'close') {
          cleanup();
          return;
        }
      } catch (err) {
        sendJson(socket, { type: 'error', message: err.message || 'Bad client frame' });
      }
    });

    socket.on('close', () => cleanup());
    socket.on('error', () => cleanup());
  });
}
