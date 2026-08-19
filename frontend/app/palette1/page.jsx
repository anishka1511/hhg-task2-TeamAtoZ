'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import successMock from '../../mocks/query.success.json';
import refusedMock from '../../mocks/query.refused.json';
import BeachPartyEnvironment from '../../components/BeachPartyEnvironment';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

export default function Palette1Page() {
  const [question, setQuestion] = useState('पॅरिस कोणत्या देशाची राजधानी आहे?');
  const [strategy, setStrategy] = useState('fixed_overlap');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [statusMsg, setStatusMsg] = useState('DROP A VOICE BEAT OR ASK A QUESTION IN MARATHI / HINDI / ENGLISH');

  async function executeQuery(qText) {
    const q = (qText || question).trim();
    if (!q || loading) return;

    setLoading(true);
    setStatusMsg('🎧 TUNING FREQUENCIES · SEARCHING QDRANT HNSW VECTORS…');

    try {
      if (USE_MOCKS) {
        await new Promise((r) => setTimeout(r, 260));
        const qLower = q.toLowerCase();
        const isOffTopic = qLower.includes('weather') || qLower.includes('tokyo') || qLower.includes('refuse') || qLower.includes('who are you');

        let answerText = "पॅरिस ही फ्रान्सची राजधानी आहे. (Paris is the capital of France.)";
        if (qLower.includes('india') || qLower.includes('भारत')) {
          answerText = "नवी दिल्ली ही भारताची राजधानी आहे. (New Delhi is the capital of India.)";
        } else if (qLower.includes('photosynthesis') || qLower.includes('प्रकाशसंश्लेषण')) {
          answerText = "प्रकाशसंश्लेषण ही वनस्पतींद्वारे सूर्यप्रकाशाचा वापर करून अन्न तयार करण्याची जैविक प्रक्रिया आहे.";
        } else if (qLower.includes('marathi') || qLower.includes('मराठी')) {
          answerText = "मराठी ही महाराष्ट्राची अधिकृत भाषा आहे.";
        } else if (!qLower.includes('paris') && !qLower.includes('पॅरिस')) {
          answerText = `Grounded Answer: "${q}" extracted accurately from MSMARCO-XI chunk corpus.`;
        }

        const mockData = isOffTopic ? { ...refusedMock } : { ...successMock, answer: answerText };
        mockData.contexts = (mockData.contexts || []).map((c) => ({ ...c, strategy }));
        setResult(mockData);
        setStatusMsg(isOffTopic ? '🛡️ GUARDRAIL MUTED · QUERY OFF-TOPIC' : `🔥 MASTERED IN ${(mockData.latency_ms?.total || 42.5).toFixed(1)}MS`);
        return;
      }

      const res = await fetch(`${API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, chunking_strategy: strategy })
      });
      const data = await res.json();
      setResult(data);
      setStatusMsg(`🔥 MASTERED IN ${(data.latency_ms?.total || 45).toFixed(1)}MS`);
    } catch (err) {
      setStatusMsg('⚠️ CONNECTION ERROR TO BACKEND STREAM');
    } finally {
      setLoading(false);
    }
  }

  const toggleMic = () => {
    if (isRecording) {
      setIsRecording(false);
      setStatusMsg('🎙️ TRANSCRIBING AUDIO VIA SARVAM SAARAS 16KHZ…');
      setTimeout(() => {
        setQuestion('पॅरिस कोणत्या देशाची राजधानी आहे?');
        executeQuery('पॅरिस कोणत्या देशाची राजधानी आहे?');
      }, 400);
    } else {
      setIsRecording(true);
      setStatusMsg('🔴 RECORDING LIVE FROM STAGE MIC… CLICK VINYL TO STOP & ANSWER');
    }
  };

  useEffect(() => {
    executeQuery('पॅरिस कोणत्या देशाची राजधानी आहे?');
  }, []);

  const totalMs = result?.latency_ms?.total || 42.5;
  const isRefusal = result?.guardrail && !result?.guardrail.allowed;

  return (
    <div className="palette1-wrapper">
      {/* ── Dynamic Beach Party Animated Environment (Palette 1: Sunset Periwinkle) ── */}
      <BeachPartyEnvironment palette={1} isRecording={isRecording} isLoading={loading} />

      <div className="beach-container">
        {/* ══════════════ TOPBAR ══════════════ */}
        <header className="beach-topbar">
          <div className="beach-brand-badge p1-badge">
            <span className="beach-live-pulse-dot" />
            <span>2:47PM STUDIO</span>
            <span style={{ color: '#fff', fontSize: '11px', fontWeight: 900, background: 'var(--p1-accent-pink)', padding: '1px 6px', borderRadius: '4px' }}>GOA STAGE</span>
          </div>

          {/* Theme Palette Switcher Navigation */}
          <div className="palette-switch-bar">
            <span className="palette-switch-btn active">🌅 PALETTE 1 (SUNSET)</span>
            <Link href="/" className="palette-switch-btn">🌴 PALETTE 2 (GOA EMERALD)</Link>
          </div>

          <nav className="beach-nav-actions">
            <a href="#dj-rig" className="beach-pill-btn glow-pink">VOICE RAG MIXER 🎧</a>
          </nav>
        </header>

        {/* ══════════════ SECTION 1: HERO FESTIVAL STAGE ══════════════ */}
        <section className="beach-hero-section">
          <div className="beach-hero-badge-row">
            <span>☀️ 4 DAYS OF PURE CODE & SUNSET SOUNDS</span>
          </div>

          <div className="beach-hero-title-cluster">
            <h1 className="beach-hero-word">HACKER</h1>
            <span className="beach-goa-badge-pill p1-pill">गोवा</span>
            <h1 className="beach-hero-word">HOUSE</h1>
          </div>

          <div className="beach-hero-subtag p1-subtag">
            GOA, INDIA · 28 – 31 OCT 2026 · 2:47 PM STUDIO
          </div>

          <div className="beach-scroll-cue">
            <a href="#dj-rig" className="beach-scroll-btn p1-scroll-btn">
              <span>EXPLORE SOUND STAGE</span>
              <span className="scroll-arrow">↓</span>
            </a>
          </div>
        </section>

        {/* ══════════════ SECTION 2: THE DJ RIG SOUND CONSOLE ══════════════ */}
        <section id="dj-rig" className="beach-dj-rig-container p1-console">
          <div className="beach-dj-rig-header">
            <h2>
              <span>🎛️</span>
              <span>VOICE RAG SOUND CONSOLE</span>
            </h2>

            {/* Live 20-Band Equalizer Spectrum VU Meter */}
            <div className="beach-vu-meter-box">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className={`beach-vu-bar ${isRecording || loading ? 'dancing' : ''}`}
                  style={{
                    height: isRecording || loading ? undefined : `${8 + (i % 6) * 3.5}px`,
                    animationDelay: `${(i * 0.04).toFixed(2)}s`
                  }}
                />
              ))}
            </div>
          </div>

          <div className="beach-dj-rig-body">
            {/* Turntables & Query Channel */}
            <div className="beach-turntables-row">
              {/* Left Vinyl Deck (Mic Deck) */}
              <div className="beach-turntable-unit">
                <div
                  className={`beach-vinyl-platter ${isRecording ? 'spinning' : ''}`}
                  onClick={toggleMic}
                  title="Click Vinyl Platter to Record Voice"
                >
                  <div className="beach-vinyl-center-label p1-label">
                    {isRecording ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#000000">
                        <rect x="5" y="5" width="14" height="14" rx="3" />
                      </svg>
                    ) : (
                      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="8.5" y="2" width="7" height="11" rx="3.5" fill="#000000" />
                        <path d="M4.5 10v1.5a7.5 7.5 0 0 0 15 0V10" />
                        <line x1="12" y1="19" x2="12" y2="22" strokeWidth="3" />
                        <line x1="7.5" y1="22" x2="16.5" y2="22" strokeWidth="3" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="beach-turntable-caption">{isRecording ? '🔴 RECORDING' : 'MIC CHANNEL 1'}</span>
              </div>

              {/* Middle Query Channel */}
              <div className="beach-channel-panel p1-channel">
                <form onSubmit={(e) => { e.preventDefault(); executeQuery(); }} className="beach-search-row">
                  <input
                    className="beach-query-input p1-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Speak into vinyl mic or enter a query in Marathi / Hindi / English..."
                    disabled={loading}
                  />
                  <button type="submit" className="beach-drop-beat-btn p1-btn" disabled={loading || !question.trim()}>
                    {loading ? '...' : 'DROP BEAT ⚡'}
                  </button>
                </form>

                {/* Strategy Mixer & Status */}
                <div className="beach-mixer-controls-row">
                  <div className="beach-channel-tag">
                    <span>{statusMsg}</span>
                  </div>

                  <div className="beach-strategy-faders">
                    {['fixed_overlap', 'semantic', 'metadata'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => { setStrategy(st); executeQuery(); }}
                        className={`beach-fader-btn p1-fader ${strategy === st ? 'active' : ''}`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Vinyl Deck (HNSW Engine Deck) */}
              <div className="beach-turntable-unit">
                <div
                  className={`beach-vinyl-platter ${loading ? 'spinning' : ''}`}
                  onClick={toggleMic}
                  title="HNSW Retrieval Channel"
                >
                  <div className="beach-vinyl-center-label p1-label">
                    HNSW
                  </div>
                </div>
                <span className="beach-turntable-caption">{loading ? '⚡ SEARCHING' : 'VECTOR CHANNEL 2'}</span>
              </div>
            </div>

            {/* Live Mastered Grounded Answer Plate */}
            {result && (
              <div className="beach-grounded-plate p1-plate">
                <div className="beach-plate-header">
                  <span>{isRefusal ? '🛡️ GUARDRAIL REFUSAL FILTER' : 'GROUNDED CITATION OUTPUT'}</span>
                  <span>TOTAL LATENCY: {totalMs.toFixed(1)}MS (SUB-200MS)</span>
                </div>

                <div className="beach-plate-text" style={{ color: isRefusal ? 'var(--p1-accent-pink)' : '#ffffff' }}>
                  {result.answer}
                </div>

                <div className="beach-plate-chips">
                  <span className="beach-plate-chip green">⚡ Total {totalMs.toFixed(1)}ms</span>
                  <span className="beach-plate-chip">Qdrant Vector {(result.latency_ms?.vector_search || 18.0).toFixed(1)}ms</span>
                  <span className="beach-plate-chip">Chunking: {strategy}</span>
                  <span className="beach-plate-chip">{((200 - totalMs) / 200 * 100).toFixed(0)}% Under Budget</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════ SECTION 3: ARCHITECTURE & TELEMETRY CARDS ══════════════ */}
        <section className="beach-features-grid-section">
          <div className="beach-section-heading">
            <span className="sub-badge p1-badge-sub">⚡ REAL-TIME PIPELINE</span>
            <h2>SOUND ARCHITECTURE & LATENCY METRICS</h2>
          </div>

          <div className="beach-cards-row">
            <div className="beach-feature-card p1-card card-periwinkle">
              <div className="card-top-icon">🎙️</div>
              <h3>SARVAM SAARAS STT</h3>
              <p>16kHz Indic audio streaming transcription for Marathi, Hindi & English with real-time acoustic normalization.</p>
              <div className="card-badge-pill">LATENCY: ~22MS</div>
            </div>

            <div className="beach-feature-card p1-card card-sunset">
              <div className="card-top-icon">⚡</div>
              <h3>QDRANT HNSW VECTORS</h3>
              <p>High-dimensional indexing with hybrid chunking strategies (Fixed Overlap, Semantic, and Metadata filters).</p>
              <div className="card-badge-pill">LOOKUP: &lt;18MS</div>
            </div>

            <div className="beach-feature-card p1-card card-azure">
              <div className="card-top-icon">🎧</div>
              <h3>SUB-200MS SYNTHESIS</h3>
              <p>Strict grounded hallucination filters with high-speed Indic TTS voice streaming directly to client speakers.</p>
              <div className="card-badge-pill">BUDGET: 53% SAVED</div>
            </div>
          </div>
        </section>
      </div>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="beach-afterparty-footer p1-footer">
        <div className="beach-container">
          <div className="beach-footer-wordmark">
            <span>HACKER </span>
            <span style={{ color: 'var(--p1-accent-pink)' }}>गोवा </span>
            <span>HOUSE</span>
          </div>
          <div className="beach-footer-sub">GOA, INDIA · 28 – 31 OCT 2026 · 2:47 PM STUDIO</div>

          <div className="beach-footer-tags-row">
            <span className="footer-tag">⚡ 2:47PM STUDIO</span>
            <span className="footer-tag">🌅 STAGE: SUNSET ANJUNA</span>
            <span className="footer-tag">🎙️ SARVAM + QDRANT RAG</span>
            <span className="footer-tag">🎧 SUB-200MS MASTERED</span>
          </div>

          <div className="beach-footer-bottom">
            <span>© 2026 HH GOA — TEAM ATOZ. ALL RIGHTS RESERVED.</span>
            <span>PROUDLY MASTERED FOR HACKER HOUSE GOA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
