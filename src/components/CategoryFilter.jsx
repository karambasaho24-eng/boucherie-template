export default function CategoryFilter({ categories, active, onChange }) {
  return (
    <div className="category-filter">
      <button
        className={`chip ${active === 'all' ? 'chip-active' : ''}`}
        onClick={() => onChange('all')}
      >
        Tout voir
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          className={`chip ${active === cat ? 'chip-active' : ''}`}
          onClick={() => onChange(cat)}
        >
          {cat}
        </button>
      ))}

      <style>{`
        .category-filter {
          display: flex;
          gap: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .category-filter::-webkit-scrollbar { display: none; }
        .chip {
          flex-shrink: 0;
          padding: 9px 18px;
          border-radius: 0;
          border: 1px solid var(--color-border);
          border-right-width: 0;
          background: transparent;
          color: var(--color-text-muted);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .chip:last-child { border-right-width: 1px; }
        .chip:hover:not(.chip-active) {
          color: var(--color-text);
          background: var(--color-paper-dim);
        }
        .chip-active {
          background: var(--color-ink);
          border-color: var(--color-ink);
          color: var(--color-paper);
        }
      `}</style>
    </div>
  )
}

