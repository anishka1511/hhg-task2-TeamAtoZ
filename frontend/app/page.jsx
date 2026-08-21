'use client';

import { useEffect, useRef, useState } from 'react';
import successMock from '../mocks/query.success.json';
import refusedMock from '../mocks/query.refused.json';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || '';
const SILENCE_MS = Number(process.env.NEXT_PUBLIC_VOICE_SILENCE_MS || 1500);

function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (DEMO_PASSWORD) headers['x-demo-password'] = DEMO_PASSWORD;
  return headers;
}

function streamWsUrl() {
  const u = new URL(API_URL);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = '/api/stt/stream';
  u.search = '';
  if (DEMO_PASSWORD) u.searchParams.set('demo_password', DEMO_PASSWORD);
  return u.toString();
}

function downsampleTo16k(input, inputRate) {
  const target = 16000;
  if (inputRate === target) return input;
  const ratio = inputRate / target;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i += 1) {
    out[i] = input[Math.min(input.length - 1, Math.floor(i * ratio))];
  }
  return out;
}

function floatTo16BitPCM(float32) {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

const STRATEGIES = [
  { value: 'fixed_overlap', label: 'fixed_overlap' },
  { value: 'semantic', label: 'semantic' },
  { value: 'metadata_aware', label: 'metadata_aware' },
];

/**
 * Builder 2: functional baseline for e2e demos.
 * Live mic: Sarvam streaming STT → text box → auto-submit on pause.
 * Member 3: polish layout/CSS only — do not change API contract.
 */
export default function Home() {
  const [health, setHealth] = useState('checking…');
  const [question, setQuestion] = useState('');
  const [strategy, setStrategy] = useState('fixed_overlap');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const strategyRef = useRef(strategy);
  const liveRef = useRef({
    ws: null,
    context: null,
    stream: null,
    processor: null,
    source: null,
    dest: null,
    silenceTimer: null,
    transcript: '',
    submitted: false,
    cancelOnly: false,
  });

  useEffect(() => {
    strategyRef.current = strategy;
  }, [strategy]);

  useEffect(() => {
    if (USE_MOCKS) {
      setHealth('mocks mode');
      return;
    }
    fetch(`${API_URL}/api/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const q = data.services?.qdrant?.ok ? 'qdrant ok' : 'qdrant down';
        const llm = data.services?.llm || '?';
        const stt = data.services?.stt || '?';
        setHealth(`${data.status || 'ok'} · ${q} · llm ${llm} · stt ${stt}`);
      })
      .catch(() => setHealth('unreachable'));
  }, []);

  useEffect(() => {
    return () => {
      stopLiveSession({ cancelOnly: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runQuery(q, source) {
    const res = await fetch(`${API_URL}/api/query`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        question: q,
        source,
        chunking_strategy: strategyRef.current,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        [data.message || data.error || 'Query failed', data.stage ? `(stage: ${data.stage})` : '']
          .filter(Boolean)
          .join(' '),
      );
    }
    return data;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading || recording) return;

    setLoading(true);
    setError('');
    setResult(null);
    setStatus('retrieving…');

    try {
      if (USE_MOCKS) {
        const mock = q.toLowerCase().includes('weather') ? refusedMock : successMock;
        setResult(mock);
        return;
      }
      const data = await runQuery(q, 'text');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  function clearSilenceTimer() {
    const live = liveRef.current;
    if (live.silenceTimer) {
      clearTimeout(live.silenceTimer);
      live.silenceTimer = null;
    }
  }

  function armSilenceTimer() {
    const live = liveRef.current;
    clearSilenceTimer();
    live.silenceTimer = setTimeout(() => {
      if (!live.submitted && live.transcript.trim()) {
        finishAndQuery();
      }
    }, SILENCE_MS);
  }

  function teardownAudio() {
    const live = liveRef.current;
    clearSilenceTimer();
    try {
      live.processor?.disconnect?.();
      live.source?.disconnect?.();
      live.dest?.disconnect?.();
    } catch {
      /* ignore */
    }
    try {
      if (live.context && live.context.state !== 'closed') live.context.close();
    } catch {
      /* ignore */
    }
    live.stream?.getTracks?.().forEach((t) => t.stop());
    live.processor = null;
    live.source = null;
    live.dest = null;
    live.context = null;
    live.stream = null;
  }

  function stopLiveSession({ cancelOnly = false } = {}) {
    const live = liveRef.current;
    live.cancelOnly = cancelOnly;
    clearSilenceTimer();
    try {
      if (live.ws && live.ws.readyState === WebSocket.OPEN) {
        live.ws.send(JSON.stringify({ type: 'flush' }));
        live.ws.send(JSON.stringify({ type: 'stop' }));
        live.ws.close();
      }
    } catch {
      /* ignore */
    }
    live.ws = null;
    teardownAudio();
    setRecording(false);
  }

  async function finishAndQuery() {
    const live = liveRef.current;
    if (live.submitted) return;
    const q = (live.transcript || '').trim();
    if (!q) {
      stopLiveSession({ cancelOnly: true });
      setStatus('');
      setError('No speech detected. Try again.');
      return;
    }
    live.submitted = true;
    clearSilenceTimer();
    stopLiveSession({ cancelOnly: false });
    setQuestion(q);
    setLoading(true);
    setError('');
    setResult(null);
    setStatus('retrieving…');

    try {
      if (USE_MOCKS) {
        setResult(successMock);
        return;
      }
      const data = await runQuery(q, 'voice');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Voice path failed');
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  async function startLiveMic() {
    setError('');
    setResult(null);
    setQuestion('');
    liveRef.current.transcript = '';
    liveRef.current.submitted = false;
    liveRef.current.cancelOnly = false;

    if (USE_MOCKS) {
      setRecording(true);
      setStatus('recording (mock)…');
      setQuestion('What was the Manhattan Project?');
      liveRef.current.transcript = 'What was the Manhattan Project?';
      setTimeout(() => finishAndQuery(), 800);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    const ws = new WebSocket(streamWsUrl());
    liveRef.current.ws = ws;

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('STT stream connect timeout')), 10000);
      ws.onopen = () => {
        clearTimeout(t);
        resolve();
      };
      ws.onerror = () => {
        clearTimeout(t);
        reject(new Error('STT stream failed to connect'));
      };
    });

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'partial' || msg.type === 'final') {
        const text = String(msg.text || '').trim();
        if (!text) return;
        liveRef.current.transcript = text;
        setQuestion(text);
        setStatus('listening… (pause to search)');
        armSilenceTimer();
        if (msg.type === 'final') {
          // slight delay so flush can settle, then silence timer still wins if user keeps talking
          armSilenceTimer();
        }
        return;
      }
      if (msg.type === 'vad') {
        const sig = String(msg.signal || '').toUpperCase();
        if (sig.includes('END') || sig.includes('STOP')) {
          armSilenceTimer();
        }
        return;
      }
      if (msg.type === 'error') {
        setError(msg.message || 'STT stream error');
        stopLiveSession({ cancelOnly: true });
        setStatus('');
      }
    };

    ws.onclose = () => {
      if (!liveRef.current.submitted && recording) {
        // unexpected close
      }
    };

    const context = new AudioContext();
    if (context.state === 'suspended') await context.resume();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const dest = context.createMediaStreamDestination();

    processor.onaudioprocess = (ev) => {
      if (!liveRef.current.ws || liveRef.current.ws.readyState !== WebSocket.OPEN) return;
      const input = ev.inputBuffer.getChannelData(0);
      const down = downsampleTo16k(input, context.sampleRate);
      const pcm = floatTo16BitPCM(down);
      try {
        liveRef.current.ws.send(pcm);
      } catch {
        /* ignore */
      }
    };

    source.connect(processor);
    processor.connect(dest);

    liveRef.current.context = context;
    liveRef.current.stream = stream;
    liveRef.current.processor = processor;
    liveRef.current.source = source;
    liveRef.current.dest = dest;

    setRecording(true);
    setStatus('listening… speak, then pause to search');
  }

  async function toggleMic() {
    if (loading) return;

    if (recording) {
      // Manual Stop = cancel (do not auto-submit)
      stopLiveSession({ cancelOnly: true });
      setStatus('');
      setError('');
      return;
    }

    try {
      await startLiveMic();
    } catch (err) {
      stopLiveSession({ cancelOnly: true });
      setError(
        err.name === 'NotAllowedError' ? 'Mic permission denied' : err.message || 'Mic error',
      );
      setRecording(false);
      setStatus('');
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Team AtoZ · HHG Task 2
        </p>
        <h1 style={{ margin: '0.35rem 0' }}>Voice RAG</h1>
        <p style={{ margin: 0, color: '#444' }}>
          Text or mic → Sarvam STT → retrieve → Groq answer → guardrails.
        </p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          API: <code>{API_URL}</code> · health: <strong>{health}</strong>
        </p>
      </header>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question (or tap Mic — live transcript)"
            style={{ flex: 1, padding: '0.65rem 0.75rem', fontSize: 16 }}
            disabled={loading || recording}
          />
          <button type="submit" disabled={loading || recording || !question.trim()} style={{ padding: '0.65rem 1rem' }}>
            {loading ? '…' : 'Ask'}
          </button>
          <button
            type="button"
            onClick={toggleMic}
            disabled={loading && !recording}
            style={{
              padding: '0.65rem 1rem',
              background: recording ? '#c62828' : undefined,
              color: recording ? '#fff' : undefined,
            }}
          >
            {recording ? 'Cancel' : 'Mic'}
          </button>
        </div>
        <label style={{ fontSize: 13, color: '#444' }}>
          Chunking strategy{' '}
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            disabled={loading || recording}
            style={{ marginLeft: 6, padding: '0.35rem' }}
          >
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      <p style={{ fontSize: 13, color: '#666' }}>
        Mic streams live Sarvam STT into the box (Google-like). Pause ~{Math.round(SILENCE_MS / 1000)}s to auto-search.
        Cancel stops without sending. Prefer text Ask to save credits.
        {status ? (
          <>
            {' '}
            Status: <strong>{status}</strong>
          </>
        ) : null}
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#fde8e8', borderRadius: 8 }}>{error}</div>
      )}

      {result && (
        <section style={{ marginTop: 20 }}>
          {result.answer_mr ? (
            <>
              <h2 style={{ fontSize: 18 }}>मराठी</h2>
              <p lang="mr">{result.answer_mr}</p>
            </>
          ) : null}

          {result.answer_hi ? (
            <>
              <h2 style={{ fontSize: 18, marginTop: result.answer_mr ? 16 : 0 }}>हिंदी</h2>
              <p lang="hi">{result.answer_hi}</p>
            </>
          ) : null}

          <h2 style={{ fontSize: 18, marginTop: result.answer_mr || result.answer_hi ? 16 : 0 }}>
            {result.answer_mr || result.answer_hi ? 'Answer (English)' : 'Answer'}
          </h2>
          <p>{result.answer}</p>

          {result.meta?.language && result.meta.language !== 'en' ? (
            <p style={{ fontSize: 12, color: '#666' }}>
              Detected: {result.meta.language}
              {result.meta.retrieve_question
                ? ` · retrieved with: “${result.meta.retrieve_question}”`
                : ''}
            </p>
          ) : null}

          {result.guardrail && (
            <p
              style={{
                fontSize: 14,
                padding: '8px 10px',
                borderRadius: 6,
                background: result.guardrail.allowed ? '#e8f6ec' : '#fff4e5',
              }}
            >
              Guardrail:{' '}
              {result.guardrail.allowed
                ? 'allowed'
                : `refused — ${result.guardrail.reason || 'n/a'}`}
            </p>
          )}

          {result.latency_ms && (
            <pre style={{ fontSize: 12, background: '#f4f4f4', padding: 12, overflow: 'auto' }}>
              {JSON.stringify(result.latency_ms, null, 2)}
            </pre>
          )}

          {Array.isArray(result.contexts) && result.contexts.length > 0 && (
            <>
              <h3 style={{ fontSize: 16 }}>Contexts</h3>
              <ul>
                {result.contexts.map((c) => (
                  <li key={c.id} style={{ marginBottom: 8 }}>
                    <strong>{c.score?.toFixed?.(3) ?? c.score}</strong> [{c.strategy}] — {c.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}
