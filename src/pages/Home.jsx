import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { fetchAvailableProducts } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard'

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
      poster={poster || undefined}
    />
  )
}

export default function Home({ config }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  useReveal([loading, products.length])
  const heroRef = useParallaxHero()
  const tiltRef = useMouseTilt()

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

import { useEffect, useRef, useState } from 'react'
import { fetchSiteConfig, fetchStripeSecrets, updateSiteConfig, uploadSiteImage, uploadSiteVideo } from '../../lib/api'

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
  const bannerVideoRef = useRef()
  const logoRef = useRef()
  const faviconRef = useRef()

  useEffect(() => {
    fetchSiteConfig()
      .then((data) => {
        setConfig(data)
        // Les clés Stripe sensibles ne sont plus incluses dans fetchSiteConfig
        // (lecture publique bloquée en base) : on les récupère à part, via une
        // fonction réservée à l'admin, et on les fusionne dans le formulaire.
        fetchStripeSecrets()
          .then((secrets) => setConfig((c) => ({ ...c, ...secrets })))
          .catch(console.error)
      })
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

  async function handleBannerVideoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      setError('Vidéo trop lourde (100 Mo max). Compresse-la avant de l\'envoyer.')
      return
    }
    setUploading(true)
    try {
      const url = await uploadSiteVideo(file)
      setConfig((c) => ({ ...c, banner_video: url }))
    } catch {
      setError('Erreur upload vidéo bannière.')
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
        banner_video: config.banner_video,
        logo_url: config.logo_url,
        about_title: config.about_title,
        about_text: config.about_text,
        theme_color: config.theme_color,
        whatsapp_number: config.whatsapp_number,
        order_mode: config.order_mode,
        delivery_enabled: config.delivery_enabled ?? false,
        stripe_enabled:         config.stripe_enabled ?? false,
        auto_status_mode:       config.auto_status_mode ?? false,
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
          <h4>Vidéo bannière (optionnel)</h4>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
            Si une vidéo est ajoutée, elle remplace l'image bannière en fond de page d'accueil (lecture automatique, en boucle, sans son). Format MP4 recommandé, 100 Mo max.
          </p>
          {config.banner_video && (
            <video src={config.banner_video} className="banner-preview" autoPlay loop muted playsInline />
          )}
          <input ref={bannerVideoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleBannerVideoUpload} />
          <button className="btn btn-ghost btn-sm" onClick={() => bannerVideoRef.current.click()} disabled={uploading}>
            {uploading ? 'Upload…' : config.banner_video ? 'Remplacer la vidéo' : 'Choisir une vidéo'}
          </button>
          {config.banner_video && (
            <button className="btn btn-danger btn-sm banner-delete-btn" onClick={() => setConfig((c) => ({ ...c, banner_video: '' }))}>
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
          <h4>Confirmation des commandes</h4>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 14 }}>
            En mode automatique, une commande payée en ligne passe directement au statut "Confirmée"
            sans que tu aies besoin de le faire toi-même. En mode manuel, tu confirmes chaque commande à la main.
          </p>
          <div className="delivery-toggle-row">
            <div>
              <p className="delivery-toggle-title">Mode automatique</p>
              <p className="delivery-toggle-desc">
                Commandes payées en ligne confirmées automatiquement, sans action de ta part.
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                name="auto_status_mode"
                checked={config.auto_status_mode ?? false}
                onChange={handleChange}
              />
              <span className="toggle-slider" />
            </label>
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
