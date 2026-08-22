'use client';

export default function RefusalBanner({ guardrail }) {
  if (!guardrail || guardrail.allowed !== false) return null;

  const reason = guardrail.reason || 'off_topic';

  return (
    <div className="beach-refusal-banner" role="alert">
      <div className="beach-refusal-banner-head">
        <h3 className="beach-refusal-banner-title">Guardrail muted</h3>
        <span className="beach-refusal-reason-chip">{reason}</span>
      </div>
      <p className="beach-refusal-banner-text">
        This query is off-topic or not grounded in the knowledge base. The system refuses rather
        than hallucinating an answer.
      </p>
    </div>
  );
}
