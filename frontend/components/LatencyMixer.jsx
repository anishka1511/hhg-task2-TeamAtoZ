'use client';

export default function LatencyMixer({ latencyMs }) {
  if (!latencyMs) return null;

  const total = Number(latencyMs.total) || 0;
  const isUnderTarget = total > 0 && total <= 200;

  const stages = [
    { key: 'stt', label: 'STT', value: Number(latencyMs.stt) || 0, color: '#ff087f' },
    { key: 'retrieve', label: 'Retrieve', value: Number(latencyMs.retrieve) || 0, color: '#10b981' },
    { key: 'generate', label: 'Generate', value: Number(latencyMs.generate) || 0, color: '#ffe000' },
    { key: 'guardrail', label: 'Guardrail', value: Number(latencyMs.guardrail) || 0, color: '#6366f1' },
  ];

  return (
    <div className="beach-latency-mixer">
      <div className="beach-latency-mixer-head">
        <span className="beach-latency-mixer-title">Pipeline latency</span>
        <span className={`beach-latency-target-badge ${isUnderTarget ? 'is-fast' : 'is-slow'}`}>
          {isUnderTarget ? 'Sub-200ms' : '> 200ms'}
        </span>
        {total > 0 && (
          <span className="beach-latency-total">{total.toFixed(1)} ms total</span>
        )}
      </div>

      {total > 0 && (
        <div className="beach-latency-bar" aria-hidden="true">
          {stages.map((stage) => {
            const pct = total > 0 ? (stage.value / total) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={stage.key}
                className="beach-latency-bar-segment"
                style={{ width: `${pct}%`, background: stage.color }}
                title={`${stage.label}: ${stage.value.toFixed(1)} ms`}
              />
            );
          })}
        </div>
      )}

      <div className="beach-latency-channels">
        {stages.map((stage) => (
          <div key={stage.key} className="beach-latency-channel">
            <span className="beach-latency-channel-label">{stage.label}</span>
            <span className="beach-latency-channel-value">
              {stage.value.toFixed(1)}
              <span className="beach-latency-channel-unit">ms</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
