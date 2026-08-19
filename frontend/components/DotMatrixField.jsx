'use client';

import { useEffect, useRef } from 'react';

export default function DotMatrixField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0, h = 0, cols = 0, rows = 0;
    const GAP = 18;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      cols = Math.ceil(w / GAP) + 1;
      rows = Math.ceil(h / GAP) + 1;
    }

    size();
    window.addEventListener('resize', size);

    const state = { energy: 0, target: 0, t: 0 };
    window.__field = state;

    let px = -999, py = -999;
    const handlePointerMove = (e) => { px = e.clientX; py = e.clientY; };
    const handlePointerLeave = () => { px = py = -999; };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);

    const BINS = 12;
    const bins = Array.from({ length: BINS }, () => []);
    let last = 0;
    let animId = null;

    function frame(now) {
      animId = requestAnimationFrame(frame);
      if (now - last < 16) return; // 60fps silky smooth tracking
      last = now;

      state.t += 0.02;
      state.energy += (state.target - state.energy) * 0.06;
      state.target *= 0.985;

      ctx.clearRect(0, 0, w, h);
      const E = state.energy;
      const hot = E > 0.1;
      for (let b = 0; b < BINS; b++) bins[b].length = 0;

      const cursorRadius = 240;
      const cursorRadiusSq = cursorRadius * cursorRadius;

      for (let i = 0; i < cols; i++) {
        const wi = i * 0.22;
        const si = Math.sin(wi + state.t * 2.1);
        const x = i * GAP;
        for (let j = 0; j < rows; j++) {
          const y = j * GAP;
          const wave = si * Math.cos(j * 0.19 - state.t * 1.5)
                     + Math.sin((i + j) * 0.11 + state.t * 1.2);

          const fall = y / h * 1.5 + 0.18;

          const dx = px - x;
          const dy = py - y;
          const d2 = dx * dx + dy * dy;
          const near = d2 < cursorRadiusSq ? Math.pow(1 - Math.sqrt(d2) / cursorRadius, 1.3) : 0;

          // Increased intensity & brightness for cursor following
          const a = (0.05 + wave * 0.05 + E * 0.2) * (fall > 1 ? 1 : fall) + near * 0.88;
          if (a <= 0.02) continue;

          const s = Math.min(3.8, (1.1 + wave * 0.8) * (0.5 + E * 1.4) + near * 3.4);
          if (s <= 0.35) continue;

          const b = Math.min(BINS - 1, (a * BINS / 0.92) | 0);
          bins[b].push(x, y + wave * 9 * E, s);
        }
      }

      for (let b = 0; b < BINS; b++) {
        const arr = bins[b];
        if (!arr.length) continue;
        const a = Math.min(1, ((b + 0.5) / BINS) * 0.92);
        ctx.fillStyle = hot
          ? `rgba(244,${(63 + 80 * (1 - Math.min(1, E))) | 0},${(94 + 80 * (1 - Math.min(1, E))) | 0},${a})`
          : `rgba(255,255,255,${a})`;
        for (let k = 0; k < arr.length; k += 3) {
          const s = arr[k + 2];
          ctx.fillRect(arr[k], arr[k + 1], s, s);
        }
      }
    }

    animId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <>
      <canvas id="field" ref={canvasRef} aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
    </>
  );
}
