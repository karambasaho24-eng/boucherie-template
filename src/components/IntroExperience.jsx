import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import './IntroExperience.css'
import knifeLeftImg from '../assets/intro/couperet-left.png'
import knifeRightImg from '../assets/intro/couperet-right.png'
import meatBigImg from '../assets/intro/viande-piece.png'
import meatSliceImg from '../assets/intro/viande-tranche.png'

const SESSION_KEY = 'intro_seen_v2'
// Place un fichier audio ici (mp3/ogg, ambiance forge/atelier, courte boucle)
// pour activer le son. Tant qu'il est absent, l'icône son reste masquée.
const AMBIENT_SOUND_SRC = '/sounds/forge-ambient.mp3'

/**
 * Scène d'ouverture cinématique : deux couperets entrent en angle, frappent
 * un morceau de viande posé au centre, le tranchent net. La moitié basse
 * tombe (accélération façon gravité + rotation), et pendant sa chute le
 * site apparaît derrière — sans action requise. "Passer" permet de tout
 * ignorer à tout moment.
 *
 * Note technique : aucun élément animé par GSAP (couteaux, viande, root)
 * n'a de `transform` déclaré en CSS — GSAP en reste seul propriétaire.
 * Le positionnement/symétrie passe par la mise en page flex + deux fichiers
 * image déjà "miroir" en pixels pour les couteaux.
 */
export default function IntroExperience({ onDone }) {
  const rootRef = useRef(null)
  const knifeLeftRef = useRef(null)
  const knifeRightRef = useRef(null)
  const flashRef = useRef(null)
  const sparksRef = useRef(null)
  const meatBigRef = useRef(null)
  const meatSliceRef = useRef(null)
  const meatShadowRef = useRef(null)
  const fogRefs = useRef([])
  const audioRef = useRef(null)
  const timelineRef = useRef(null)
  const [finishing, setFinishing] = useState(false)
  const [soundAvailable, setSoundAvailable] = useState(false)
  const [soundOn, setSoundOn] = useState(false)

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(SESSION_KEY)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (alreadySeen || reduced) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onDone?.()
      return
    }

    // Tente de démarrer le son en muet (autorisé sans interaction).
    // Si le fichier est absent/erreur, l'icône ne s'affiche jamais.
    const audio = audioRef.current
    if (audio) {
      audio.volume = 0.35
      audio.play().then(() => setSoundAvailable(true)).catch(() => setSoundAvailable(false))
    }

    const ctx = gsap.context(() => {
      const sparkEls = sparksRef.current?.querySelectorAll('.spark') || []
      const fogEls = fogRefs.current.filter(Boolean)

      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        onComplete: finishAndReveal,
      })
      timelineRef.current = tl

      tl.set(rootRef.current, { autoAlpha: 1 })

      // 0. Brume qui s'installe, viande posée au centre
      fogEls.forEach((el, i) => {
        tl.fromTo(el,
          { opacity: 0, x: i % 2 === 0 ? -40 : 40 },
          { opacity: 0.5, x: 0, duration: 1.8, ease: 'sine.out' }, 0)
      })
      tl.fromTo(meatBigRef.current,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.25)

      // 1. Frappe puissante — angle marqué, accélération franche
      tl.fromTo(knifeLeftRef.current,
        { x: '-58vw', y: '-6vh', rotate: -32, opacity: 0 },
        { x: 0, y: 0, rotate: -4, opacity: 1, duration: 0.95, ease: 'power4.in' }, 0.9)
      tl.fromTo(knifeRightRef.current,
        { x: '58vw', y: '-6vh', rotate: 32, opacity: 0 },
        { x: 0, y: 0, rotate: 4, opacity: 1, duration: 0.95, ease: 'power4.in' }, 0.9)

      // 2. Impact : flash, étincelles, secousse écran, découpe nette
      const impactT = 1.85
      tl.to(flashRef.current, { opacity: 1, duration: 0.04 }, impactT)
      tl.to(flashRef.current, { opacity: 0, duration: 0.4, ease: 'power2.out' }, impactT + 0.04)
      tl.to(rootRef.current, {
        keyframes: [
          { x: -4, y: 2, duration: 0.03 },
          { x: 5, y: -3, duration: 0.04 },
          { x: -3, y: 1, duration: 0.04 },
          { x: 0, y: 0, duration: 0.06 },
        ],
        ease: 'none',
      }, impactT)
      tl.to([knifeLeftRef.current, knifeRightRef.current], {
        keyframes: [
          { x: '+=4', rotate: '+=1', duration: 0.03 },
          { x: '-=6', rotate: '-=1.5', duration: 0.04 },
          { x: '+=0', rotate: '+=0', duration: 0.06 },
        ],
        ease: 'none',
      }, impactT)

      sparkEls.forEach((s, i) => {
        const angle = (Math.PI * 2 * i) / sparkEls.length + (Math.random() - 0.5) * 0.5
        const dist = 40 + Math.random() * 90
        tl.fromTo(s,
          { opacity: 1, x: 0, y: 0, scale: 1 },
          {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            opacity: 0,
            scale: 0.2,
            duration: 0.5 + Math.random() * 0.3,
            ease: 'power2.out',
          }, impactT)
      })

      // 3. La tranche vient d'être découpée : elle apparaît au sommet du
      // bloc puis tombe (accélération façon gravité + rotation). Le gros
      // bloc encaisse un léger choc.
      tl.set(meatSliceRef.current, { xPercent: -50, yPercent: -50, x: 0, y: '-7vh', rotate: 0, opacity: 1 }, impactT)
      tl.to(meatBigRef.current, {
        keyframes: [
          { scale: 1.025, duration: 0.05 },
          { scale: 1, duration: 0.12 },
        ],
        ease: 'power1.out',
      }, impactT)
      tl.to(meatSliceRef.current, {
        y: '82vh',
        x: 20,
        rotate: 24,
        duration: 1.1,
        ease: 'power2.in',
      }, impactT + 0.1)
      tl.to(meatSliceRef.current, { opacity: 0, duration: 0.3 }, impactT + 0.9)
      tl.to(meatShadowRef.current, {
        opacity: 0,
        scaleX: 1.6,
        duration: 0.9,
        ease: 'power1.out',
      }, impactT + 0.12)

      // Les couteaux se retirent légèrement puis s'estompent
      tl.to([knifeLeftRef.current, knifeRightRef.current], {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
      }, impactT + 0.35)
      fogEls.forEach((el) => {
        tl.to(el, { opacity: 0, duration: 0.7, ease: 'power2.out' }, impactT + 0.3)
      })

      // 4. Le fond s'efface pendant la chute — le site apparaît derrière,
      // aucune action requise
      tl.to(rootRef.current, { opacity: 0, duration: 0.7, ease: 'power2.out' }, impactT + 0.55)
    }, rootRef)

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finishAndReveal() {
    if (finishing) return
    setFinishing(true)
    sessionStorage.setItem(SESSION_KEY, '1')
    onDone?.()
  }

  function handleSkip() {
    if (finishing) return
    timelineRef.current?.kill()
    const tl = gsap.timeline({ onComplete: finishAndReveal })
    tl.to(rootRef.current, { opacity: 0, duration: 0.35, ease: 'power2.out' })
  }

  function toggleSound() {
    const audio = audioRef.current
    if (!audio) return
    const next = !soundOn
    audio.muted = !next
    setSoundOn(next)
  }

  return (
    <div className="intro-experience" ref={rootRef}>
      <audio
        ref={audioRef}
        src={AMBIENT_SOUND_SRC}
        muted
        loop
        preload="auto"
        onError={() => setSoundAvailable(false)}
      />

      <div className="intro-stage">
        <div className="intro-fog" aria-hidden="true">
          <span className="fog-blob fog-blob--1" ref={(el) => (fogRefs.current[0] = el)} />
          <span className="fog-blob fog-blob--2" ref={(el) => (fogRefs.current[1] = el)} />
          <span className="fog-blob fog-blob--3" ref={(el) => (fogRefs.current[2] = el)} />
        </div>

        <div className="intro-meat" aria-hidden="true">
          <div className="intro-meat-shadow" ref={meatShadowRef} />
          <img className="meat-big" ref={meatBigRef} src={meatBigImg} alt="" />
          <img className="meat-slice" ref={meatSliceRef} src={meatSliceImg} alt="" />
        </div>

        <div className="intro-knives-row">
          <img className="intro-knife" ref={knifeLeftRef} src={knifeLeftImg} alt="" aria-hidden="true" />
          <img className="intro-knife" ref={knifeRightRef} src={knifeRightImg} alt="" aria-hidden="true" />
        </div>

        <div className="intro-sparks" ref={sparksRef} aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="spark" />
          ))}
        </div>

        <div className="intro-flash" ref={flashRef} aria-hidden="true" />
      </div>

      {soundAvailable && (
        <button
          type="button"
          className="intro-sound-toggle"
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Couper le son' : 'Activer le son'}
        >
          {soundOn ? '♪' : '♪ off'}
        </button>
      )}

      {!finishing && (
        <button type="button" className="intro-skip" onClick={handleSkip} aria-label="Passer l'introduction">
          Passer
        </button>
      )}
    </div>
  )
}
