'use client';

export default function RefusalBanner({ guardrail }) {
  if (!guardrail || guardrail.allowed) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(245, 158, 11, 0.08))',
      border: '1px solid rgba(244, 63, 94, 0.3)',
      borderRadius: 'var(--radius-md)',
      padding: '1rem 1.25rem',
      marginTop: '1.25rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      boxShadow: '0 4px 20px rgba(244, 63, 94, 0.1)'
    }}>
      <div style={{
        background: 'rgba(244, 63, 94, 0.2)',
        color: '#f43f5e',
        width: 32,
        height: 32,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1rem',
        flexShrink: 0
      }}>
        🛡️
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fda4af' }}>
            Query Refused by Guardrail Harness
          </h4>
          <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
            Reason: {guardrail.reason || 'Off-Topic / Ungrounded'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#fecdd3', lineHeight: 1.4 }}>
          The query does not contain sufficient grounded context in the MSMARCO-XI dataset or triggered strict safety guardrails. The system safely refuses rather than hallucinating an answer.
        </p>
      </div>
    </div>
  );
}
