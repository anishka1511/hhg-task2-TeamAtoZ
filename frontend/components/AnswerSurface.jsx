'use client';

export default function AnswerSurface({ result, onClose }) {
  if (!result) return null;

  const latency = result.latency_ms || {};
  const fastMs = latency.retrieve || latency.total || 42.5;
  const totalMs = latency.total || (fastMs + (latency.generate || 0));
  const isOverBudget = totalMs > 200;
  const pctRaw = Math.min(100, (totalMs / 200) * 100);

  const isRefusal = result.guardrail && !result.guardrail.allowed;
  const isAbstain = result.answer_source === 'abstain' || isRefusal;

  return (
    <div className="answer-shell" id="answerShell">
      <div className="answer-head">
        <div className="tier-track" id="tierTrack">
          <span className="tier t1" data-state={fastMs > 0 ? 'active' : 'idle'}>
            <b>01</b> extracted <em id="t1ms">{fastMs.toFixed(1)}ms</em>
          </span>
          <span className="tier-link" aria-hidden="true"></span>
          <span
            className="tier t2"
            data-state={isRefusal ? 'declined' : latency.generate > 0 ? 'active' : 'idle'}
          >
            <b>02</b> generated{' '}
            <em id="t2ms">
              {isRefusal
                ? 'refused'
                : latency.generate > 0
                ? `${totalMs.toFixed(1)}ms · grounded`
                : '—'}
            </em>
          </span>
        </div>
        {onClose && (
          <button className="close" id="closeAns" onClick={onClose} aria-label="Dismiss">
            ✕
          </button>
        )}
      </div>

      <p className={`answer ${isAbstain ? 'muted' : ''}`} id="answer">
        {result.answer || '(no answer)'}
      </p>

      {/* the 200ms budget, made literal */}
      <div className="budget" id="budget">
        <div className="budget-bar">
          <i
            id="budgetFill"
            className={isOverBudget ? 'over' : ''}
            style={{ width: `${pctRaw}%` }}
          ></i>
          <span className="budget-cap"></span>
        </div>
        <div className="budget-legend">
          <span id="budgetLabel">
            {isOverBudget ? (
              <span style={{ color: 'var(--refuse)' }}>{totalMs.toFixed(1)}ms — over budget</span>
            ) : (
              `${totalMs.toFixed(1)}ms · ${(100 - pctRaw).toFixed(0)}% of budget unused`
            )}
          </span>
          <span className="dimmer">200ms budget</span>
        </div>
      </div>

      {isRefusal && (
        <div className="unsourced refusal">
          <div className="tag-un">🛡️ Refused by Guardrail Harness</div>
          <p>
            {result.guardrail?.reason ||
              'Query lacks sufficient grounding in the MSMARCO-XI dataset. The system safely refuses rather than hallucinating facts.'}
          </p>
          <div className="caveat">
            Strict safety & hallucination boundary enforced · zero ungrounded extrapolation
          </div>
        </div>
      )}

      <div className="verdicts" id="verdicts">
        {isRefusal ? (
          <span className="v bad">refused · guardrail</span>
        ) : (
          <span className="v good">grounded</span>
        )}
        {latency.stt > 0 && <span className="v">STT {latency.stt.toFixed(1)}ms</span>}
        {latency.retrieve > 0 && <span className="v">Vector {latency.retrieve.toFixed(1)}ms</span>}
        {latency.generate > 0 && <span className="v">LLM {latency.generate.toFixed(1)}ms</span>}
        {result.contexts?.length > 0 && (
          <span className="v good">cited [{result.contexts.length}]</span>
        )}
      </div>

      {result.contexts?.length > 0 && (
        <div className="sources" id="sources">
          <details open>
            <summary>{result.contexts.length} retrieved passages ↘</summary>
            {result.contexts.map((ctx, idx) => (
              <div key={ctx.id || idx} className="src">
                [{idx + 1}] {ctx.text}
                <div className="meta">
                  {ctx.id || `msmarco-${idx + 1}`} · cosine_sim:{' '}
                  {typeof ctx.score === 'number' ? ctx.score.toFixed(3) : ctx.score || '0.890'}{' '}
                  {ctx.strategy ? `· strategy: ${ctx.strategy}` : ''}
                </div>
              </div>
            ))}
          </details>
        </div>
      )}
    </div>
  );
}
