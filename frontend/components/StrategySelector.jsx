'use client';

const STRATEGIES = [
  { id: 'fixed_overlap', label: 'fixed_overlap', desc: 'Sliding character windows with overlap' },
  { id: 'semantic', label: 'semantic', desc: 'Sentence-aware packing' },
  { id: 'metadata_aware', label: 'metadata_aware', desc: 'Keep short passages whole' },
  { id: 'token_window', label: 'token_window', desc: 'Word-window sliding chunks' },
  { id: 'structure_aware', label: 'structure_aware', desc: 'Headings / lists / sections' },
  { id: 'recursive', label: 'recursive', desc: 'Hierarchical split under max size' },
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
