import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut, fetchSiteConfig } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import AdminDashboardStats from './AdminDashboardStats'
import AdminSnapshots from './AdminSnapshots'
import AdminProducts from './AdminProducts'
import AdminOrders from './AdminOrders'
import AdminConfig from './AdminConfig'
import AdminStock from './AdminStock'

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'snapshots', label: 'Performances' },
  { id: 'orders',   label: 'Commandes' },
  { id: 'products', label: 'Produits' },
  { id: 'stock',    label: 'Stocks' },
  { id: 'config',   label: 'Paramètres' },
]

export default function AdminDashboard() {
  const [tab, setTab] = useState('dashboard')
  const [config, setConfig] = useState(null)
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchSiteConfig().then(setConfig).catch(console.error)
  }, [])

  async function handleLogout() {
    await signOut()
    await refreshProfile()
    navigate('/admin/login')
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          {config?.logo_url ? (
            <img src={config.logo_url} alt="" className="admin-brand-img" />
          ) : (
            <svg viewBox="0 0 40 40" width="30" height="30">
              <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
              <line x1="11" y1="20" x2="29" y2="20" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
          <div>
            <p className="admin-brand-title">{config?.site_title || "Ma Boucherie"}</p>
            <p className="admin-brand-sub">Administration</p>
          </div>
        </div>

        <nav className="admin-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`admin-nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="admin-footer">
          <p className="text-muted">{profile?.email}</p>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Déconnexion</button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div className="admin-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Déco</button>
        </div>

        <div className="admin-content">
          {tab === 'dashboard' && <AdminDashboardStats />}
          {tab === 'snapshots' && <AdminSnapshots />}
          {tab === 'orders'   && <AdminOrders />}
          {tab === 'products' && <AdminProducts />}
          {tab === 'stock'    && <AdminStock />}
          {tab === 'config'   && <AdminConfig />}
        </div>
      </main>

      <style>{`
        .admin-layout { min-height: 100vh; display: flex; background: var(--color-paper); }
        .admin-sidebar { display: none; width: 240px; flex-shrink: 0; background: var(--color-surface); border-right: 1px solid var(--color-border); flex-direction: column; padding: 24px 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        .admin-brand { display: flex; align-items: center; gap: 12px; padding: 0 22px 22px; border-bottom: 1px solid var(--color-border); color: var(--color-ink); }
        .admin-brand-img { width: 30px; height: 30px; object-fit: cover; border-radius: 50%; border: 1px solid var(--color-border); flex-shrink: 0; }
        .admin-brand-title { font-weight: 700; font-size: 13px; margin: 0; color: var(--color-text); }
        .admin-brand-sub { font-family: var(--font-mono); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--color-text-muted); margin: 2px 0 0; }
        .admin-nav { padding: 14px 0; flex: 1; }
        .admin-nav-item { width: 100%; padding: 13px 22px; text-align: left; background: none; border: none; border-left: 2px solid transparent; font-size: 13.5px; font-weight: 600; color: var(--color-text-muted); display: block; transition: all 0.2s; }
        .admin-nav-item:hover { color: var(--color-text); background: var(--color-paper-dim); }
        .admin-nav-item.active { color: var(--color-text); background: var(--color-paper-dim); border-left-color: var(--color-red); }
        .admin-footer { padding: 18px 22px; border-top: 1px solid var(--color-border); }
        .admin-footer p { font-size: 12px; margin: 0 0 10px; }
        .admin-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .admin-topbar { display: flex; align-items: center; justify-content: space-between; background: var(--color-surface); border-bottom: 1px solid var(--color-border); padding: 0 16px; gap: 8px; overflow-x: auto; }
        .admin-tabs { display: flex; gap: 0; }
        .tab-btn { padding: 16px 14px; font-size: 12.5px; font-weight: 600; background: none; border: none; border-bottom: 2px solid transparent; color: var(--color-text-muted); white-space: nowrap; }
        .tab-btn.active { color: var(--color-text); border-bottom-color: var(--color-red); }
        .admin-content { padding: 24px 16px; flex: 1; }
        @media (min-width: 768px) {
          .admin-sidebar { display: flex; }
          .admin-topbar { display: none; }
          .admin-content { padding: 36px 36px; }
        }
      `}</style>
    </div>
  )
}
