import { useEffect, useRef, useState } from 'react'
import { fetchOrders, updateOrderStatus, deleteOrder } from '../../lib/api'
import { decrementStockForOrder, restockOrder } from '../../lib/stockApi'

const STATUSES = [
  { value: 'pending',   label: 'En attente',      color: '#8a8a86' },
  { value: 'confirmed', label: 'Confirmée',        color: '#0a0a0a' },
  { value: 'preparing', label: 'En préparation',   color: '#0a0a0a' },
  { value: 'ready',     label: 'Prête',            color: '#2f6b3a' },
  { value: 'paid',      label: 'Payée',            color: '#2f6b3a' },
  { value: 'completed', label: 'Terminée',         color: '#6b6b68' },
  { value: 'refused',   label: 'Refusée',          color: '#b5181f' },
  { value: 'cancelled', label: 'Annulée',          color: '#b5181f' },
]

const PAYMENT_LABELS = {
  unpaid: 'Non payé',
  pending: 'Paiement en attente',
  paid: 'Payé',
  failed: 'Échoué',
}

const REFRESH_INTERVAL_MS = 15000
const SOUND_ENABLED_KEY  = 'admin_notif_sound_enabled'
const SOUND_DURATION_KEY = 'admin_notif_sound_duration'
const DEFAULT_DURATION   = 10

function getStoredSoundEnabled() {
  const v = localStorage.getItem(SOUND_ENABLED_KEY)
  return v === null ? true : v === '1'
}

function getStoredDuration() {
  const v = parseInt(localStorage.getItem(SOUND_DURATION_KEY), 10)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_DURATION
}

function playNotificationSound(durationSeconds = DEFAULT_DURATION) {
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

    let beepCount = 0
    const timer = setInterval(() => {
      if (elapsed >= totalMs) {
        clearInterval(timer)
        setTimeout(() => ctx.close().catch(() => {}), 1000)
        return
      }
      chime(ctx.currentTime)
      elapsed += beepIntervalMs
      beepCount += 1
    }, beepIntervalMs)
    chime(ctx.currentTime)
  } catch { /* navigateurs qui bloquent l'audio */ }
}

function statusLabel(s) { return STATUSES.find((x) => x.value === s)?.label || s }
function statusColor(s)  { return STATUSES.find((x) => x.value === s)?.color || '#aaa' }

function formatDate(d) {
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminOrders() {
  const [orders, setOrders]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [expanded, setExpanded]           = useState(null)
  const [filter, setFilter]               = useState('all')
  const [newOrderAlert, setNewOrderAlert] = useState(false)
  const [newOrderCount, setNewOrderCount] = useState(0)
  const [newOrderIds, setNewOrderIds]     = useState(new Set())
  const [soundEnabled, setSoundEnabled]   = useState(getStoredSoundEnabled)
  const [soundDuration, setSoundDuration] = useState(getStoredDuration)
  const [showSettings, setShowSettings]   = useState(false)
  const knownIdsRef    = useRef(new Set())
  const isFirstLoadRef = useRef(true)
  const soundEnabledRef  = useRef(soundEnabled)
  const soundDurationRef = useRef(soundDuration)

  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])
  useEffect(() => { soundDurationRef.current = soundDuration }, [soundDuration])

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev
      localStorage.setItem(SOUND_ENABLED_KEY, next ? '1' : '0')
      return next
    })
  }

  function changeDuration(val) {
    const v = parseInt(val, 10)
    setSoundDuration(v)
    localStorage.setItem(SOUND_DURATION_KEY, String(v))
  }

  function dismissAlert() {
    setNewOrderAlert(false)
    setNewOrderCount(0)
  }

  function clearNewBadge(id) {
    setNewOrderIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function load() {
    try {
      const data = await fetchOrders()
      if (!isFirstLoadRef.current) {
        const newOnes = data.filter((o) => !knownIdsRef.current.has(o.id))
        if (newOnes.length > 0) {
          if (soundEnabledRef.current) playNotificationSound(soundDurationRef.current)
          setNewOrderAlert(true)
          setNewOrderCount((c) => c + newOnes.length)
          setNewOrderIds((prev) => {
            const next = new Set(prev)
            newOnes.forEach((o) => next.add(o.id))
            return next
          })
        }
      }
      knownIdsRef.current = new Set(data.map((o) => o.id))
      isFirstLoadRef.current = false
      setOrders(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  async function handleStatusChange(order, newStatus) {
    const isRealOnlinePayment = order.payment_status === 'paid' && !!order.stripe_payment_intent

    if (isRealOnlinePayment && newStatus !== 'paid') {
      const proceed = confirm(
        "⚠️ Ce client a payé EN LIGNE par carte (paiement Stripe confirmé).\n\n" +
        "Changer le statut ne remboursera pas automatiquement le client.\n\nContinuer quand même ?"
      )
      if (!proceed) return
    }

    const extraUpdates = {}
    if (newStatus === 'paid') {
      if (!isRealOnlinePayment) {
        extraUpdates.payment_status = 'paid'
        extraUpdates.payment_method = 'cash'
        extraUpdates.paid_at = new Date().toISOString()
      }
    } else {
      if (order.payment_status === 'paid' && !isRealOnlinePayment) {
        extraUpdates.payment_status = 'unpaid'
        extraUpdates.payment_method = null
        extraUpdates.paid_at = null
      }
    }

    try {
      const wasNotYetDecremented = !order.stock_decremented
      const movingPastPending    = order.status === 'pending' && newStatus !== 'pending'
      const movingBackToPending  = order.status !== 'pending' && newStatus === 'pending'
      const isRefusingOrCancelling = newStatus === 'refused' || newStatus === 'cancelled'

      await updateOrderStatus(order.id, newStatus, extraUpdates)

      if (movingPastPending && wasNotYetDecremented) {
        try { await decrementStockForOrder(order.id) } catch (e) { console.warn(e) }
      }
      if (!wasNotYetDecremented && (movingBackToPending || isRefusingOrCancelling)) {
        try { await restockOrder(order.id) } catch (e) { console.warn(e) }
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? {
          ...o, status: newStatus, ...extraUpdates,
          stock_decremented: movingPastPending && wasNotYetDecremented
            ? true
            : (!wasNotYetDecremented && (movingBackToPending || isRefusingOrCancelling) ? false : o.stock_decremented),
        } : o))
      )
    } catch (e) {
      alert('Erreur lors du changement de statut.')
      console.error(e)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer définitivement cette commande ?')) return
    try {
      await deleteOrder(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
      if (expanded === id) setExpanded(null)
    } catch {
      alert('Erreur lors de la suppression.')
    }
  }

  const displayed = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  return (
    <div className="admin-section">
      {newOrderAlert && (
        <div className="new-order-banner" role="alert">
          <span className="new-order-banner-icon" aria-hidden="true">🔔</span>
          <span className="new-order-banner-text">
            {newOrderCount > 1
              ? `${newOrderCount} nouvelles commandes viennent d'arriver !`
              : "Une nouvelle commande vient d'arriver !"}
          </span>
          <button className="new-order-banner-close" onClick={dismissAlert} aria-label="Fermer">✕</button>
        </div>
      )}

      <div className="section-header">
        <h2>Commandes</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings((s) => !s)}>
          🔔 Notifications
        </button>
      </div>

      {showSettings && (
        <div className="notif-settings-panel">
          <div className="notif-settings-row">
            <span className="notif-settings-label">Son de notification</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={soundEnabled} onChange={toggleSound} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="notif-settings-row">
            <span className="notif-settings-label">Durée du son</span>
            <select
              className="select notif-duration-select"
              value={soundDuration}
              onChange={(e) => changeDuration(e.target.value)}
              disabled={!soundEnabled}
            >
              <option value={5}>5 secondes</option>
              <option value={10}>10 secondes (défaut)</option>
              <option value={15}>15 secondes</option>
              <option value={20}>20 secondes</option>
              <option value={30}>30 secondes</option>
            </select>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => soundEnabled && playNotificationSound(soundDuration)}
            disabled={!soundEnabled}
          >
            🔊 Tester le son
          </button>
        </div>
      )}

      <div className="filter-bar">
        <button className={`filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          Toutes ({orders.length})
        </button>
        {STATUSES.map((s) => {
          const count = orders.filter((o) => o.status === s.value).length
          return (
            <button key={s.value} className={`filter-btn${filter === s.value ? ' active' : ''}`} onClick={() => setFilter(s.value)}>
              {s.label} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : displayed.length === 0 ? (
        <p className="text-muted empty-row">Aucune commande.</p>
      ) : (
        <div className="orders-list">
          {displayed.map((order) => (
            <div key={order.id} className={`order-card${newOrderIds.has(order.id) ? ' order-card-new' : ''}`}>
              <div
                className="order-card-header"
                onClick={() => { setExpanded(expanded === order.id ? null : order.id); clearNewBadge(order.id) }}
              >
                <div className="order-id">
                  <span className="order-hash">#</span>
                  {order.id.slice(0, 8).toUpperCase()}
                  {newOrderIds.has(order.id) && <span className="order-new-badge">NOUVEAU</span>}
                </div>
                <div className="order-meta">
                  <span className="order-client">{order.customer_name}</span>
                  <span className="order-phone text-muted">{order.phone}</span>
                </div>
                <span className="order-date text-muted">{formatDate(order.created_at)}</span>
                <span className="order-total">{parseFloat(order.total_price).toFixed(2)} €</span>
                <span className="order-status-dot" style={{ '--c': statusColor(order.status) }}>
                  {statusLabel(order.status)}
                </span>
                <svg className={`chevron ${expanded === order.id ? 'open' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {expanded === order.id && (
                <div className="order-card-body">
                  <div className="order-items">
                    {(order.items ?? []).map((item, i) => (
                      <div key={i} className="order-item-line">
                        <span>{item.name}</span>
                        <span className="text-muted">×{item.qty} kg</span>
                        <span className="mono">{(item.price * item.qty).toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>

                  {order.address && (
                    <p className="order-address text-muted">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      {order.address}
                    </p>
                  )}

                  <div className="payment-info">
                    <span className={`payment-pill ${order.payment_status === 'paid' ? 'pill-paid' : ''}`}>
                      {PAYMENT_LABELS[order.payment_status] || 'Non payé'}
                    </span>
                    {order.payment_method && (
                      <span className="payment-pill">
                        {order.payment_method === 'card' ? 'Carte' : 'Sur place'}
                      </span>
                    )}
                  </div>

                  <div className="order-actions">
                    <div className="status-select-group">
                      <label className="status-select-label">Changer le statut :</label>
                      <div className="status-buttons">
                        {STATUSES.map((s) => (
                          <button
                            key={s.value}
                            className={`status-btn${order.status === s.value ? ' active' : ''}`}
                            style={{ '--c': s.color }}
                            onClick={() => handleStatusChange(order, s.value)}
                            disabled={order.status === s.value}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-delete" onClick={() => handleDelete(order.id)}>
                      Supprimer
                    </button>
                  </div>

                  {!order.stock_decremented ? (
                    <p className="stock-notice">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      Le stock n'a pas encore été déduit pour cette commande.
                    </p>
                  ) : (
                    <p className="stock-notice stock-notice-decremented">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      Stock déjà déduit. Repasser en « En attente », « Refusée » ou « Annulée » le restaurera automatiquement.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .admin-section { padding: 0 0 40px; }
        .section-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
        .section-header h2 { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 22px; letter-spacing: -0.3px; }
        .new-order-banner { display: flex; align-items: center; gap: 14px; background: var(--color-red); color: #fff; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 4px 24px rgba(181,24,31,0.4); animation: banner-pop 0.4s cubic-bezier(0.16,1,0.3,1), banner-flash 1.1s ease-in-out infinite 0.4s; }
        .new-order-banner-icon { font-size: 22px; flex-shrink: 0; animation: bell-shake 0.6s ease-in-out infinite; }
        .new-order-banner-text { flex: 1; font-weight: 700; font-size: 14.5px; }
        .new-order-banner-close { background: rgba(255,255,255,0.18); border: none; color: #fff; width: 26px; height: 26px; flex-shrink: 0; font-size: 13px; cursor: pointer; transition: background 0.2s; }
        .new-order-banner-close:hover { background: rgba(255,255,255,0.32); }
        @keyframes banner-pop { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes banner-flash { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.18); } }
        @keyframes bell-shake { 0%,100% { transform: rotate(0deg); } 20% { transform: rotate(-15deg); } 40% { transform: rotate(13deg); } 60% { transform: rotate(-8deg); } 80% { transform: rotate(5deg); } }
        .notif-settings-panel { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; background: var(--color-paper-dim); border: 1px solid var(--color-border); padding: 16px 18px; margin-bottom: 20px; }
        .notif-settings-row { display: flex; align-items: center; gap: 10px; }
        .notif-settings-label { font-size: 12.5px; font-weight: 600; color: var(--color-text-muted); }
        .notif-duration-select { font-size: 12.5px; padding: 6px 8px; }
        .toggle-switch { position: relative; display: inline-block; width: 38px; height: 21px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: var(--color-border); transition: 0.2s; border-radius: 999px; }
        .toggle-slider::before { content: ''; position: absolute; height: 15px; width: 15px; left: 3px; bottom: 3px; background: #fff; transition: 0.2s; border-radius: 50%; }
        .toggle-switch input:checked + .toggle-slider { background: var(--color-red); }
        .toggle-switch input:checked + .toggle-slider::before { transform: translateX(17px); }
        .order-card-new { border-left: 3px solid var(--color-red) !important; background: rgba(181,24,31,0.04); animation: new-card-glow 1.4s ease-in-out infinite; }
        @keyframes new-card-glow { 0%,100% { box-shadow: inset 0 0 0 rgba(181,24,31,0); } 50% { box-shadow: inset 0 0 0 1px rgba(181,24,31,0.25); } }
        .order-new-badge { background: var(--color-red); color: #fff; font-size: 9px; font-weight: 800; letter-spacing: 0.6px; padding: 2px 7px; margin-left: 8px; border-radius: 2px; animation: badge-pulse 1s ease-in-out infinite; }
        @keyframes badge-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        .filter-bar { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 20px; }
        .filter-btn { padding: 6px 12px; font-size: 11.5px; font-weight: 600; background: var(--color-paper-dim); border: 1px solid var(--color-border); color: var(--color-text-muted); transition: all 0.2s; font-family: var(--font-mono); }
        .filter-btn:hover, .filter-btn.active { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }
        .orders-list { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--color-border); }
        .order-card { border-bottom: 1px solid var(--color-border); }
        .order-card:last-child { border-bottom: none; }
        .order-card-header { display: grid; grid-template-columns: 110px 1fr auto auto auto 20px; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; transition: background 0.15s; font-size: 13px; min-width: 560px; overflow-x: auto; }
        .order-card-header:hover { background: var(--color-paper-dim); }
        .order-id { font-family: var(--font-mono); font-weight: 700; font-size: 12px; letter-spacing: 0.5px; }
        .order-hash { color: var(--color-text-muted); font-weight: 400; }
        .order-meta { display: flex; flex-direction: column; gap: 2px; }
        .order-client { font-weight: 600; font-size: 13px; }
        .order-phone { font-family: var(--font-mono); font-size: 11px; }
        .order-date { font-family: var(--font-mono); font-size: 11px; white-space: nowrap; }
        .order-total { font-family: var(--font-mono); font-weight: 700; white-space: nowrap; }
        .order-status-dot { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--c); white-space: nowrap; }
        .chevron { transition: transform 0.2s; flex-shrink: 0; }
        .chevron.open { transform: rotate(180deg); }
        .order-card-body { padding: 16px; background: var(--color-paper-dim); border-top: 1px solid var(--color-border); }
        .order-items { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
        .order-item-line { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .order-address { display: flex; align-items: center; gap: 6px; font-size: 12px; margin: 6px 0 14px; }
        .payment-info { display: flex; gap: 6px; margin-bottom: 14px; }
        .payment-pill { font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 4px 10px; background: var(--color-paper); border: 1px solid var(--color-border); color: var(--color-text-muted); }
        .pill-paid { color: #2f6b3a; border-color: rgba(47,107,58,0.3); background: rgba(47,107,58,0.08); }
        .order-actions { display: flex; flex-direction: column; gap: 12px; }
        .status-select-group { display: flex; flex-direction: column; gap: 8px; }
        .status-select-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); }
        .status-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
        .status-btn { padding: 6px 12px; font-size: 11px; font-weight: 600; border: 1px solid var(--color-border); background: transparent; color: var(--c); transition: all 0.2s; }
        .status-btn:hover:not(:disabled) { background: var(--c); color: #fff; border-color: var(--c); }
        .status-btn.active { background: var(--c); color: #fff; border-color: var(--c); opacity: 0.7; cursor: default; }
        .btn-delete { color: var(--color-red); margin-top: 4px; }
        .stock-notice { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--color-text-muted); background: var(--color-paper); border: 1px solid var(--color-border); padding: 10px 14px; margin-top: 14px; }
        .stock-notice-decremented { color: #2f6b3a; border-color: rgba(47,107,58,0.3); background: rgba(47,107,58,0.06); }
        .empty-row { padding: 20px 0; }
      `}</style>
    </div>
  )
}
