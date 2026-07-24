import { useEffect, useRef, useState } from 'react'
import { fetchSiteConfig, updateSiteConfig, uploadSiteImage } from '../../lib/api'

const THEME_COLORS = [
  { id: 'original',   label: 'Original (noir/blanc/rouge)', swatch: '#0a0a0a' },
  { id: 'red',        label: 'Rouge',             swatch: '#b5181f' },
  { id: 'green',      label: 'Vert',              swatch: '#1f7a3d' },
  { id: 'blue',       label: 'Bleu',              swatch: '#1452b5' },
  { id: 'gold',       label: 'Doré',              swatch: '#a87412' },
  { id: 'purple',     label: 'Violet',            swatch: '#6b2fb3' },
  { id: 'teal',       label: 'Bleu canard',       swatch: '#0d7a72' },
  { id: 'orange',     label: 'Orange',            swatch: '#c2540c' },
  { id: 'rose',       label: 'Rose',              swatch: '#c21d6e' },
  { id: 'slate',      label: 'Ardoise',           swatch: '#3d5a73' },
  { id: 'terracotta', label: 'Terracotta',        swatch: '#b4502f' },
]

export default function AdminConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const bannerRef = useRef()
  const logoRef = useRef()
  const faviconRef = useRef()

  useEffect(() => {
    fetchSiteConfig()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setConfig((c) => ({ ...c, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleBannerUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadSiteImage(file)
      setConfig((c) => ({ ...c, banner_image: url }))
    } catch {
      setError('Erreur upload bannière.')
    } finally {
      setUploading(false)
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadSiteImage(file)
      setConfig((c) => ({ ...c, logo_url: url }))
    } catch {
      setError('Erreur upload logo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleFaviconUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadSiteImage(file)
      setConfig((c) => ({ ...c, favicon_url: url }))
    } catch {
      setError('Erreur upload favicon.')
    } finally {
      setUploading(false)
    }
  }

  function handleThemeChange(themeId) {
    setConfig((c) => ({ ...c, theme_color: themeId }))
    // Aperçu immédiat, avant même la sauvegarde.
    // "original" retire l'attribut pour revenir aux valeurs par défaut
    // (noir/blanc/rouge) définies dans :root.
    if (themeId === 'original') {
      document.documentElement.removeAttribute('data-color-theme')
    } else {
      document.documentElement.setAttribute('data-color-theme', themeId)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await updateSiteConfig({
        site_title: config.site_title,
        favicon_url: config.favicon_url ?? '',
        hero_title: config.hero_title,
        hero_subtitle: config.hero_subtitle,
        opening_hours: config.opening_hours,
        phone: config.phone,
        address: config.address,
        banner_image: config.banner_image,
        logo_url: config.logo_url,
        about_title: config.about_title,
        about_text: config.about_text,
        theme_color: config.theme_color,
        whatsapp_number: config.whatsapp_number,
        order_mode: config.order_mode,
        delivery_enabled: config.delivery_enabled ?? false,
        stripe_enabled:         config.stripe_enabled ?? false,
        stripe_secret_key:      config.stripe_secret_key ?? '',
        stripe_publishable_key: config.stripe_publishable_key ?? '',
        stripe_webhook_secret:  config.stripe_webhook_secret ?? '',
        stripe_mode:            config.stripe_mode ?? 'test',
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted">Chargement...</p>

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Configuration du site</h2>
      </div>

      <div className="config-grid">
        <div className="config-block">
          <h4>Identité</h4>
          <div className="field">
            <label>Titre du site</label>
            <input className="input" name="site_title" value={config.site_title || ''} onChange={handleChange} />
          </div>
          <div className="field">
            <label>Titre hero (bannière)</label>
            <input className="input" name="hero_title" value={config.hero_title || ''} onChange={handleChange} />
          </div>
          <div className="field">
            <label>Sous-titre hero</label>
            <textarea className="textarea" name="hero_subtitle" rows={2} value={config.hero_subtitle || ''} onChange={handleChange} />
          </div>
        </div>

        <div className="config-block">
          <h4>Contact &amp; Horaires</h4>
          <div className="field">
            <label>Téléphone</label>
            <input className="input" name="phone" value={config.phone || ''} onChange={handleChange} />
          </div>
          <div className="field">
            <label>Adresse de la boutique</label>
            <input className="input" name="address" value={config.address || ''} onChange={handleChange} />
          </div>
          <div className="field">
            <label>Horaires d'ouverture</label>
            <input className="input" name="opening_hours" value={config.opening_hours || ''} onChange={handleChange} placeholder="09:30 - 19:30" />
          </div>
        </div>

        <div className="config-block">
          <h4>Image bannière</h4>
          {config.banner_image && (
            <img src={config.banner_image} alt="Bannière" className="banner-preview" />
          )}
          <input ref={bannerRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleBannerUpload} />
          <button className="btn btn-ghost btn-sm" onClick={() => bannerRef.current.click()} disabled={uploading}>
            {uploading ? 'Upload…' : 'Prendre une photo / Choisir une image'}
          </button>
          {config.banner_image && (
            <button className="btn btn-danger btn-sm banner-delete-btn" onClick={() => setConfig((c) => ({ ...c, banner_image: '' }))}>
              Supprimer
            </button>
          )}
        </div>

        <div className="config-block">
          <h4>Logo du site</h4>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
            Affiché dans le bandeau en haut du site, à la place du symbole par défaut.
          </p>
          {config.logo_url && (
            <img src={config.logo_url} alt="Logo" className="logo-preview" />
          )}
          <input ref={logoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleLogoUpload} />
          <button className="btn btn-ghost btn-sm" onClick={() => logoRef.current.click()} disabled={uploading}>
            {uploading ? 'Upload…' : 'Choisir un logo'}
          </button>
          {config.logo_url && (
            <button className="btn btn-danger btn-sm banner-delete-btn" onClick={() => setConfig((c) => ({ ...c, logo_url: '' }))}>
              Supprimer
            </button>
          )}
        </div>

        <div className="config-block">
          <h4>Favicon (icône d'onglet navigateur)</h4>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
            Petite icône affichée dans l'onglet du navigateur. Format carré recommandé (ex : 64×64px, PNG ou ICO).
          </p>
          {config.favicon_url && (
            <img src={config.favicon_url} alt="Favicon" className="favicon-preview" />
          )}
          <input ref={faviconRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFaviconUpload} />
          <button className="btn btn-ghost btn-sm" onClick={() => faviconRef.current.click()} disabled={uploading}>
            {uploading ? 'Upload…' : 'Choisir un favicon'}
          </button>
          {config.favicon_url && (
            <button className="btn btn-danger btn-sm banner-delete-btn" onClick={() => setConfig((c) => ({ ...c, favicon_url: '' }))}>
              Supprimer
            </button>
          )}
        </div>

        <div className="config-block">
          <h4>Notre histoire</h4>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
            Affiché sur la page d'accueil, dans la section sombre dédiée à votre histoire.
          </p>
          <div className="field">
            <label>Titre de la section</label>
            <input className="input" name="about_title" value={config.about_title || ''} onChange={handleChange} placeholder="Notre histoire" />
          </div>
          <div className="field">
            <label>Texte</label>
            <textarea className="textarea" name="about_text" rows={5} value={config.about_text || ''} onChange={handleChange} />
          </div>
        </div>

        <div className="config-block">
          <h4>Thème de couleur</h4>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 14 }}>
            Change la couleur du site (fond sombre, boutons, liens, badges). Compatible avec le mode sombre.
          </p>
          <div className="theme-swatches">
            {THEME_COLORS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-swatch-btn${(config.theme_color || 'original') === t.id ? ' active' : ''}`}
                onClick={() => handleThemeChange(t.id)}
                title={t.label}
              >
                <span className="theme-swatch-dot" style={{ background: t.swatch }} />
                <span className="theme-swatch-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="config-block">
          <h4>Commande &amp; WhatsApp</h4>
          <div className="field">
            <label>Numéro WhatsApp</label>
            <input className="input" name="whatsapp_number" value={config.whatsapp_number || ''} onChange={handleChange} placeholder="+33243410951" />
          </div>
          <div className="field">
            <label>Mode de commande</label>
            <select className="select" name="order_mode" value={config.order_mode || 'both'} onChange={handleChange}>
              <option value="site">Site uniquement</option>
              <option value="whatsapp">WhatsApp uniquement</option>
              <option value="both">Site + WhatsApp</option>
            </select>
          </div>
          {config.whatsapp_number && (
            <div className="whatsapp-preview">
              <p className="whatsapp-preview-label">Aperçu du message envoyé</p>
              <pre className="whatsapp-preview-text">{`Commande #ABCD1234\nNom du client\nTél. ${config.whatsapp_number}\n\n- Produit x1 — 10.00 €\n\nTotal : 10.00 €\n\nSuivre ma commande et payer en ligne :\nhttps://votresite.fr/commande/...`}</pre>
            </div>
          )}
        </div>

        <div className="config-block">
          <h4>Livraison</h4>
          <div className="delivery-toggle-row">
            <div className="delivery-toggle-info">
              <p className="delivery-toggle-title">Activer la livraison à domicile</p>
              <p className="delivery-toggle-desc">
                Lorsqu'activée, le client doit saisir son adresse lors de la commande.
                Lorsque désactivée, seul le retrait en boutique est proposé.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                name="delivery_enabled"
                checked={config.delivery_enabled ?? false}
                onChange={handleChange}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className={`delivery-status ${config.delivery_enabled ? 'status-on' : 'status-off'}`}>
            {config.delivery_enabled ? '🚚 Livraison activée' : '🏪 Retrait boutique uniquement'}
          </div>
        </div>

        <div className="config-block">
          <h4>Paiement en ligne</h4>
          <div className="delivery-toggle-row">
            <div className="delivery-toggle-info">
              <p className="delivery-toggle-title">Activer le paiement par carte (Stripe)</p>
              <p className="delivery-toggle-desc">
                Lorsqu'activé, le client peut payer en ligne une commande confirmée (que ce soit via le site ou via WhatsApp), ou choisir de payer sur place.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                name="stripe_enabled"
                checked={config.stripe_enabled ?? false}
                onChange={handleChange}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className={`delivery-status ${config.stripe_enabled ? 'status-on' : 'status-off'}`}>
            {config.stripe_enabled ? '💳 Paiement carte activé' : '💶 Paiement sur place uniquement'}
          </div>
        </div>

        {/* ---- CONFIGURATION STRIPE ---- */}
        <div className="config-block stripe-block">
          <h4>🔑 Clés Stripe</h4>
          <p className="stripe-intro">
            Ces clés se trouvent sur <strong>dashboard.stripe.com</strong> → Développeurs → Clés API.<br />
            Utilisez les clés <em>Test</em> pour vos essais, puis les clés <em>Live</em> pour les vrais paiements.
          </p>

          <div className="field">
            <label>Mode</label>
            <div className="stripe-mode-toggle">
              <button
                className={`stripe-mode-btn${(config.stripe_mode ?? 'test') === 'test' ? ' active' : ''}`}
                onClick={() => setConfig(c => ({ ...c, stripe_mode: 'test' }))}
                type="button"
              >🧪 Test</button>
              <button
                className={`stripe-mode-btn${(config.stripe_mode ?? 'test') === 'live' ? ' active live' : ''}`}
                onClick={() => setConfig(c => ({ ...c, stripe_mode: 'live' }))}
                type="button"
              >🟢 Live (production)</button>
            </div>
          </div>

          <div className="field">
            <label>Clé secrète {config.stripe_mode === 'live' ? '(sk_live_…)' : '(sk_test_…)'}</label>
            <div className="stripe-key-wrap">
              <input
                className="input stripe-key-input"
                type="password"
                name="stripe_secret_key"
                value={config.stripe_secret_key ?? ''}
                onChange={handleChange}
                placeholder={config.stripe_mode === 'live' ? 'sk_live_…' : 'sk_test_…'}
                autoComplete="off"
              />
              {config.stripe_secret_key && (
                <span className="stripe-key-status ok">✓</span>
              )}
            </div>
            <span className="field-hint">Stripe → Développeurs → Clés API → Clé secrète</span>
          </div>

          <div className="field">
            <label>Clé publique {config.stripe_mode === 'live' ? '(pk_live_…)' : '(pk_test_…)'}</label>
            <div className="stripe-key-wrap">
              <input
                className="input stripe-key-input"
                type="text"
                name="stripe_publishable_key"
                value={config.stripe_publishable_key ?? ''}
                onChange={handleChange}
                placeholder={config.stripe_mode === 'live' ? 'pk_live_…' : 'pk_test_…'}
                autoComplete="off"
              />
              {config.stripe_publishable_key && (
                <span className="stripe-key-status ok">✓</span>
              )}
            </div>
            <span className="field-hint">Stripe → Développeurs → Clés API → Clé publiable</span>
          </div>

          <div className="field">
            <label>Secret webhook (whsec_…)</label>
            <div className="stripe-key-wrap">
              <input
                className="input stripe-key-input"
                type="password"
                name="stripe_webhook_secret"
                value={config.stripe_webhook_secret ?? ''}
                onChange={handleChange}
                placeholder="whsec_…"
                autoComplete="off"
              />
              {config.stripe_webhook_secret && (
                <span className="stripe-key-status ok">✓</span>
              )}
            </div>
            <span className="field-hint">Stripe → Développeurs → Webhooks → Signing secret</span>
          </div>

          <div className="stripe-help-box">
            <p className="stripe-help-title">📋 Comment configurer le webhook ?</p>
            <ol className="stripe-help-steps">
              <li>Va sur <strong>dashboard.stripe.com</strong> → Développeurs → Webhooks</li>
              <li>Clique <strong>Ajouter un endpoint</strong></li>
              <li>URL : <code className="stripe-code">{window.location.origin.replace('admin','')}/functions/v1/stripe-webhook</code></li>
              <li>Événements à écouter : <code className="stripe-code">checkout.session.completed</code> et <code className="stripe-code">checkout.session.expired</code></li>
              <li>Copie le <strong>Signing secret</strong> (whsec_…) et colle-le ci-dessus</li>
            </ol>
          </div>
        </div>

      </div>

      {error && <p className="config-error">{error}</p>}
      {success && <p className="config-success">Configuration sauvegardée ✓</p>}

      <button className="btn btn-primary config-save-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Sauvegarde…' : 'Sauvegarder la configuration'}
      </button>

      <style>{`
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .section-header h2 { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 22px; letter-spacing: -0.3px; }
        .config-grid { display: grid; gap: 1px; grid-template-columns: 1fr; background: var(--color-border); border: 1px solid var(--color-border); }
        .config-block { padding: 24px; background: var(--color-surface); }
        .config-block h4 { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 18px; color: var(--color-red); }
        @media (min-width: 768px) { .config-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .config-grid { grid-template-columns: 1fr 1fr 1fr; } }
        .banner-preview { width: 100%; height: 140px; object-fit: cover; margin-bottom: 12px; border: 1px solid var(--color-border); }
        .logo-preview { width: 72px; height: 72px; object-fit: cover; margin-bottom: 12px; border: 1px solid var(--color-border); border-radius: 6px; }
        .favicon-preview { width: 40px; height: 40px; object-fit: cover; margin-bottom: 12px; border: 1px solid var(--color-border); border-radius: 6px; }
        .theme-swatches { display: flex; flex-wrap: wrap; gap: 8px; }
        .theme-swatch-btn { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--color-border); background: var(--color-paper-dim); transition: all 0.2s; }
        .theme-swatch-btn:hover { border-color: var(--color-text-muted); }
        .theme-swatch-btn.active { border-color: var(--color-text); background: var(--color-surface); box-shadow: inset 0 0 0 1px var(--color-text); }
        .theme-swatch-dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.12); }
        .theme-swatch-label { font-size: 12px; font-weight: 600; color: var(--color-text); white-space: nowrap; }
        .banner-delete-btn { margin-top: 8px; margin-left: 8px; }
        .whatsapp-preview { margin-top: 16px; background: var(--color-paper-dim); padding: 12px 14px; border: 1px solid var(--color-border); }
        .whatsapp-preview-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--color-text-muted); margin: 0 0 8px; }
        .whatsapp-preview-text { font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; margin: 0; color: var(--color-text); line-height: 1.6; }

        .delivery-toggle-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
        .delivery-toggle-info { flex: 1; }
        .delivery-toggle-title { font-weight: 600; font-size: 13.5px; margin: 0 0 4px; color: var(--color-text); }
        .delivery-toggle-desc { font-size: 12px; color: var(--color-text-muted); margin: 0; line-height: 1.5; }
        .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; margin-top: 2px; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; inset: 0; background: var(--color-border-dark); transition: 0.3s; border-radius: 24px; cursor: pointer; }
        .toggle-slider:before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: white; transition: 0.3s; border-radius: 50%; }
        .toggle-switch input:checked + .toggle-slider { background: #2f6b3a; }
        .toggle-switch input:checked + .toggle-slider:before { transform: translateX(20px); }
        .delivery-status { font-size: 12.5px; font-weight: 600; padding: 10px 14px; border-radius: 0; }
        .status-on { background: rgba(47,107,58,0.1); color: #2f6b3a; border: 1px solid rgba(47,107,58,0.3); }
        .status-off { background: var(--color-paper-dim); color: var(--color-text-muted); border: 1px solid var(--color-border); }

        .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .field label { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-muted); }
        .config-error { color: var(--color-red); margin-top: 16px; font-size: 13px; }

        /* Stripe */
        .stripe-block { grid-column: 1 / -1; }
        .stripe-intro { font-size: 12.5px; color: var(--color-text-muted); margin: -6px 0 18px; line-height: 1.55; }
        .stripe-mode-toggle { display: flex; gap: 0; border: 1px solid var(--color-border); width: fit-content; margin-bottom: 4px; }
        .stripe-mode-btn { padding: 8px 18px; font-size: 12px; font-weight: 700; border: none; background: var(--color-paper-dim); color: var(--color-text-muted); cursor: pointer; transition: all 0.2s; }
        .stripe-mode-btn.active { background: var(--color-ink); color: var(--color-paper); }
        .stripe-mode-btn.active.live { background: #1a5c2a; }
        .stripe-key-wrap { display: flex; align-items: center; gap: 8px; }
        .stripe-key-input { flex: 1; font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.5px; }
        .stripe-key-status { font-size: 16px; }
        .stripe-key-status.ok { color: #2f6b3a; }
        .field-hint { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
        .stripe-help-box { margin-top: 20px; background: var(--color-paper-dim); border: 1px solid var(--color-border); padding: 16px 18px; }
        .stripe-help-title { font-weight: 700; font-size: 13px; margin: 0 0 10px; }
        .stripe-help-steps { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--color-text-muted); line-height: 1.5; }
        .stripe-help-steps strong { color: var(--color-text); }
        .stripe-code { font-family: var(--font-mono); font-size: 11px; background: var(--color-border); padding: 1px 5px; }
        .config-success { color: #2f6b3a; margin-top: 16px; font-size: 13px; font-weight: 600; }
        .config-save-btn { margin-top: 24px; }
        .btn-danger { background: var(--color-red); color: #fff; border-color: var(--color-red); }
        .btn-danger:hover { background: transparent; color: var(--color-red); }
      `}</style>
    </div>
  )
}
