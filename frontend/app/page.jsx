'use client';

import { useEffect, useState } from 'react';
import successMock from '../mocks/query.success.json';
import refusedMock from '../mocks/query.refused.json';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

/**
 * Builder 2: keep this functional for e2e demos.
 * Member 3: polish layout/CSS only — do not change API contract.
 */
export default function Home() {
  const [health, setHealth] = useState('checking…');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (USE_MOCKS) {
      setHealth('mocks mode');
      return;
    }
    fetch(`${API_URL}/api/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setHealth(data.status || 'ok'))
      .catch(() => setHealth('unreachable'));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      if (USE_MOCKS) {
        const mock = q.toLowerCase().includes('weather') ? refusedMock : successMock;
        setResult(mock);
        return;
      }

      // Builder 2's /api/query (LLM) is not implemented yet (501).
      // Use retrieve-only so the UI can demo indexed passages.
      const res = await fetch(`${API_URL}/api/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, strategy: 'fixed_overlap', top_k: 5 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || 'Query failed');
        return;
      }
      const top = data.contexts?.[0];
      setResult({
        answer: top
          ? `Retrieved ${data.contexts.length} passages (no LLM yet). Top match:`
          : 'No matching passages.',
        contexts: data.contexts || [],
      });
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Team AtoZ · HHG Task 2
        </p>
        <h1 style={{ margin: '0.35rem 0' }}>Voice RAG (scaffold)</h1>
        <p style={{ margin: 0, color: '#444' }}>
          Retrieval is live (passages from Qdrant). LLM answers come when Builder 2 wires generation.
        </p>
        <p style={{ marginTop: 8, fontSize: 14 }}>
          API: <code>{API_URL}</code> · health: <strong>{health}</strong>
        </p>
      </header>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question (text fallback)"
          style={{ flex: 1, padding: '0.65rem 0.75rem', fontSize: 16 }}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !question.trim()} style={{ padding: '0.65rem 1rem' }}>
          {loading ? '…' : 'Ask'}
        </button>
      </form>

      <p style={{ fontSize: 13, color: '#666' }}>
        Mic button: TODO (Member 3 UI + Builder 2 Sarvam). Tip: set{' '}
        <code>NEXT_PUBLIC_USE_MOCKS=true</code> to design against mocks.
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#fde8e8', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {result && (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18 }}>Answer</h2>
          <p>{result.answer}</p>

          {result.guardrail && (
            <p style={{ fontSize: 14 }}>
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
                    <strong>{c.score?.toFixed?.(3) ?? c.score}</strong> — {c.text}
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
