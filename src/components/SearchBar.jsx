export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-wrap">
      <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="search"
        className="search-input"
        placeholder="Rechercher un produit — bœuf, agneau, volaille…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <style>{`
        .search-wrap {
          position: relative;
          flex: 1;
          max-width: 380px;
        }
        .search-icon {
          position: absolute;
          left: 2px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }
        .search-input {
          width: 100%;
          padding: 10px 4px 10px 26px;
          border-radius: 0;
          border: none;
          border-bottom: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text);
          font-size: 14px;
          font-family: var(--font-body);
          transition: border-color 0.2s;
        }
        .search-input:focus {
          outline: none;
          border-bottom-color: var(--color-ink);
        }
        .search-input::placeholder { color: var(--color-text-muted); }
      `}</style>
    </div>
  )
}

