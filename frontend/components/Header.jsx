'use client';

export default function Header({ health, isMock, chunkCount = '241,572' }) {
  const getStatusChip = () => {
    if (isMock) {
      return (
        <span className="stat-chip mock" id="chipIndex">
          <i className="dot"></i>
          <span>{chunkCount} chunks · mock mode</span>
        </span>
      );
    }
    if (health === 'ok' || health === 'ready') {
      return (
        <span className="stat-chip ready" id="chipIndex">
          <i className="dot"></i>
          <span>{chunkCount} chunks · live api</span>
        </span>
      );
    }
    if (health === 'checking…') {
      return (
        <span className="stat-chip" id="chipIndex">
          <i className="dot"></i>
          <span>connecting…</span>
        </span>
      );
    }
    return (
      <span className="stat-chip" id="chipIndex">
        <i className="dot" style={{ background: 'var(--refuse)' }}></i>
        <span>api unreachable</span>
      </span>
    );
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"></span>
        <span className="brand-name">AtoZ</span>
      </div>

      <nav className="status" aria-label="System status">
        {getStatusChip()}
        <a
          className="stat-chip link"
          href="https://github.com/anishka1511/hhg-task2-TeamAtoZ"
          target="_blank"
          rel="noopener noreferrer"
        >
          source ↗
        </a>
      </nav>
    </header>
  );
}
