'use client';

import { useState } from 'react';

export default function ContextInspector({ contexts }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!Array.isArray(contexts) || contexts.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <span>📚</span> Grounded Context Chunks
          <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
            {contexts.length} Retrieved
          </span>
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Indexed via Qdrant Vector Engine
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {contexts.map((c, index) => {
          const score = typeof c.score === 'number' ? c.score.toFixed(3) : (c.score || '0.000');
          const isExpanded = expandedId === c.id || expandedId === index;

          return (
            <div
              key={c.id || index}
              className="glass-panel glass-panel-interactive"
              style={{ padding: '1rem', cursor: 'pointer' }}
              onClick={() => setExpandedId(isExpanded ? null : (c.id || index))}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.75rem', 
                    color: 'var(--accent-cyan)', 
                    background: 'rgba(6, 182, 212, 0.1)', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    border: '1px solid rgba(6, 182, 212, 0.2)'
                  }}>
                    {c.id || `chunk-${index + 1}`}
                  </span>
                  {c.strategy && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      strategy: <strong>{c.strategy}</strong>
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cosine Sim:</span>
                  <span className="badge badge-success" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {score}
                  </span>
                </div>
              </div>

              <p style={{
                margin: 0,
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: isExpanded ? 'unset' : 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {c.text}
              </p>

              <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                  {isExpanded ? '▲ Collapse' : '▼ Read full snippet'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
