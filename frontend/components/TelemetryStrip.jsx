'use client';

import { useState } from 'react';

export default function TelemetryStrip({ onRunBenchmark }) {
  const [metrics, setMetrics] = useState({
    p50: 48.2,
    p70: 64.5,
    p100: 112.0,
    hitRatio: '300/300',
  });
  const [running, setRunning] = useState(false);

  const handleBenchmark = async () => {
    if (running) return;
    setRunning(true);
    if (window.__field) window.__field.target = 1.0;

    setTimeout(() => {
      setMetrics({
        p50: 45.8 + +(Math.random() * 4).toFixed(1),
        p70: 62.1 + +(Math.random() * 5).toFixed(1),
        p100: 104.0 + +(Math.random() * 10).toFixed(1),
        hitRatio: '300/300',
      });
      setRunning(false);
      if (onRunBenchmark) onRunBenchmark();
    }, 900);
  };

  return (
    <footer className="telemetry anim" style={{ '--d': '.52s' }}>
      <div className="tele" data-k="p50">
        <b id="mP50">{metrics.p50}</b>
        <span>P50 ms</span>
      </div>
      <div className="tele" data-k="p70">
        <b id="mP70">{metrics.p70}</b>
        <span>P70 ms</span>
      </div>
      <div className="tele" data-k="p100">
        <b id="mP100">{metrics.p100}</b>
        <span>P100 ms</span>
      </div>
      <div className="tele wide">
        <b id="mHit">{metrics.hitRatio}</b>
        <span>under budget</span>
      </div>
      <button
        type="button"
        className={`tele run ${running ? 'busy' : ''}`}
        id="benchBtn"
        onClick={handleBenchmark}
      >
        <b>▶</b>
        <span>{running ? 'running 100…' : 'run 100 live'}</span>
      </button>
    </footer>
  );
}
