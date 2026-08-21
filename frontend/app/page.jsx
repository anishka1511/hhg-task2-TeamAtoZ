'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import successMock from '../mocks/query.success.json';
import refusedMock from '../mocks/query.refused.json';
import BeachPartyEnvironment from '../components/BeachPartyEnvironment';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || '';

const STRATEGIES = [
  { id: 'fixed_overlap', label: 'fixed overlap' },
  { id: 'semantic', label: 'semantic' },
  { id: 'metadata_aware', label: 'metadata aware' },
  { id: 'token_window', label: 'token window' },
  { id: 'structure_aware', label: 'structure aware' },
  { id: 'recursive', label: 'recursive' },
];

function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (DEMO_PASSWORD) headers['x-demo-password'] = DEMO_PASSWORD;
  return headers;
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [strategy, setStrategy] = useState('fixed_overlap');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState('checking…');
  const [statusMsg, setStatusMsg] = useState(
    'DROP A VOICE BEAT OR ASK A QUESTION IN MARATHI / HINDI / ENGLISH',
  );

  const strategyRef = useRef(strategy);
  const mediaRef = useRef({ recorder: null, chunks: [], stream: null });

  useEffect(() => {
    strategyRef.current = strategy;
  }, [strategy]);

  useEffect(() => {
    if (USE_MOCKS) {
      setHealth('mocks mode');
      return;
    }
    fetch(`${API_URL}/api/health`, { headers: apiHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const q = data.services?.qdrant?.ok ? 'qdrant ok' : 'qdrant down';
        const llm = data.services?.llm || '?';
        const stt = data.services?.stt || '?';
        setHealth(`${data.status || 'ok'} · ${q} · llm ${llm} · stt ${stt}`);
      })
      .catch(() => setHealth('backend unreachable'));
  }, []);

  async function executeQuery(qText, source = 'text') {
    const q = (qText || question).trim();
    if (!q || loading || transcribing) return;

    setLoading(true);
    setResult(null);
    setStatusMsg('🎧 TUNING FREQUENCIES · RETRIEVE → GENERATE…');

    try {
      if (USE_MOCKS) {
        await new Promise((r) => setTimeout(r, 260));
        const qLower = q.toLowerCase();
        const isOffTopic =
          qLower.includes('weather') ||
          qLower.includes('tokyo') ||
          qLower.includes('refuse') ||
          qLower.includes('who are you');
        const mockData = isOffTopic
          ? { ...refusedMock }
          : {
              ...successMock,
              answer: successMock.answer || `Grounded answer for: ${q}`,
            };
        mockData.contexts = (mockData.contexts || []).map((c) => ({
          ...c,
          strategy: strategyRef.current,
        }));
        setResult(mockData);
        setStatusMsg(
          isOffTopic
            ? '🛡️ GUARDRAIL MUTED · QUERY OFF-TOPIC'
            : `🔥 MASTERED IN ${(mockData.latency_ms?.total || 42.5).toFixed(1)}MS`,
        );
        return;
      }

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
          [data.message || data.error || 'Query failed', data.stage ? `(${data.stage})` : '']
            .filter(Boolean)
            .join(' '),
        );
      }
      setResult(data);
      const total = data.latency_ms?.total;
      setStatusMsg(
        typeof total === 'number'
          ? `🔥 MASTERED IN ${total.toFixed(1)}MS`
          : '🔥 GROUNDED ANSWER READY',
      );
    } catch (err) {
      setResult(null);
      setStatusMsg(`⚠️ ${err.message || 'CONNECTION ERROR TO BACKEND'}`);
    } finally {
      setLoading(false);
    }
  }

  async function transcribeAndQuery(blob) {
    setTranscribing(true);
    setStatusMsg('🎙️ TRANSCRIBING VIA SARVAM STT…');
    try {
      if (USE_MOCKS) {
        const mockQ = 'What was the Manhattan Project?';
        setQuestion(mockQ);
        setTranscribing(false);
        await executeQuery(mockQ, 'voice');
        return;
      }

      const form = new FormData();
      form.append('file', blob, 'audio.webm');
      const sttRes = await fetch(`${API_URL}/api/stt`, {
        method: 'POST',
        headers: apiHeaders(),
        body: form,
      });
      const sttData = await sttRes.json();
      if (!sttRes.ok) {
        throw new Error(sttData.message || sttData.error || 'STT failed');
      }
      const transcript = (sttData.transcript || '').trim();
      if (!transcript) throw new Error('Empty transcript from STT');
      setQuestion(transcript);
      setTranscribing(false);
      await executeQuery(transcript, 'voice');
    } catch (err) {
      setStatusMsg(`⚠️ STT ERROR — ${err.message}`);
      setTranscribing(false);
    }
  }

  async function toggleMic() {
    if (loading || transcribing) return;

    if (isRecording) {
      const { recorder } = mediaRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      mediaRef.current = { recorder, chunks, stream };

      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
        mediaRef.current = { recorder: null, chunks: [], stream: null };
        await transcribeAndQuery(blob);
      };

      recorder.start();
      setIsRecording(true);
      setStatusMsg('🔴 RECORDING — CLICK VINYL AGAIN TO STOP & QUERY');
    } catch (err) {
      setStatusMsg(`⚠️ MIC BLOCKED — ${err.message}`);
    }
  }

  function selectStrategy(id) {
    setStrategy(id);
    const q = question.trim();
    if (q && !loading && !transcribing) {
      // small defer so strategyRef updates via effect before fetch
      strategyRef.current = id;
      executeQuery(q, 'text');
    }
  }

  const totalMs = Number(result?.latency_ms?.total) || 0;
  const retrieveMs = Number(result?.latency_ms?.retrieve) || 0;
  const generateMs = Number(result?.latency_ms?.generate) || 0;
  const isRefusal = result?.guardrail && result.guardrail.allowed === false;
  const busy = loading || transcribing;

  return (
    <div className="beach-stage-wrapper">
      <BeachPartyEnvironment palette={2} isRecording={isRecording} isLoading={busy} />

      <div className="beach-container">
        <header className="beach-topbar">
          <div className="beach-brand-badge">
            <span className="beach-live-pulse-dot" />
            <span>VOICE RAG</span>
            <span
              style={{
                color: '#000',
                fontSize: '11px',
                fontWeight: 900,
                background: '#fff',
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              GOA STAGE
            </span>
          </div>

          <div className="palette-switch-bar">
            <Link href="/palette1" className="palette-switch-btn">
              🌅 PALETTE 1 (SUNSET)
            </Link>
            <span className="palette-switch-btn active">🌴 PALETTE 2 (GOA EMERALD)</span>
          </div>

          <nav className="beach-nav-actions">
            <span className="beach-pill-btn" title={health} style={{ cursor: 'default' }}>
              API {health}
            </span>
            <a href="#dj-rig" className="beach-pill-btn glow-pink">
              VOICE RAG MIXER 🎧
            </a>
          </nav>
        </header>

        <section className="beach-hero-section">
          <div className="beach-hero-badge-row">
            <span>☀️ LIVE BACKEND · QDRANT · 6 CHUNKING STRATEGIES</span>
          </div>

          <div className="beach-hero-title-cluster">
            <h1 className="beach-hero-word">HACKER</h1>
            <span className="beach-goa-badge-pill">गोवा</span>
            <h1 className="beach-hero-word">HOUSE</h1>
          </div>

          <div className="beach-hero-subtag">
            GOA, INDIA · TEAM ATOZ · TEXT + VOICE → /api/query
          </div>

          <div className="beach-scroll-cue">
            <a href="#dj-rig" className="beach-scroll-btn">
              <span>EXPLORE SOUND STAGE</span>
              <span className="scroll-arrow">↓</span>
            </a>
          </div>
        </section>

        <section id="dj-rig" className="beach-dj-rig-container">
          <div className="beach-dj-rig-header">
            <h2>
              <span>🎛️</span>
              <span>VOICE RAG SOUND CONSOLE</span>
            </h2>

            <div className="beach-vu-meter-box">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={`beach-vu-bar ${isRecording || busy ? 'dancing' : ''}`}
                  style={{
                    height: isRecording || busy ? undefined : `${8 + (i % 6) * 3.5}px`,
                    animationDelay: `${(i * 0.04).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="beach-dj-rig-body">
            <div className="beach-turntables-row">
              <div className="beach-turntable-unit">
                <div
                  className={`beach-vinyl-platter ${isRecording ? 'spinning' : ''}`}
                  onClick={toggleMic}
                  title="Click vinyl to record voice → Sarvam STT → query"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleMic();
                  }}
                >
                  <div className="beach-vinyl-center-label">
                    {isRecording ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#000000">
                        <rect x="5" y="5" width="14" height="14" rx="3" />
                      </svg>
                    ) : (
                      <svg
                        width="21"
                        height="21"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#000000"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="8.5" y="2" width="7" height="11" rx="3.5" fill="#000000" />
                        <path d="M4.5 10v1.5a7.5 7.5 0 0 0 15 0V10" />
                        <line x1="12" y1="19" x2="12" y2="22" strokeWidth="3" />
                        <line x1="7.5" y1="22" x2="16.5" y2="22" strokeWidth="3" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="beach-turntable-caption">
                  {isRecording ? '🔴 RECORDING' : 'MIC CHANNEL 1'}
                </span>
              </div>

              <div className="beach-channel-panel">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    executeQuery(question, 'text');
                  }}
                  className="beach-search-row"
                >
                  <input
                    className="beach-query-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask in Marathi / Hindi / English, or use the vinyl mic…"
                    disabled={busy}
                  />
                  <button
                    type="submit"
                    className="beach-drop-beat-btn"
                    disabled={busy || !question.trim()}
                  >
                    {busy ? '...' : 'DROP BEAT ⚡'}
                  </button>
                </form>

                <div className="beach-mixer-controls-row">
                  <div className="beach-channel-tag">
                    <span>{statusMsg}</span>
                  </div>

                  <div className="beach-strategy-faders">
                    {STRATEGIES.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        disabled={busy}
                        onClick={() => selectStrategy(st.id)}
                        className={`beach-fader-btn ${strategy === st.id ? 'active' : ''}`}
                        title={st.id}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="beach-turntable-unit">
                <div
                  className={`beach-vinyl-platter ${busy ? 'spinning' : ''}`}
                  title="Retrieval + generation"
                >
                  <div className="beach-vinyl-center-label">HNSW</div>
                </div>
                <span className="beach-turntable-caption">
                  {busy ? '⚡ SEARCHING' : 'VECTOR CHANNEL 2'}
                </span>
              </div>
            </div>

            {result && (
              <div className="beach-grounded-plate">
                <div className="beach-plate-header">
                  <span>
                    {isRefusal ? '🛡️ GUARDRAIL REFUSAL FILTER' : 'GROUNDED CITATION OUTPUT'}
                  </span>
                  <span>
                    TOTAL LATENCY:{' '}
                    {totalMs ? `${totalMs.toFixed(1)}MS` : '—'}
                  </span>
                </div>

                <div
                  className="beach-plate-text"
                  style={{ color: isRefusal ? 'var(--hhg-pink)' : 'var(--hhg-forest-ink)' }}
                >
                  {result.answer || '(no answer)'}
                </div>

                <div className="beach-plate-chips">
                  {totalMs > 0 && (
                    <span className="beach-plate-chip green">⚡ Total {totalMs.toFixed(1)}ms</span>
                  )}
                  {retrieveMs > 0 && (
                    <span className="beach-plate-chip">
                      Retrieve {retrieveMs.toFixed(1)}ms
                    </span>
                  )}
                  {generateMs > 0 && (
                    <span className="beach-plate-chip">
                      Generate {generateMs.toFixed(1)}ms
                    </span>
                  )}
                  <span className="beach-plate-chip">Strategy: {strategy}</span>
                  <span className="beach-plate-chip">
                    Contexts: {(result.contexts || []).length}
                  </span>
                </div>

                {Array.isArray(result.contexts) && result.contexts.length > 0 && (
                  <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                    {result.contexts.slice(0, 3).map((ctx, i) => (
                      <div
                        key={ctx.id || i}
                        style={{
                          fontSize: 13,
                          lineHeight: 1.45,
                          opacity: 0.9,
                          borderTop: '1px solid rgba(0,0,0,0.12)',
                          paddingTop: 10,
                        }}
                      >
                        <strong>
                          #{i + 1}
                          {typeof ctx.score === 'number' ? ` · ${ctx.score.toFixed(3)}` : ''}
                        </strong>{' '}
                        {(ctx.text || '').slice(0, 220)}
                        {(ctx.text || '').length > 220 ? '…' : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="beach-features-grid-section">
          <div className="beach-section-heading">
            <span className="sub-badge">⚡ REAL-TIME PIPELINE</span>
            <h2>SOUND ARCHITECTURE & LATENCY METRICS</h2>
          </div>

          <div className="beach-cards-row">
            <div className="beach-feature-card card-yellow">
              <div className="card-top-icon">🎙️</div>
              <h3>SARVAM STT</h3>
              <p>
                Vinyl mic → POST /api/stt → transcript fills the query box and runs /api/query with
                source=voice.
              </p>
              <div className="card-badge-pill">LIVE BACKEND</div>
            </div>

            <div className="beach-feature-card card-pink">
              <div className="card-top-icon">⚡</div>
              <h3>QDRANT + 6 STRATEGIES</h3>
              <p>
                fixed_overlap, semantic, metadata_aware, token_window, structure_aware, recursive —
                filtered at retrieve time.
              </p>
              <div className="card-badge-pill">MSMARCO-XI</div>
            </div>

            <div className="beach-feature-card card-emerald">
              <div className="card-top-icon">🎧</div>
              <h3>GROUNDED GENERATION</h3>
              <p>
                Builder 2 harness: retrieve → LLM generate → guardrails, with per-stage latency in
                the response plate.
              </p>
              <div className="card-badge-pill">/api/query</div>
            </div>
          </div>
        </section>
      </div>

      <footer className="beach-afterparty-footer">
        <div className="beach-container">
          <div className="beach-footer-wordmark">
            <span>HACKER </span>
            <span style={{ color: 'var(--hhg-pink)' }}>गोवा </span>
            <span>HOUSE</span>
          </div>
          <div className="beach-footer-sub">GOA, INDIA · TEAM ATOZ · HHG TASK 2</div>

          <div className="beach-footer-tags-row">
            <span className="footer-tag">⚡ {API_URL}</span>
            <span className="footer-tag">🌴 STAGE UI · B3</span>
            <span className="footer-tag">🎙️ SARVAM + QDRANT RAG</span>
            <span className="footer-tag">🎧 6 CHUNKERS</span>
          </div>

          <div className="beach-footer-bottom">
            <span>© 2026 HH GOA — TEAM ATOZ</span>
            <span>WIRED TO LIVE BACKEND</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
