'use client';

export default function PipelineHUD({ currentStage = 'idle' }) {
  const steps = [
    {
      id: 'input',
      label: 'Input',
      desc: 'Mic / Text',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      ),
    },
    {
      id: 'stt',
      label: 'Sarvam STT',
      desc: '16kHz PCM',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
    },
    {
      id: 'retrieval',
      label: 'Qdrant HNSW',
      desc: 'Vector Search',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      ),
    },
    {
      id: 'guardrail',
      label: 'Guardrails',
      desc: 'Anti-Hallucination',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
    },
    {
      id: 'output',
      label: 'Grounded Gen',
      desc: '<200ms Target',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="9" y1="18" x2="15" y2="18"/>
          <line x1="10" y1="22" x2="14" y2="22"/>
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="pipeline-hud-container">
      {steps.map((step, idx) => {
        const isActive = currentStage === step.id;
        const isDone = currentStage === 'done' || (currentStage === 'output' && idx < 4);

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className={`pipeline-step-node ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
              <div className="node-icon-box">{step.icon}</div>
              <div className="node-info">
                <span className="node-title">{step.label}</span>
                <span className="node-subtitle">{step.desc}</span>
              </div>
            </div>
            {idx < steps.length - 1 && <span className="node-arrow">→</span>}
          </div>
        );
      })}
    </div>
  );
}
