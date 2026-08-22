'use client';

import { useEffect, useRef, useState } from 'react';
import successMock from '../mocks/query.success.json';
import refusedMock from '../mocks/query.refused.json';
import BeachPartyEnvironment from '../components/BeachPartyEnvironment';
import WanderStamp from '../components/WanderStamp';
import VoiceReactiveGrid from '../components/VoiceReactiveGrid';
import LatencyMixer from '../components/LatencyMixer';
import RefusalBanner from '../components/RefusalBanner';
import ActionSearchBar from '../components/ActionSearchBar';

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

const ANSWER_LANGS = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'mr', label: 'मराठी' },
];

const CONTEXT_PREVIEW_LEN = 240;

function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (DEMO_PASSWORD) headers['x-demo-password'] = DEMO_PASSWORD;
  return headers;
}

function getAnswerForLang(result, lang) {
  if (!result) return '';
  if (lang === 'hi') return result.answer_hi || result.answer || '';
  if (lang === 'mr') return result.answer_mr || result.answer || '';
  return result.answer || '';
}

function isLangAvailable(result, lang) {
  if (!result) return false;
  if (lang === 'en') return Boolean(result.answer);
  if (lang === 'hi') return Boolean(result.answer_hi);
  if (lang === 'mr') return Boolean(result.answer_mr);
  return false;
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
    'Ask a question in Marathi, Hindi, or English',
  );
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [answerLang, setAnswerLang] = useState('en');
  const [expandedCtx, setExpandedCtx] = useState(() => new Set());
  const [voiceTranscript, setVoiceTranscript] = useState(null);
  const [showStickyAsk, setShowStickyAsk] = useState(false);

  const strategyRef = useRef(strategy);
  const searchAnchorRef = useRef(null);
  const mediaRef = useRef({
    recorder: null,
    chunks: [],
    stream: null,
    audioCtx: null,
    analyser: null,
    rafId: null,
  });

  function stopVoiceMeter() {
    const { rafId, audioCtx } = mediaRef.current;
    if (rafId) cancelAnimationFrame(rafId);
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
    mediaRef.current.rafId = null;
    mediaRef.current.audioCtx = null;
    mediaRef.current.analyser = null;
    setVoiceLevel(0);
  }

  function startVoiceMeter(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      mediaRef.current.audioCtx = audioCtx;
      mediaRef.current.analyser = analyser;

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const level = Math.min(1, rms * 4.2);
        setVoiceLevel(level);
        mediaRef.current.rafId = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setVoiceLevel(0.2);
    }
  }

  useEffect(() => {
    strategyRef.current = strategy;
  }, [strategy]);

  useEffect(() => {
    return () => stopVoiceMeter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (USE_MOCKS) {
      setHealth('mocks mode');
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    fetch(`${API_URL}/api/health`, {
      headers: apiHeaders(),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const q = data.services?.qdrant?.ok ? 'qdrant ok' : 'qdrant down';
        const llm = data.services?.llm || '?';
        const stt = data.services?.stt || '?';
        setHealth(`${data.status || 'ok'} · ${q} · llm ${llm} · stt ${stt}`);
      })
      .catch(() => setHealth('backend unreachable'))
      .finally(() => clearTimeout(timeoutId));

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!result) return;
    setAnswerLang('en');
    setExpandedCtx(new Set());
  }, [result]);

  useEffect(() => {
    const el = searchAnchorRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyAsk(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleQuestionChange(next) {
    setQuestion(next);
    if (!next.trim()) setVoiceTranscript(null);
  }

  async function executeQuery(qText, source = 'text') {
    const q = (qText || question).trim();
    if (!q || loading || transcribing) return;

    if (source === 'text') setVoiceTranscript(null);

    setLoading(true);
    setResult(null);
    setStatusMsg('Retrieving contexts and generating…');

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
            ? 'Guardrail muted — query off-topic'
            : `Answered in ${(mockData.latency_ms?.total || 42.5).toFixed(1)} ms`,
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
          ? `Answered in ${total.toFixed(1)} ms`
          : 'Grounded answer ready',
      );
    } catch (err) {
      setResult(null);
      setStatusMsg(err.message || 'Backend connection error');
    } finally {
      setLoading(false);
    }
  }

  async function transcribeAndQuery(blob) {
    setTranscribing(true);
    setStatusMsg('Transcribing with Sarvam STT…');
    try {
      if (USE_MOCKS) {
        const mockQ = 'What was the Manhattan Project?';
        setQuestion(mockQ);
        setVoiceTranscript(mockQ);
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
      setVoiceTranscript(transcript);
      setTranscribing(false);
      await executeQuery(transcript, 'voice');
    } catch (err) {
      setStatusMsg(`STT error — ${err.message}`);
      setTranscribing(false);
    }
  }

  async function toggleMic() {
    if (loading || transcribing) return;

    if (isRecording) {
      const { recorder } = mediaRef.current;
      stopVoiceMeter();
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      mediaRef.current = {
        ...mediaRef.current,
        recorder,
        chunks,
        stream,
      };

      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stopVoiceMeter();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
        mediaRef.current = {
          recorder: null,
          chunks: [],
          stream: null,
          audioCtx: null,
          analyser: null,
          rafId: null,
        };
        await transcribeAndQuery(blob);
      };

      recorder.start();
      startVoiceMeter(stream);
      setIsRecording(true);
      setStatusMsg('Listening — tap the voice grid again to stop and ask');
    } catch (err) {
      stopVoiceMeter();
      setStatusMsg(`Mic blocked — ${err.message}`);
    }
  }

  function selectStrategy(id) {
    setStrategy(id);
    const q = question.trim();
    if (q && !loading && !transcribing) {
      strategyRef.current = id;
      executeQuery(q, 'text');
    }
  }

  function toggleCtxExpand(index) {
    setExpandedCtx((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function copySnippet(text, successMsg = 'Evidence snippet copied') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatusMsg(successMsg);
    } catch {
      setStatusMsg('Copy failed — select text manually');
    }
  }

  async function copyAnswer(text) {
    await copySnippet(text, 'Answer copied');
  }

  const totalMs = Number(result?.latency_ms?.total) || 0;
  const isRefusal = result?.guardrail && result.guardrail.allowed === false;
  const hasQueryInput = Boolean(question.trim());
  const isStatusError =
    statusMsg.startsWith('STT error') ||
    statusMsg.startsWith('Mic blocked') ||
    statusMsg.startsWith('Copy failed') ||
    statusMsg === 'Backend connection error';

  const busy = loading || transcribing;
  const healthOk = health.includes('ok') && !health.includes('unreachable') && !health.includes('down');
  const visibleLangs = result
    ? ANSWER_LANGS.filter((lang) => isLangAvailable(result, lang.id))
    : [];
  const activeAnswerLang = visibleLangs.some((l) => l.id === answerLang)
    ? answerLang
    : visibleLangs[0]?.id || 'en';
  const displayAnswer = result ? getAnswerForLang(result, activeAnswerLang) : '';

  return (
    <div className={`beach-stage-wrapper ${showStickyAsk ? 'has-mobile-sticky' : ''}`}>
      <BeachPartyEnvironment isRecording={isRecording} isLoading={busy} />

      <div className="beach-container">
        <header className="beach-topbar">
          <a
            className="goa-stamp"
            href="https://hhgoa.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Hacker House Goa"
          >
            <img src="/brand/goa_hindi.svg" alt="गोवा" width={72} height={72} />
          </a>

          <div className={`beach-health-chip ${healthOk ? 'is-ok' : 'is-warn'}`} title={health}>
            <span className="beach-live-pulse-dot" />
            <span>{health}</span>
          </div>
        </header>

        <section className="beach-hero-section">
          <div className="beach-hero-title-cluster">
            <h1 className="beach-hero-display">
              <span className="beach-hero-line beach-hero-line-main">HACKER HOUSE</span>
              <span className="beach-hero-line beach-hero-line-goa">GOA</span>
            </h1>
            <WanderStamp />
          </div>

          <p className="beach-hero-subtag">
            Voice-enabled RAG · Team AtoZ · ask in Marathi, Hindi, or English
          </p>
        </section>

        <section id="dj-rig" className="beach-dj-rig-container">
          <div className="beach-dj-rig-header">
            <h2>DJ SET · SOUND CONSOLE</h2>

            <div className="beach-vu-meter-box" aria-hidden="true">
              {[...Array(16)].map((_, i) => (
                <div
                  key={i}
                  className={`beach-vu-bar ${isRecording || busy ? 'dancing' : ''}`}
                  style={{
                    height: isRecording || busy ? undefined : `${8 + (i % 6) * 3.5}px`,
                    animationDelay: `${(i * 0.05).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="beach-dj-rig-body">
            <div className="beach-turntables-row">
              <div className="beach-channel-panel">
                <div ref={searchAnchorRef}>
                  <ActionSearchBar
                    value={question}
                    onChange={handleQuestionChange}
                    onSubmit={(q) => executeQuery(q, 'text')}
                    disabled={busy}
                    inlineControl={
                      <VoiceReactiveGrid
                        level={voiceLevel}
                        active={isRecording}
                        processing={busy && !isRecording}
                        disabled={busy && !isRecording}
                        onClick={toggleMic}
                      />
                    }
                  />
                </div>

                {voiceTranscript && !transcribing && (
                  <div className="beach-transcript-bubble" role="status">
                    <span className="beach-transcript-label">Heard</span>
                    <q className="beach-transcript-text">{voiceTranscript}</q>
                  </div>
                )}

                <div className={`beach-mixer-controls-row ${isStatusError ? 'has-status-error' : ''}`}>
                  <div className={`beach-channel-tag ${isStatusError ? 'is-error' : ''}`}>
                    <span>{statusMsg}</span>
                  </div>

                  {hasQueryInput && (
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
                  )}
                </div>
              </div>

              <div className="beach-turntable-row-compact">
                <div className="beach-turntable-unit beach-turntable-voice">
                  <VoiceReactiveGrid
                    level={voiceLevel}
                    active={isRecording}
                    processing={busy && !isRecording}
                    disabled={busy && !isRecording}
                    onClick={toggleMic}
                  />
                  <span className="beach-turntable-caption">
                    {isRecording ? 'LISTENING' : busy ? 'GENERATING' : 'VOICE'}
                  </span>
                </div>

                <div className="beach-turntable-unit beach-turntable-rag">
                  <div
                    className={`beach-vinyl-platter ${busy ? 'spinning' : ''}`}
                    title="Retrieval engine"
                  >
                    <div className="beach-vinyl-center-label">RAG</div>
                  </div>
                  <span className="beach-turntable-caption">
                    {busy ? 'SEARCHING' : 'RETRIEVE'}
                  </span>
                </div>
              </div>
            </div>

            {result && (
              <>
                {isRefusal && <RefusalBanner guardrail={result.guardrail} />}

                <div className={`beach-grounded-plate ${isRefusal ? 'is-refusal' : ''}`}>
                  <div className="beach-plate-header">
                    <span>{isRefusal ? 'Guardrail refusal' : 'Grounded answer'}</span>
                    <div className="beach-plate-header-actions">
                      {!isRefusal && displayAnswer && (
                        <button
                          type="button"
                          className="beach-plate-copy-btn"
                          onClick={() => copyAnswer(displayAnswer)}
                        >
                          Copy answer
                        </button>
                      )}
                      <span className="beach-plate-timing">
                        {totalMs ? `${totalMs.toFixed(1)} ms` : '—'}
                      </span>
                    </div>
                  </div>

                  {!isRefusal && visibleLangs.length > 1 && (
                    <div className="beach-lang-tabs" role="tablist" aria-label="Answer language">
                      {visibleLangs.map((lang) => (
                        <button
                          key={lang.id}
                          type="button"
                          role="tab"
                          aria-selected={activeAnswerLang === lang.id}
                          className={`beach-lang-tab ${activeAnswerLang === lang.id ? 'active' : ''}`}
                          onClick={() => setAnswerLang(lang.id)}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="beach-plate-text">
                    {displayAnswer || '(no answer)'}
                  </div>

                  <div className="beach-plate-chips">
                    <span className="beach-plate-chip">{strategy}</span>
                    <span className="beach-plate-chip">
                      {(result.contexts || []).length} contexts
                    </span>
                  </div>

                  <LatencyMixer latencyMs={result.latency_ms} />

                  {Array.isArray(result.contexts) && result.contexts.length > 0 && (
                    <div className="beach-context-list">
                      <div className="beach-context-list-head">Evidence postcards</div>
                      {result.contexts.slice(0, 3).map((ctx, i) => {
                        const text = ctx.text || '';
                        const isExpanded = expandedCtx.has(i);
                        const needsExpand = text.length > CONTEXT_PREVIEW_LEN;
                        const displayText =
                          isExpanded || !needsExpand
                            ? text
                            : `${text.slice(0, CONTEXT_PREVIEW_LEN)}…`;

                        return (
                          <div
                            key={ctx.id || i}
                            className={`beach-context-item ${isExpanded ? 'is-expanded' : ''}`}
                          >
                            <div className="beach-context-item-head">
                              <strong className="beach-context-item-meta">
                                #{i + 1}
                                {typeof ctx.score === 'number' ? ` · ${ctx.score.toFixed(3)}` : ''}
                                {ctx.id ? ` · ${ctx.id}` : ''}
                                {ctx.strategy ? ` · ${ctx.strategy}` : ''}
                              </strong>
                              <div className="beach-context-item-actions">
                                {needsExpand && (
                                  <button
                                    type="button"
                                    className="beach-context-action-btn"
                                    onClick={() => toggleCtxExpand(i)}
                                  >
                                    {isExpanded ? 'Collapse' : 'Expand'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="beach-context-action-btn"
                                  onClick={() => copySnippet(text)}
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                            <p>{displayText}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <footer className="beach-site-footer">
        <div className="beach-site-footer-inner">
          <p>
            Team AtoZ · HHG Task 2 · Voice RAG ·{' '}
            <span className="beach-footer-tag">#RAGInGoa</span>
          </p>
          <a
            href="https://github.com/anishka1511/hhg-task2-TeamAtoZ"
            target="_blank"
            rel="noopener noreferrer"
            className="beach-footer-github"
            aria-label="View repository on GitHub"
            title="GitHub repository"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.484 17.522 2 12 2Z"
              />
            </svg>
          </a>
        </div>
      </footer>

      <div
        className={`beach-mobile-sticky ${showStickyAsk ? 'is-visible' : ''}`}
        aria-hidden={!showStickyAsk}
      >
        <input
          className="beach-query-input beach-mobile-sticky-input"
          value={question}
          onChange={(e) => handleQuestionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              executeQuery(question, 'text');
            }
          }}
          placeholder="Ask a question…"
          disabled={busy}
          aria-label="Ask a question"
        />
        <button
          type="button"
          className="beach-drop-beat-btn beach-mobile-sticky-ask"
          disabled={busy || !question.trim()}
          onClick={() => executeQuery(question, 'text')}
        >
          {busy ? '…' : 'ASK'}
        </button>
      </div>
    </div>
  );
}
