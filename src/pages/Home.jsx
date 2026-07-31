import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchAvailableProducts } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard'
import IntroExperience from '../components/IntroExperience'

function useReveal(deps = []) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.visible)')
    if (els.length === 0) return

    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } }),
      { threshold: 0.12 }
    )
    els.forEach(el => obs.observe(el))

    const fallback = setTimeout(() => {
      document.querySelectorAll('.reveal:not(.visible)').forEach(el => el.classList.add('visible'))
    }, 1500)

    return () => { obs.disconnect(); clearTimeout(fallback) }
  }, deps)
}

function useParallaxHero() {
  const heroRef = useRef(null)
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    let raf = null
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        const fade = Math.max(0, 1 - y / 700)
        el.style.setProperty('--scrollY', `${y * 0.35}px`)
        el.style.setProperty('--heroFade', fade)
        raf = null
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return heroRef
}

function useMouseTilt() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      el.style.setProperty('--mx', px.toFixed(3))
      el.style.setProperty('--my', py.toFixed(3))
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [])
  return ref
}

function HeroVideo({ src, poster }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    // Sur mobile (Safari iOS, Chrome Android), l'attribut muted posé en JSX
    // n'est pas toujours pris en compte à temps par le navigateur : on force
    // la propriété JS avant de relancer play(), sinon l'autoplay est bloqué
    // silencieusement (la vidéo reste figée sur la 1ère frame).
    v.muted = true
    v.defaultMuted = true
    const playPromise = v.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay refusé (rare, ex. économie de données activée) : on relance
        // dès la première interaction de l'utilisateur avec la page.
        const retry = () => { v.play().catch(() => {}); window.removeEventListener('touchstart', retry) }
        window.addEventListener('touchstart', retry, { once: true })
      })
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      src={src}
      className="hero-bg-img"
      autoPlay
      loop
      muted
      playsInline
      webkit-playsinline="true"
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      controlsList="nodownload noplaybackrate nofullscreen"
      style={{ pointerEvents: 'none' }}
      poster={poster || undefined}
    />
  )
}

export default function Home({ config }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [introDone, setIntroDone] = useState(false)
  useReveal([loading, products.length])
  const heroRef = useParallaxHero()
  const tiltRef = useMouseTilt()

  useEffect(() => {
    document.body.style.overflow = introDone ? '' : 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [introDone])

  useEffect(() => {
    let cancelled = false

    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setLoadError('Le chargement prend trop de temps. Vérifiez la connexion à la base de données.')
        setLoading(false)
      }
    }, 8000)

    fetchAvailableProducts()
      .then((data) => {
        if (cancelled) return
        const featured = data.filter((p) => p.is_featured)
        setProducts(featured.length > 0 ? featured.slice(0, 6) : data.slice(0, 6))
      })
      .catch((err) => {
        console.error('Erreur de chargement des produits :', err)
        if (!cancelled) setLoadError("Impossible de charger les produits pour le moment.")
      })
      .finally(() => {
        if (!cancelled) {
          clearTimeout(safetyTimer)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('home-products-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchAvailableProducts()
            .then((data) => {
              const featured = data.filter((p) => p.is_featured)
              setProducts(featured.length > 0 ? featured.slice(0, 6) : data.slice(0, 6))
            })
            .catch(() => {})
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const phoneClean = (config?.phone || '').replace(/\s/g, '')

  return (
    <div className="home-page">
      <IntroExperience
        siteTitle={config?.site_title}
        tagline={config?.hero_subtitle}
        logoUrl={config?.logo_url}
        onDone={() => setIntroDone(true)}
      />

      {/* ── HERO ── */}
      <section className="hero" ref={heroRef}>
        <div className="hero-grain" />
        <div className="hero-bg-layer" style={{ transform: 'translateY(var(--scrollY, 0px))' }}>
          {config?.banner_video ? (
            <HeroVideo src={config.banner_video} poster={config?.banner_image} />
          ) : config?.banner_image && (
            <img src={config.banner_image} alt="" className="hero-bg-img" />
          )}
        </div>

        <div className="hero-topline">
          <span className="hero-eyebrow">Établissement artisan · Le Mans</span>
          <span className="hero-eyebrow hero-eyebrow-right"></span>
        </div>

        <div className="hero-center" ref={tiltRef}>
          <div className="hero-stamp" aria-hidden="true">
            <svg viewBox="0 0 200 200" className="stamp-svg">
              <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="100" cy="100" r="80" fill="none" strokeWidth="0.6" stroke="currentColor" strokeDasharray="2 4" />
              <text x="100" y="40" textAnchor="middle" className="stamp-text-top">QUALITÉ · HALAL · FRAÎCHEUR</text>
              <text x="100" y="168" textAnchor="middle" className="stamp-text-bottom"></text>
            </svg>
          </div>

          <h1 className="hero-title">
            <span className="hero-title-line">BOUCHE<span className="hero-title-accent">R</span>IE</span>
            <span className="hero-title-rule" />
            <span className="hero-title-sub">{config?.hero_title || ''}</span>
          </h1>

          <p className="hero-subtitle">
            {config?.hero_subtitle || 'Viandes fraîches, découpées sur place, chaque jour.'}
          </p>

          <div className="hero-actions">
            <Link to="/boutique" className="btn btn-primary hero-btn-main">
              Découvrir la boutique
            </Link>
            <a href={`tel:${phoneClean}`} className="hero-call">
              <span className="hero-call-dot" />
              {config?.phone || ''}
            </a>
          </div>
        </div>

        <div className="hero-bottomline">
          <div className="hero-badges-row">
            <span>Halal certifié</span>
            <span>Vente directe</span>
            <span>Découpe artisanale</span>
          </div>
          <div className="hero-scroll-hint">
            <span className="hero-scroll-track"><span className="hero-scroll-dot" /></span>
            Défiler
          </div>
        </div>
      </section>

      {/* ── INFO STRIP ── */}
      <section className="info-strip">
        <div className="container info-strip-inner">
          <div className="info-item reveal">
            <span className="info-index">01</span>
            <div>
              <div className="info-label">Adresse</div>
              <div className="info-value">{config?.address || 'adresse communiquée après commande'}</div>
            </div>
          </div>
          <div className="info-item reveal reveal-delay-1">
            <span className="info-index">02</span>
            <div>
              <div className="info-label">Horaires</div>
              <div className="info-value">{config?.opening_hours || 'Lun–Sam · 09:30 – 19:30'}</div>
            </div>
          </div>
          <div className="info-item reveal reveal-delay-2">
            <span className="info-index">03</span>
            <div>
              <div className="info-label">Certification</div>
              <div className="info-value">100 % Halal & vente directe</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUALITY PILLARS ── */}
      <section className="pillars-section">
        <div className="container">
          <div className="reveal section-head">
            <div className="section-label">Notre engagement</div>
            <h2 className="section-title">La qualité à chaque étape</h2>
          </div>
          <div className="pillars-grid">
            {[
              { n: '01', title: 'Viandes sélectionnées', desc: 'Bœuf, agneau et volaille choisis avec soin auprès de fournisseurs de confiance.' },
              { n: '02', title: 'Découpe artisanale', desc: 'Chaque pièce est préparée sur place par nos bouchers expérimentés.' },
              { n: '03', title: 'Rôtisserie fraîche', desc: 'Poulets, merguez et spécialités grillées chaque jour pour emporter.' },
              { n: '04', title: 'Halal certifié', desc: 'Toutes nos viandes sont halal, rigoureusement sélectionnées et tracées.' },
            ].map((p, i) => (
              <div key={i} className={`pillar-card reveal reveal-delay-${i % 4}`}>
                <span className="pillar-num">{p.n}</span>
                <h3 className="pillar-title">{p.title}</h3>
                <p className="pillar-desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ── */}
      <section className="products-section">
        <div className="container">
          <div className="products-header reveal">
            <div>
              <div className="section-label">Notre sélection</div>
              <h2 className="section-title">Produits du moment</h2>
            </div>
            <Link to="/boutique" className="btn btn-ghost see-all-btn">
              Voir tout
            </Link>
          </div>

          {loading ? (
            <div className="product-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 340 }} />
              ))}
            </div>
          ) : loadError ? (
            <p className="text-muted mt-16">{loadError}</p>
          ) : products.length === 0 ? (
            <p className="text-muted mt-16">Aucun produit pour le moment.</p>
          ) : (
            <div className="product-grid">
              {products.map((p, i) => (
                <div key={p.id} className={`reveal reveal-delay-${Math.min(i, 3)}`}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          )}

          <div className="text-center reveal" style={{ marginTop: 48 }}>
            <Link to="/boutique" className="btn btn-primary" style={{ padding: '17px 44px' }}>
              Voir toute la boutique
            </Link>
          </div>
        </div>
      </section>

      {/* ── AMBIANCE STRIP (bandeau toujours sombre, teinté par le thème) — "Notre histoire" éditable ── */}
      <section className="ambiance-section">
        <div className="ambiance-grain" />
        <div className="container ambiance-content">
          <div className="reveal">
            <div className="section-label section-label-light">Depuis toujours</div>
            <h2 className="ambiance-title">{config?.about_title || 'Notre histoire'}</h2>
            <p className="ambiance-text">
              {config?.about_text ||
                "Installée au cœur du Mans, notre boucherie vous accueille chaque jour avec des produits frais, une découpe soignée et le sourire."}
            </p>
            <a href={`tel:${phoneClean}`} className="btn btn-outline" style={{ marginTop: 28 }}>
              Nous appeler
            </a>
          </div>
        </div>
      </section>

      {/* ── SPECIALTIES ── */}
      <section className="specialties-section">
        <div className="container">
          <div className="reveal section-head">
            <div className="section-label">Nos spécialités</div>
            <h2 className="section-title">Épicerie & rôtisserie orientale</h2>
          </div>
          <div className="specialties-grid">
            {[
              { n: '01', label: 'Bœuf', desc: 'Côtes, steaks, mincés…' },
              { n: '02', label: 'Agneau', desc: 'Gigot, côtelettes, épaule…' },
              { n: '03', label: 'Volaille', desc: 'Poulet entier, cuisses, ailes…' },
              { n: '04', label: 'Merguez', desc: 'Fraîches, maison, épicées…' },
              { n: '05', label: 'Épicerie', desc: 'Produits orientaux sélectionnés' },
              { n: '06', label: 'Rôtisserie', desc: 'Poulets rôtis, brochettes…' },
            ].map((s, i) => (
              <div key={i} className={`specialty-item reveal reveal-delay-${i % 3}`}>
                <span className="specialty-num">{s.n}</span>
                <span className="specialty-label">{s.label}</span>
                <span className="specialty-desc">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .home-page { overflow-x: clip; }

        .hero {
          position: relative;
          background: var(--color-ink-fixed);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          color: var(--color-on-ink-fixed);
          padding: 28px 0 32px;
        }
        .hero-grain {
          position: absolute;
          inset: 0;
          opacity: 0.5;
          mix-blend-mode: overlay;
          pointer-events: none;
          background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04) 0%, transparent 45%),
                             radial-gradient(circle at 80% 70%, rgba(255,255,255,0.05) 0%, transparent 50%);
        }
        .hero-bg-layer {
          position: absolute;
          inset: -10% 0 -10% 0;
          z-index: 0;
          opacity: 0.22;
          will-change: transform;
        }
        .hero-bg-img { width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) contrast(1.1); }
        /* Masque le bouton "lecture" natif (Safari/Chrome mobile) qui peut
           apparaître brièvement avant que l'autoplay ne démarre. */
        video.hero-bg-img::-webkit-media-controls,
        video.hero-bg-img::-webkit-media-controls-start-playback-button,
        video.hero-bg-img::-webkit-media-controls-play-button {
          display: none !important;
          -webkit-appearance: none;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        .hero-topline, .hero-bottomline {
          position: relative;
          z-index: 2;
          display: flex;
          justify-content: space-between;
          padding: 0 20px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--color-on-ink-fixed-dim-2);
        }
        .hero-eyebrow-right { text-align: right; }

        .hero-center {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 22px;
          padding: 40px 20px;
        }

        .hero-stamp {
          position: absolute;
          top: -6px;
          right: 6px;
          width: 84px;
          height: 84px;
          color: var(--color-on-ink-fixed-dim);
          animation: stampSpin 38s linear infinite;
          display: none;
        }
        .stamp-svg { width: 100%; height: 100%; }
        .stamp-text-top, .stamp-text-bottom {
          font-family: var(--font-mono);
          font-size: 7.4px;
          letter-spacing: 1.4px;
          fill: currentColor;
        }
        @keyframes stampSpin { to { transform: rotate(360deg); } }

        .hero-title {
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .hero-title-line {
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: clamp(54px, 16vw, 150px);
          line-height: 0.86;
          letter-spacing: -1px;
          color: var(--color-on-ink-fixed);
          transform: translate(calc(var(--mx, 0) * -6px), calc(var(--my, 0) * -4px));
          transition: transform 0.2s ease-out;
        }
        .hero-title-accent { color: var(--color-red); }
        .hero-title-rule {
          width: 64px;
          height: 1px;
          background: var(--color-on-ink-fixed-dim-2);
          opacity: 0.8;
        }
        .hero-title-sub {
          font-family: var(--font-display);
          font-style: italic;
          font-weight: 500;
          font-size: clamp(17px, 3vw, 23px);
          color: var(--color-on-ink-fixed);
          opacity: 0.85;
        }
        .hero-subtitle {
          font-size: 15px;
          color: var(--color-on-ink-fixed-dim);
          max-width: 440px;
          margin: 0;
          line-height: 1.7;
        }
        .hero-actions {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
          margin-top: 6px;
        }
        .hero-btn-main { border-color: var(--color-on-ink-fixed); background: var(--color-on-ink-fixed); color: var(--color-ink-fixed); }
        .hero-btn-main:hover { background: transparent; color: var(--color-on-ink-fixed); }
        .hero-call {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-family: var(--font-mono);
          font-size: 13px;
          letter-spacing: 0.5px;
          color: var(--color-on-ink-fixed-dim);
          opacity: 0.95;
          transition: color 0.2s;
        }
        .hero-call:hover { color: var(--color-on-ink-fixed); }
        .hero-call-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-red); flex-shrink: 0; }

        .hero-bottomline { align-items: center; }
        .hero-badges-row { display: none; gap: 22px; }
        .hero-scroll-hint {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
        }
        .hero-scroll-track {
          width: 1px;
          height: 30px;
          background: var(--color-on-ink-fixed-dim-2);
          position: relative;
          overflow: hidden;
        }
        .hero-scroll-dot {
          position: absolute;
          left: -1px;
          top: 0;
          width: 3px;
          height: 10px;
          margin-left: -1px;
          background: var(--color-paper);
          animation: scrollDot 1.8s ease-in-out infinite;
        }
        @keyframes scrollDot {
          0% { transform: translateY(-10px); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(30px); opacity: 0; }
        }

        .info-strip {
          background: var(--color-paper);
          border-bottom: 1px solid var(--color-border);
        }
        .info-strip-inner {
          display: grid;
          grid-template-columns: 1fr;
        }
        .info-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 26px 0;
          border-bottom: 1px solid var(--color-border);
        }
        .info-item:last-child { border-bottom: none; }
        .info-index {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-red);
          padding-top: 3px;
          flex-shrink: 0;
        }
        .info-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-text-muted); margin-bottom: 4px; }
        .info-value { font-size: 15px; font-weight: 600; }

        .section-head { margin-bottom: 44px; }
        .section-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 4.6vw, 46px);
          font-weight: 600;
          margin: 0;
          color: var(--color-text);
          line-height: 1.12;
          letter-spacing: -0.5px;
        }

        .pillars-section { padding: 90px 0; background: var(--color-paper); }
        .pillars-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
          border-top: 1px solid var(--color-border);
        }
        .pillar-card {
          padding: 30px 4px;
          border-bottom: 1px solid var(--color-border);
          transition: padding-left 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .pillar-card:hover { padding-left: 16px; }
        .pillar-num {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-red);
          display: block;
          margin-bottom: 10px;
        }
        .pillar-title {
          font-family: var(--font-heading);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.2px;
          margin: 0 0 8px;
          color: var(--color-text);
        }
        .pillar-desc { font-size: 14px; color: var(--color-text-muted); margin: 0; line-height: 1.65; max-width: 480px; }

        .products-section { padding: 90px 0; background: var(--color-paper-dim); }
        .products-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 44px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .products-header .section-head { margin-bottom: 0; }
        .see-all-btn { font-size: 12px; padding: 12px 20px; }
        .product-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1px;
          background: var(--color-border);
        }

        .ambiance-section {
          position: relative;
          background: var(--color-ink-fixed);
          padding: 100px 0;
          overflow: hidden;
        }
        .ambiance-grain {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 70% 20%, rgba(255,255,255,0.04), transparent 50%);
        }
        .ambiance-content { position: relative; z-index: 1; color: var(--color-on-ink-fixed); max-width: 640px; }
        .section-label-light { color: var(--color-on-ink-fixed-dim-2); }
        .section-label-light::before { background: var(--color-red); }
        .ambiance-title {
          font-family: var(--font-display);
          font-size: clamp(30px, 5.2vw, 48px);
          font-weight: 600;
          margin: 0 0 20px;
          line-height: 1.15;
          letter-spacing: -0.5px;
        }
        .ambiance-text { font-size: 16px; color: var(--color-on-ink-fixed-dim); opacity: 0.9; line-height: 1.8; margin: 0; }

        .specialties-section { padding: 90px 0 110px; background: var(--color-paper); }
        .specialties-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1px;
          background: var(--color-border);
          margin-top: 8px;
        }
        .specialty-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 30px 22px;
          background: var(--color-paper);
          transition: background 0.3s ease;
        }
        .specialty-item:hover { background: var(--color-ink); color: var(--color-paper); }
        .specialty-item:hover .specialty-desc { color: rgba(250,249,246,0.55); }
        .specialty-item:hover .specialty-num { color: var(--color-red); }
        .specialty-num { font-family: var(--font-mono); font-size: 11px; color: var(--color-red); }
        .specialty-label { font-family: var(--font-heading); font-size: 17px; font-weight: 700; }
        .specialty-desc { font-size: 12.5px; color: var(--color-text-muted); }

        @media (min-width: 640px) {
          .hero-actions { flex-direction: row; gap: 28px; }
          .hero-badges-row { display: flex; }
          .pillars-grid { grid-template-columns: repeat(2, 1fr); }
          .pillar-card { border-right: 1px solid var(--color-border); padding: 36px 28px; }
          .pillar-card:hover { padding-left: 40px; }
        }
        @media (min-width: 768px) {
          .product-grid { grid-template-columns: repeat(3, 1fr); }
          .hero-stamp { display: block; }
          .info-strip-inner { grid-template-columns: repeat(3, 1fr); }
          .info-item { flex-direction: column; gap: 10px; padding: 32px 28px; border-bottom: none; border-right: 1px solid var(--color-border); }
          .info-item:last-child { border-right: none; }
          .specialties-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1024px) {
          .pillars-grid { grid-template-columns: repeat(4, 1fr); }
          .pillar-card { padding: 40px 26px; }
        }
      `}</style>
    </div>
  )
}
