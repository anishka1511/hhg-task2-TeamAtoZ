'use client';

/** Polished white voice orb — soft green / yellow / pink bloom, no text. */
export default function VoiceReactiveGrid({
  level = 0,
  active = false,
  processing = false,
  onClick,
  disabled = false,
}) {
  const speak = active ? Math.max(level, 0.05) : 0;
  const scale = active
    ? 1 + Math.min(0.16, speak * 0.22)
    : processing
      ? 1.03
      : 1;

  // Blend accents: quiet = emerald, louder = yellow → pink
  const bloom =
    active
      ? `radial-gradient(circle at 35% 30%,
          rgba(255,255,255,0.95) 0%,
          rgba(255,224,0,${0.35 + speak * 0.45}) 32%,
          rgba(255,8,127,${0.18 + speak * 0.4}) 58%,
          rgba(13,83,56,${0.2 + speak * 0.15}) 78%,
          rgba(13,83,56,0.08) 100%)`
      : processing
        ? `radial-gradient(circle at 35% 30%,
            rgba(255,255,255,0.95) 0%,
            rgba(255,8,127,0.35) 40%,
            rgba(255,224,0,0.2) 70%,
            rgba(13,83,56,0.12) 100%)`
        : `radial-gradient(circle at 35% 30%,
            #ffffff 0%,
            #f8faf6 45%,
            rgba(13,83,56,0.08) 100%)`;

  const halo =
    active
      ? `radial-gradient(circle,
          rgba(255,224,0,${0.45 + speak * 0.35}) 0%,
          rgba(255,8,127,${0.28 + speak * 0.25}) 40%,
          rgba(13,83,56,0.15) 65%,
          transparent 75%)`
      : processing
        ? 'radial-gradient(circle, rgba(255,8,127,0.4) 0%, rgba(255,224,0,0.2) 45%, transparent 70%)'
        : 'radial-gradient(circle, rgba(13,83,56,0.22) 0%, rgba(255,224,0,0.12) 50%, transparent 72%)';

  return (
    <button
      type="button"
      className={`voice-orb ${active ? 'is-live' : ''} ${processing ? 'is-processing' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={
        active
          ? 'Listening. Click to stop and ask.'
          : 'Click to start voice recording'
      }
      title={active ? 'Tap to stop' : 'Tap to speak'}
      style={{ ['--orb-scale']: String(scale) }}
    >
      <span className="voice-orb-halo" style={{ background: halo, opacity: active ? 0.9 : 0.7 }} />

      <span
        className="voice-orb-disc"
        style={{
          background: bloom,
          transform: `scale(${scale})`,
        }}
      >
        <span className="voice-orb-sheen" aria-hidden="true" />
        <span className="voice-orb-ring voice-orb-ring-a" aria-hidden="true" />
        <span className="voice-orb-ring voice-orb-ring-b" aria-hidden="true" />
        <span className="voice-orb-core" aria-hidden="true" />
      </span>

      {active && <span className="voice-orb-ping" aria-hidden="true" />}
    </button>
  );
}
