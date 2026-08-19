'use client';

export default function LatencyHUD({ latencyMs }) {
  if (!latencyMs) return null;

  const total = latencyMs.total ?? 0;
  const isUnderTarget = total > 0 && total <= 200;

  const stages = [
    { key: 'stt', label: 'STT (Sarvam)', value: latencyMs.stt ?? 0, desc: 'Audio transcription' },
    { key: 'retrieve', label: 'Vector Retrieval', value: latencyMs.retrieve ?? 0, desc: 'Qdrant search' },
    { key: 'generate', label: 'LLM Generation', value: latencyMs.generate ?? 0, desc: 'Grounded response' },
    { key: 'guardrail', label: 'Guardrails', value: latencyMs.guardrail ?? 0, desc: 'Safety & grounding filter' },
  ];

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ⚡ Pipeline Latency Breakdown
          </span>
          <span className={`badge ${isUnderTarget ? 'badge-success' : 'badge-warning'}`}>
            {isUnderTarget ? '✅ Sub-200ms Target Met' : '⚠️ > 200ms'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Pipeline:</span>
          <span style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '1.4rem', 
            fontWeight: 800, 
            color: isUnderTarget ? 'var(--accent-emerald)' : 'var(--accent-amber)' 
          }}>
            {total} ms
          </span>
        </div>
      </div>

      {/* Latency Progress Bar */}
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden', display: 'flex', marginBottom: '1rem' }}>
        {stages.map((stage, idx) => {
          const pct = total > 0 ? ((stage.value / total) * 100).toFixed(1) : 25;
          const colors = ['#f43f5e', '#38bdf8', '#818cf8', '#10b981'];
          return (
            <div
              key={stage.key}
              title={`${stage.label}: ${stage.value}ms (${pct}%)`}
              style={{
                width: `${pct}%`,
                background: colors[idx % colors.length],
                transition: 'width 0.4s ease'
              }}
            />
          );
        })}
      </div>

      {/* Individual Stage Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
        {stages.map((stage) => (
          <div key={stage.key} className="latency-chip">
            <span className="latency-label">{stage.label}</span>
            <span className="latency-value">{stage.value} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>ms</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
