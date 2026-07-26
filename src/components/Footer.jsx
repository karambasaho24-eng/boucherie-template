export default function Footer({ config }) {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="container footer-grid">
          <div className="footer-brand">
            <span className="footer-mark" aria-hidden="true">
              {config?.logo_url ? (
                <img src={config.logo_url} alt="" className="footer-mark-img" />
              ) : (
                <svg viewBox="0 0 40 40" width="34" height="34">
                  <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
                  <line x1="11" y1="20" x2="29" y2="20" stroke="currentColor" strokeWidth="1" />
                  <circle cx="20" cy="3.5" r="1.6" fill="currentColor" />
                </svg>
              )}
            </span>
            <h3>{config?.site_title || "Ma Boucherie"}</h3>
            <p>Boucherie artisanale, viandes fraîches et fait maison</p>
            <div className="footer-certif">
              <span>Halal certifié</span>
              <span>Vente directe</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Informations</h4>
            <ul>
              <li>{config?.address || 'adresse communiquée après commande'}</li>
              <li><a href={`tel:${(config?.phone || '').replace(/\s/g,'')}`}>{config?.phone || ''}</a></li>
              <li>{config?.opening_hours || 'Lun–Sam 09:30–19:30'}</li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Navigation</h4>
            <ul>
              <li><a href="/">Accueil</a></li>
              <li><a href="/boutique">Boutique</a></li>
              <li><a href="/panier">Panier</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <span>© {new Date().getFullYear()} {config?.site_title || "Ma Boucherie"} — Tous droits réservés</span>
          <span className="footer-made">
            Le Mans, France <a href="/admin/login" className="footer-admin-link">· Espace pro</a>
          </span>
        </div>
      </div>

      <style>{`
        .footer { background: var(--color-ink); color: rgba(250,249,246,0.8); }
        .footer-top { padding: 72px 0 48px; }
        .footer-grid { display: grid; grid-template-columns: 1fr; gap: 44px; }
        .footer-mark { color: var(--color-paper); display: inline-flex; margin-bottom: 18px; }
        .footer-mark-img { width: 34px; height: 34px; object-fit: cover; border-radius: 50%; border: 1px solid rgba(250,249,246,0.3); }
        .footer-brand h3 { font-family: var(--font-heading); font-size: 18px; font-weight: 800; margin: 0 0 10px; color: var(--color-paper); }
        .footer-brand p { font-size: 13px; margin: 0 0 18px; opacity: 0.6; line-height: 1.7; max-width: 280px; }
        .footer-certif { display: flex; gap: 10px; flex-wrap: wrap; }
        .footer-certif span { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.6px; padding: 5px 12px; border: 1px solid rgba(250,249,246,0.25); color: rgba(250,249,246,0.75); }
        .footer-col h4 { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--color-red); margin: 0 0 20px; }
        .footer-col ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .footer-col li { font-size: 13.5px; opacity: 0.7; line-height: 1.6; }
        .footer-col a { opacity: 1; transition: opacity 0.2s; border-bottom: 1px solid transparent; }
        .footer-col a:hover { border-bottom-color: currentColor; }
        .footer-bottom { border-top: 1px solid rgba(250,249,246,0.12); padding: 20px 0; }
        .footer-bottom-inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-family: var(--font-mono); font-size: 11px; opacity: 0.45; }
        .footer-admin-link { opacity: 0.7; transition: opacity 0.2s; }
        .footer-admin-link:hover { opacity: 1; color: var(--color-red); }
        @media (min-width: 768px) { .footer-grid { grid-template-columns: 2fr 1fr 1fr; } }
      `}</style>
    </footer>
  )
}
