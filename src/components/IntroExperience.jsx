import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import './IntroExperience.css'

const SESSION_KEY = 'intro_seen_v1'

/**
 * Scène d'ouverture cinématique : deux couteaux se rencontrent, étincelles,
 * flash, puis révélation du logo/bannière. Ne joue qu'une fois par session
 * (sessionStorage) et est ignorée si l'utilisateur préfère un mouvement réduit.
 *
 * Props:
 *  - siteTitle, tagline, logoUrl : contenu à révéler après l'impact
 *  - onDone(): appelé quand la scène est terminée (transition + skip inclus)
 */
export default function IntroExperience({ siteTitle, tagline, logoUrl, onDone }) {
  const rootRef = useRef(null)
  const knifeLeftRef = useRef(null)
  const knifeRightRef = useRef(null)
  const flashRef = useRef(null)
  const sparksRef = useRef(null)
  const revealRef = useRef(null)
  const wipeRef = useRef(null)
  const [canSkip, setCanSkip] = useState(false)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(SESSION_KEY)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (alreadySeen || reduced) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onDone?.()
      return
    }

    const ctx = gsap.context(() => {
      // Génère les particules d'étincelles une fois (positions aléatoires figées)
      const sparkEls = sparksRef.current?.querySelectorAll('.spark') || []

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => setCanSkip(false),
      })

      // 1. Arrivée lente des couteaux, tension avant impact
      tl.set(rootRef.current, { autoAlpha: 1 })
      tl.fromTo(knifeLeftRef.current,
        { x: '-60vw', opacity: 0, rotate: -8 },
        { x: 0, opacity: 1, rotate: 0, duration: 1.6, ease: 'power2.inOut' }, 0.2)
      tl.fromTo(knifeRightRef.current,
        { x: '60vw', opacity: 0, rotate: 8 },
        { x: 0, opacity: 1, rotate: 0, duration: 1.6, ease: 'power2.inOut' }, 0.2)

      // Micro-pause de tension juste avant le contact
      tl.to([knifeLeftRef.current, knifeRightRef.current], { duration: 0.18 }, 1.75)

      // 2. Impact : flash, étincelles, vibration, ralenti
      tl.to(rootRef.current, { duration: 0.06 }, 1.9) // beat
      tl.to(flashRef.current, { opacity: 1, duration: 0.05 }, 1.92)
      tl.to(flashRef.current, { opacity: 0, duration: 0.5, ease: 'power2.out' }, 1.97)
      tl.to([knifeLeftRef.current, knifeRightRef.current], {
        keyframes: [
          { x: '+=6', rotate: '+=1.5', duration: 0.04 },
          { x: '-=10', rotate: '-=2.5', duration: 0.05 },
          { x: '+=5', rotate: '+=1', duration: 0.05 },
          { x: '0', rotate: '0', duration: 0.08 },
        ],
        ease: 'none',
      }, 1.92)

      sparkEls.forEach((s, i) => {
        const angle = (Math.PI * 2 * i) / sparkEls.length + (Math.random() - 0.5) * 0.6
        const dist = 40 + Math.random() * 90
        tl.fromTo(s,
          { opacity: 1, x: 0, y: 0, scale: 1 },
          {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            opacity: 0,
            scale: 0.2,
            duration: 0.55 + Math.random() * 0.35,
            ease: 'power2.out',
          }, 1.92)
      })

      // 3. Révélation logo / marque / bannière
      tl.fromTo(revealRef.current,
        { opacity: 0, y: 16, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'power2.out' }, 2.5)

      tl.call(() => setCanSkip(true), null, 2.7)
    }, rootRef)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleEnter() {
    if (finishing) return
    setFinishing(true)
    sessionStorage.setItem(SESSION_KEY, '1')

    const tl = gsap.timeline({ onComplete: () => onDone?.() })
    // Transition "lame" : un trait métallique traverse l'écran puis
    // les deux volets s'ouvrent horizontalement pour révéler le site.
    tl.set(wipeRef.current, { autoAlpha: 1 })
    tl.fromTo(wipeRef.current.querySelector('.wipe-blade'),
      { xPercent: -100 }, { xPercent: 100, duration: 0.5, ease: 'power4.in' })
    tl.to(rootRef.current, { opacity: 0, duration: 0.25 }, '-=0.15')
    tl.to([wipeRef.current.querySelector('.wipe-left'), wipeRef.current.querySelector('.wipe-right')], {
      xPercent: (i) => (i === 0 ? -100 : 100),
      duration: 0.7,
      ease: 'power3.inOut',
    }, '-=0.1')
  }

  return (
    <div className="intro-experience" ref={rootRef}>
      <div className="intro-stage">
        <svg className="intro-knife intro-knife--left" ref={knifeLeftRef} viewBox="0 0 320 90" aria-hidden="true">
          <defs>
            <linearGradient id="bladeGradL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f4f4f2" />
              <stop offset="45%" stopColor="#c9cbcf" />
              <stop offset="55%" stopColor="#8b8d92" />
              <stop offset="100%" stopColor="#e8e9ea" />
            </linearGradient>
            <linearGradient id="handleGradL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2422" />
              <stop offset="100%" stopColor="#0c0a09" />
            </linearGradient>
          </defs>
          <path d="M0,38 L210,30 C240,29 260,34 285,42 C260,50 240,55 210,54 L0,52 Z" fill="url(#bladeGradL)" stroke="#5a5c60" strokeWidth="0.6" />
          <path d="M0,38 L210,30 L215,32 L8,42 Z" fill="#ffffff" opacity="0.55" />
          <rect x="-58" y="30" width="60" height="26" rx="6" fill="url(#handleGradL)" />
          <rect x="-58" y="30" width="60" height="4" rx="2" fill="#3a332f" opacity="0.6" />
          <circle cx="-14" cy="43" r="2.4" fill="#6b6560" />
          <circle cx="-34" cy="43" r="2.4" fill="#6b6560" />
        </svg>

        <svg className="intro-knife intro-knife--right" ref={knifeRightRef} viewBox="0 0 320 90" aria-hidden="true">
          <defs>
            <linearGradient id="bladeGradR" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4f4f2" />
              <stop offset="45%" stopColor="#c9cbcf" />
              <stop offset="55%" stopColor="#8b8d92" />
              <stop offset="100%" stopColor="#e8e9ea" />
            </linearGradient>
            <linearGradient id="handleGradR" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2422" />
              <stop offset="100%" stopColor="#0c0a09" />
            </linearGradient>
          </defs>
          <path d="M320,38 L110,30 C80,29 60,34 35,42 C60,50 80,55 110,54 L320,52 Z" fill="url(#bladeGradR)" stroke="#5a5c60" strokeWidth="0.6" />
          <path d="M320,38 L110,30 L105,32 L312,42 Z" fill="#ffffff" opacity="0.55" />
          <rect x="318" y="30" width="60" height="26" rx="6" fill="url(#handleGradR)" />
          <rect x="318" y="30" width="60" height="4" rx="2" fill="#3a332f" opacity="0.6" />
          <circle cx="332" cy="43" r="2.4" fill="#6b6560" />
          <circle cx="352" cy="43" r="2.4" fill="#6b6560" />
        </svg>

        <div className="intro-sparks" ref={sparksRef} aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="spark" />
          ))}
        </div>

        <div className="intro-flash" ref={flashRef} aria-hidden="true" />

        <div className="intro-reveal" ref={revealRef}>
          {logoUrl && <img src={logoUrl} alt="" className="intro-logo" />}
          <h1 className="intro-title">{siteTitle || 'Maison'}</h1>
          {tagline && <p className="intro-tagline">{tagline}</p>}
          {canSkip && (
            <button type="button" className="intro-enter" onClick={handleEnter}>
              Entrer
            </button>
          )}
        </div>
      </div>

      {!finishing && (
        <button type="button" className="intro-skip" onClick={handleEnter} aria-label="Passer l'introduction">
          Passer
        </button>
      )}

      <div className="intro-wipe" ref={wipeRef} aria-hidden="true">
        <div className="wipe-left" />
        <div className="wipe-right" />
        <div className="wipe-blade" />
      </div>
    </div>
  )
}
