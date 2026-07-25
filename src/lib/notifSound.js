// Son de notification partagé entre AdminOrders (onglet Commandes) et
// useOrderAlerts (écoute active en permanence dans tout l'admin), avec un
// anti-doublon pour éviter deux sonneries simultanées si les deux se
// déclenchent en même temps.

export const SOUND_ENABLED_KEY  = 'admin_notif_sound_enabled'
export const SOUND_DURATION_KEY = 'admin_notif_sound_duration'
export const DEFAULT_DURATION   = 10

let lastPlayedAt = 0

export function getStoredSoundEnabled() {
  const v = localStorage.getItem(SOUND_ENABLED_KEY)
  return v === null ? true : v === '1'
}

export function getStoredDuration() {
  const v = parseInt(localStorage.getItem(SOUND_DURATION_KEY), 10)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_DURATION
}

export function playNotificationSound(durationSeconds = DEFAULT_DURATION) {
  const now = Date.now()
  if (now - lastPlayedAt < 3000) return // anti-doublon (3s)
  lastPlayedAt = now

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const totalMs = Math.max(1, durationSeconds) * 1000
    const beepIntervalMs = 850
    let elapsed = 0

    function chime(startTime) {
      const notes = [1046.5, 783.99]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        const t0 = startTime + i * 0.18
        osc.frequency.setValueAtTime(freq, t0)
        gain.gain.setValueAtTime(0, t0)
        gain.gain.linearRampToValueAtTime(0.5, t0 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t0)
        osc.stop(t0 + 0.55)
      })
    }

    const timer = setInterval(() => {
      if (elapsed >= totalMs) {
        clearInterval(timer)
        setTimeout(() => ctx.close().catch(() => {}), 1000)
        return
      }
      chime(ctx.currentTime)
      elapsed += beepIntervalMs
    }, beepIntervalMs)
    chime(ctx.currentTime)
  } catch { /* navigateurs qui bloquent l'audio */ }
}
