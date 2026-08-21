'use client';

import { useEffect, useRef, useState } from 'react';
import successMock from '../mocks/query.success.json';
import refusedMock from '../mocks/query.refused.json';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || '';

function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (DEMO_PASSWORD) headers['x-demo-password'] = DEMO_PASSWORD;
  return headers;
}

const STRATEGIES = [
  { value: 'fixed_overlap', label: 'fixed_overlap' },
  { value: 'semantic', label: 'semantic' },
  { value: 'metadata_aware', label: 'metadata_aware' },
];

/**
 * Builder 2: functional baseline for e2e demos.
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
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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

  async function runQuery(q, source) {
    const res = await fetch(`${API_URL}/api/query`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        question: q,
        source,
        chunking_strategy: strategy,
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

  async function toggleMic() {
    if (loading) return;

    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    setError('');
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data?.size) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime.split(';')[0] });
        if (!blob.size) {
          setError('No audio captured. Try again.');
          return;
        }

        setLoading(true);
        setStatus('transcribing…');
        try {
          if (USE_MOCKS) {
            setQuestion('What was the Manhattan Project?');
            setResult(successMock);
            return;
          }

          const form = new FormData();
          form.append('file', blob, 'recording.webm');
          const sttRes = await fetch(`${API_URL}/api/stt`, {
            method: 'POST',
            headers: apiHeaders(),
            body: form,
          });
          const sttData = await sttRes.json();
          if (!sttRes.ok) {
            throw new Error(sttData.message || sttData.error || 'STT failed');
          }

          const transcript = String(sttData.transcript || '').trim();
          if (!transcript) throw new Error('Empty transcript from Sarvam');
          setQuestion(transcript);
          setStatus('retrieving…');
          const data = await runQuery(transcript, 'voice');
          if (data.latency_ms && sttData.duration_ms != null) {
            data.latency_ms = { ...data.latency_ms, stt: sttData.duration_ms };
          }
          setResult(data);
        } catch (err) {
          setError(err.message || 'Voice path failed');
        } finally {
          setLoading(false);
          setStatus('');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setStatus('recording… click Mic again to stop');
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Mic permission denied' : err.message || 'Mic error');
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
            placeholder="Ask a question (text fallback)"
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
            {recording ? 'Stop' : 'Mic'}
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
        Prefer text while developing (saves Sarvam credits). Mic records WebM → <code>/api/stt</code> →{' '}
        <code>/api/query</code>.
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
          <h2 style={{ fontSize: 18 }}>Answer</h2>
          <p>{result.answer}</p>

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
