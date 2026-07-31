import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import './IntroExperience.css'

const SESSION_KEY = 'intro_seen_v1'

/**
 * Scène d'ouverture cinématique : deux couteaux glissent l'un vers l'autre,
 * impact (flash + étincelles), puis fondu vers le logo/titre.
 *
 * Note technique : chaque <svg> couteau n'est JAMAIS stylé avec un
 * `transform` en CSS — GSAP est seul propriétaire du transform de ces
 * éléments (x / rotate). Le positionnement (centrage, symétrie) est géré
 * par la mise en page flex du parent + un second tracé de lame déjà
 * "miroir" pour le couteau droit (au lieu d'un scaleX CSS sur le même
 * nœud que GSAP anime, qui écrasait tout — c'était le bug initial).
 */
export default function IntroExperience({ siteTitle, tagline, logoUrl, onDone }) {
  const rootRef = useRef(null)
  const knifeLeftRef = useRef(null)
  const knifeRightRef = useRef(null)
  const knivesRowRef = useRef(null)
  const flashRef = useRef(null)
  const sparksRef = useRef(null)
  const revealRef = useRef(null)
  const [canSkip, setCanSkip] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(SESSION_KEY)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (alreadySeen || reduced) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onDone?.()
      return
    }

    const ctx = gsap.context(() => {
      const sparkEls = sparksRef.current?.querySelectorAll('.spark') || []

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      tl.set(rootRef.current, { autoAlpha: 1 })

      // 1. Arrivée lente, tension avant impact
      tl.fromTo(knifeLeftRef.current,
        { x: '-55vw', rotate: -10, opacity: 0 },
        { x: 0, rotate: 0, opacity: 1, duration: 1.5, ease: 'power2.inOut' }, 0.15)
      tl.fromTo(knifeRightRef.current,
        { x: '55vw', rotate: 10, opacity: 0 },
        { x: 0, rotate: 0, opacity: 1, duration: 1.5, ease: 'power2.inOut' }, 0.15)

      // Micro-suspension avant le contact
      tl.to({}, { duration: 0.15 }, 1.65)

      // 2. Impact : flash, étincelles, vibration
      tl.to(flashRef.current, { opacity: 1, duration: 0.045 }, 1.8)
      tl.to(flashRef.current, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 1.845)
      tl.to([knifeLeftRef.current, knifeRightRef.current], {
        keyframes: [
          { x: '+=5', rotate: '+=1.2', duration: 0.035 },
          { x: '-=9', rotate: '-=2', duration: 0.045 },
          { x: '+=4', rotate: '+=0.8', duration: 0.045 },
          { x: '+=0', rotate: '+=0', duration: 0.07 },
        ],
        ease: 'none',
      }, 1.8)

      sparkEls.forEach((s, i) => {
        const angle = (Math.PI * 2 * i) / sparkEls.length + (Math.random() - 0.5) * 0.5
        const dist = 36 + Math.random() * 80
        tl.fromTo(s,
          { opacity: 1, x: 0, y: 0, scale: 1 },
          {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            opacity: 0,
            scale: 0.2,
            duration: 0.5 + Math.random() * 0.3,
            ease: 'power2.out',
          }, 1.8)
      })

      // 3. Les couteaux s'effacent, la marque se révèle à leur place
      tl.to(knivesRowRef.current, { opacity: 0, duration: 0.6, ease: 'power2.out' }, 2.15)
      tl.fromTo(revealRef.current,
        { opacity: 0, y: 14, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power2.out' }, 2.35)

      tl.call(() => setCanSkip(true), null, 2.55)
    }, rootRef)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleEnter() {
    if (finishing) return
    setFinishing(true)
    sessionStorage.setItem(SESSION_KEY, '1')

    const tl = gsap.timeline({ onComplete: () => onDone?.() })

    // La marque s'efface, les couteaux redeviennent visibles à leur
    // position fermée (centre), puis se rouvrent en s'écartant — comme
    // au ralenti inverse de l'entrée — pendant que le fond s'efface pour
    // révéler le site en dessous.
    tl.to(revealRef.current, { opacity: 0, y: -10, duration: 0.35, ease: 'power2.in' })
    tl.set(knivesRowRef.current, { opacity: 1 })
    tl.to(knifeLeftRef.current, { x: '-75vw', rotate: -14, duration: 0.85, ease: 'power2.in' }, '<0.05')
    tl.to(knifeRightRef.current, { x: '75vw', rotate: 14, duration: 0.85, ease: 'power2.in' }, '<')
    tl.to(rootRef.current, { opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.45')
  }

  return (
    <div className="intro-experience" ref={rootRef}>
      <div className="intro-stage">
        <div className="intro-knives-row" ref={knivesRowRef}>
          <svg className="intro-knife" ref={knifeLeftRef} viewBox="0 0 400 120" aria-hidden="true">
            <defs>
              <linearGradient id="bladeGradL" x1="0" y1="0" x2="0.3" y2="1">
                <stop offset="0%" stopColor="#eef0f2" />
                <stop offset="38%" stopColor="#c7cad0" />
                <stop offset="55%" stopColor="#8d9096" />
                <stop offset="72%" stopColor="#c7cad0" />
                <stop offset="100%" stopColor="#f4f5f6" />
              </linearGradient>
              <linearGradient id="handleGradL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3c2e22" />
                <stop offset="50%" stopColor="#241a13" />
                <stop offset="100%" stopColor="#120c08" />
              </linearGradient>
              <linearGradient id="bolsterGradL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4a4c50" />
                <stop offset="100%" stopColor="#1c1d1f" />
              </linearGradient>
            </defs>
            {/* poignée */}
            <rect x="0" y="40" width="95" height="40" rx="8" fill="url(#handleGradL)" />
            <rect x="0" y="40" width="9" height="40" rx="4" fill="#000" opacity="0.35" />
            <path d="M8,44 L88,44" stroke="#5a4636" strokeWidth="1.5" opacity="0.55" />
            <circle cx="30" cy="60" r="3" fill="#7a6f63" />
            <circle cx="30" cy="60" r="1.1" fill="#c9beac" />
            <circle cx="66" cy="60" r="3" fill="#7a6f63" />
            <circle cx="66" cy="60" r="1.1" fill="#c9beac" />
            {/* mitre */}
            <path d="M90,38 L120,29 L120,91 L90,82 Z" fill="url(#bolsterGradL)" />
            {/* lame */}
            <path d="M120,30 C220,24 330,28 380,42 Q398,50 400,60 Q392,68 360,78 C300,96 200,98 120,90 Z" fill="url(#bladeGradL)" stroke="#6b6e73" strokeWidth="0.5" />
            <path d="M132,86 C210,94 300,92 355,76" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M128,33 C210,28 310,30 372,42" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
          </svg>

          <svg className="intro-knife" ref={knifeRightRef} viewBox="0 0 400 120" aria-hidden="true">
            <defs>
              <linearGradient id="bladeGradR" x1="1" y1="0" x2="0.7" y2="1">
                <stop offset="0%" stopColor="#eef0f2" />
                <stop offset="38%" stopColor="#c7cad0" />
                <stop offset="55%" stopColor="#8d9096" />
                <stop offset="72%" stopColor="#c7cad0" />
                <stop offset="100%" stopColor="#f4f5f6" />
              </linearGradient>
              <linearGradient id="handleGradR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3c2e22" />
                <stop offset="50%" stopColor="#241a13" />
                <stop offset="100%" stopColor="#120c08" />
              </linearGradient>
              <linearGradient id="bolsterGradR" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="#4a4c50" />
                <stop offset="100%" stopColor="#1c1d1f" />
              </linearGradient>
            </defs>
            {/* lame (miroir : pointe à gauche) */}
            <path d="M280,30 C180,24 70,28 20,42 Q2,50 0,60 Q8,68 40,78 C100,96 200,98 280,90 Z" fill="url(#bladeGradR)" stroke="#6b6e73" strokeWidth="0.5" />
            <path d="M268,86 C190,94 100,92 45,76" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M272,33 C190,28 90,30 28,42" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
            {/* mitre */}
            <path d="M310,38 L280,29 L280,91 L310,82 Z" fill="url(#bolsterGradR)" />
            {/* poignée */}
            <rect x="305" y="40" width="95" height="40" rx="8" fill="url(#handleGradR)" />
            <rect x="391" y="40" width="9" height="40" rx="4" fill="#000" opacity="0.35" />
            <path d="M312,44 L392,44" stroke="#5a4636" strokeWidth="1.5" opacity="0.55" />
            <circle cx="370" cy="60" r="3" fill="#7a6f63" />
            <circle cx="370" cy="60" r="1.1" fill="#c9beac" />
            <circle cx="334" cy="60" r="3" fill="#7a6f63" />
            <circle cx="334" cy="60" r="1.1" fill="#c9beac" />
          </svg>
        </div>

        <div className="intro-sparks" ref={sparksRef} aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="spark" />
          ))}
        </div>

        <div className="intro-flash" ref={flashRef} aria-hidden="true" />

        <div className="intro-reveal" ref={revealRef}>
          {logoUrl && !logoFailed && (
            <img
              src={logoUrl}
              alt=""
              className="intro-logo"
              onError={() => setLogoFailed(true)}
            />
          )}
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
    </div>
  )
}
