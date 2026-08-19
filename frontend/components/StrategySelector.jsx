'use client';

const STRATEGIES = [
  { id: 'fixed_overlap', label: 'fixed_overlap', desc: 'Chunk size 256 / 50 overlap' },
  { id: 'semantic', label: 'semantic_boundary', desc: 'Sentence & topic boundaries' },
  { id: 'metadata', label: 'metadata_aware', desc: 'Hierarchical section indexing' },
];

export default function StrategySelector({ selectedStrategy, onSelect, disabled }) {
  return (
    <div className="strategy-selector-row">
      <span className="strategy-label-tag">Strategy:</span>
      {STRATEGIES.map((strat) => {
        const isActive = selectedStrategy === strat.id;
        return (
          <button
            key={strat.id}
            type="button"
            disabled={disabled}
            className={`strategy-pill-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(strat.id)}
            title={strat.desc}
          >
            {strat.label}
          </button>
        );
      })}
    </div>
  );
}
