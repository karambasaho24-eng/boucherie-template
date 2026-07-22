import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import DarkModeToggle from './DarkModeToggle'

function LogoTitle({ title }) {
  const text = title || "Boucherie Le Carrefour d'Orient"
  const idx = text.indexOf("Orient")

  if (idx === -1) {
    return <span className="navbar-logo-name">{text}</span>
  }

  const before = text.slice(0, idx)
  const after = text.slice(idx + 1)

  return (
    <span className="navbar-logo-name navbar-logo-name-svg">
      <span aria-hidden="true" className="logo-visible-parts">
        {before}
        <span className="logo-o-wrap">
          <svg viewBox="0 0 22 22" width="13" height="13" className="logo-o-svg">
            <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="2.1" />
            <circle cx="11" cy="11" r="2.4" fill="currentColor" />
          </svg>
        </span>
        {after}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

export default function Navbar({ siteTitle, logoUrl }) {
  const { count } = useCart()

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="navbar-mark" aria-hidden="true">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="navbar-mark-img" />
            ) : (
              <svg viewBox="0 0 40 40" width="36" height="36">
                <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
                <line x1="11" y1="20" x2="29" y2="20" stroke="currentColor" strokeWidth="1" />
                <circle cx="20" cy="3.5" r="1.6" fill="currentColor" />
              </svg>
            )}
          </span>
          <div className="navbar-logo-text">
            <LogoTitle title={siteTitle} />
            <span className="navbar-logo-sub">Restaurant africain</span>
          </div>
        </Link>

        <nav className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Accueil</NavLink>
          <NavLink to="/boutique" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Boutique</NavLink>
        </nav>

        <div className="navbar-actions">
          <DarkModeToggle />
          <Link to="/panier" className="cart-btn" aria-label="Panier">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {count > 0 && <span className="cart-count">{count}</span>}
          </Link>
        </div>
      </div>

      <style>{`
        .navbar { position: sticky; top: 0; z-index: 100; background: var(--color-surface); border-bottom: 1px solid var(--color-border); height: var(--header-height); backdrop-filter: blur(10px); }
        .navbar-inner { height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .navbar-logo { display: flex; align-items: center; gap: 12px; flex-shrink: 0; text-decoration: none; }
        .navbar-mark { color: var(--color-ink); flex-shrink: 0; display: flex; }
        .navbar-mark-img { width: 36px; height: 36px; object-fit: cover; border-radius: 50%; border: 1px solid var(--color-border); }
        .navbar-logo-text { display: flex; flex-direction: column; line-height: 1.25; }
        .navbar-logo-name { font-family: var(--font-heading); font-size: 15px; font-weight: 800; letter-spacing: 0.2px; color: var(--color-text); white-space: nowrap; }
        .navbar-logo-name-svg { display: inline-flex; align-items: baseline; }
        .logo-visible-parts { display: inline-flex; align-items: baseline; }
        .logo-o-wrap { display: inline-flex; align-items: center; margin: 0 0.5px; transform: translateY(1.5px); }
        .logo-o-svg { color: var(--color-text); flex-shrink: 0; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
        .navbar-logo-sub { font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: var(--color-text-muted); }
        .navbar-links { display: none; gap: 4px; }
        .nav-link { padding: 8px 18px; font-size: 12.5px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: var(--color-text-muted); transition: color 0.2s; position: relative; }
        .nav-link::after { content: ''; position: absolute; left: 18px; right: 18px; bottom: 4px; height: 1px; background: var(--color-ink); transform: scaleX(0); transform-origin: left; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .nav-link:hover { color: var(--color-text); }
        .nav-link:hover::after, .nav-link.active::after { transform: scaleX(1); }
        .nav-link.active { color: var(--color-text); }
        .navbar-actions { display: flex; align-items: center; gap: 14px; }
        .cart-btn { position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: transparent; color: var(--color-text); border: 1px solid var(--color-border); transition: all 0.2s; }
        .cart-btn:hover { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }
        .cart-count { position: absolute; top: -6px; right: -6px; background: var(--color-red); color: #fff; font-family: var(--font-mono); font-size: 10px; font-weight: 700; border-radius: 999px; padding: 1px 5px; min-width: 17px; text-align: center; line-height: 1.4; }
        @media (min-width: 768px) { .navbar-links { display: flex; } }
      `}</style>
    </header>
  )
}
