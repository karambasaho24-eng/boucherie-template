import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, fetchSiteConfig } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState(null)
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  useEffect(() => {
    fetchSiteConfig().then(setConfig).catch(() => {})
  }, [])

  async function handleLogin() {
    if (!email || !password) { setError('Champs obligatoires.'); return }
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      await refreshProfile()
      navigate('/admin')
    } catch (err) {
      setError('Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <span className="login-mark" aria-hidden="true">
          {config?.logo_url ? (
            <img src={config.logo_url} alt="" className="login-mark-img" />
          ) : (
            <svg viewBox="0 0 40 40" width="38" height="38">
              <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
              <line x1="11" y1="20" x2="29" y2="20" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </span>
        <h2>Administration</h2>
        <p className="text-muted">{config?.site_title || "Chargement…"}</p>

        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@email.com" />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        {error && <p className="login-error">{error}</p>}

        <button className="btn btn-primary btn-block" onClick={handleLogin} disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--color-paper);
        }
        .login-card {
          width: 100%;
          max-width: 380px;
          padding: 44px 36px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
        }
        .login-mark { color: var(--color-ink); display: inline-flex; margin-bottom: 20px; }
        .login-mark-img { width: 48px; height: 48px; object-fit: cover; border-radius: 50%; border: 1px solid var(--color-border); }
        .login-card h2 { font-family: var(--font-display); font-weight: 600; font-size: 24px; margin: 0 0 4px; letter-spacing: -0.3px; }
        .login-card .text-muted { margin: 0 0 28px; font-size: 13px; }
        .login-error { color: var(--color-red); font-size: 13px; margin: 0 0 12px; }
      `}</style>
    </div>
  )
}
