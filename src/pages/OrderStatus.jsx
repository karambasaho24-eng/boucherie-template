import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchOrderById, updateOrderItems, cancelOwnOrder, fetchSiteConfig, createCheckoutSession } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { clearActiveOrder } from '../components/OrderReminder'
import Receipt from '../components/Receipt'

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête à récupérer',
  paid: 'Payée',
  completed: 'Terminée',
  refused: 'Refusée',
  cancelled: 'Annulée',
}

const STATUS_DESCRIPTIONS = {
  pending:   "Votre commande a bien été enregistrée. Elle est maintenant en attente de validation par la boucherie.",
  confirmed: "Votre commande a été confirmée par la boucherie. La préparation va débuter.",
  preparing: "La boucherie prépare actuellement votre commande. Merci de patienter.",
  ready:     "Votre commande est prête ! Vous pouvez venir la récupérer à la boucherie.",
  paid:      "Votre paiement a bien été reçu. Merci pour votre confiance !",
  completed: "Cette commande est terminée. Merci pour votre confiance !",
  refused:   "Cette commande a été refusée par la boucherie. Contactez-nous pour plus d'informations.",
  cancelled: "Cette commande a été annulée.",
}

const STATUS_ALERTS = {
  pending: {
    type: 'warning',
    text: "N'allez pas récupérer votre commande avant d'avoir reçu la confirmation de la boucherie. Merci de patienter.",
  },
  confirmed: {
    type: 'info',
    text: "La boucherie a validé votre commande. La préparation peut prendre un certain temps.",
  },
  preparing: {
    type: 'info',
    text: "Votre commande est en cours de préparation. Vous serez averti dès qu'elle sera prête.",
  },
  ready: {
    type: 'success',
    text: "Vous pouvez maintenant venir récupérer votre commande à la boucherie !",
  },
}

export default function OrderStatus() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editItems, setEditItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [shopName, setShopName] = useState('Boucherie')
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  useEffect(() => {
    fetchSiteConfig()
      .then((cfg) => {
        setShopName(cfg?.site_title || 'Boucherie')
        setStripeEnabled(cfg?.stripe_enabled ?? false)
      })
      .catch(() => {})
  }, [])

  async function load() {
    try {
      const data = await fetchOrderById(id)
      setOrder(data)
      setEditItems(data.items || [])
      if (data.status === 'completed' || data.status === 'cancelled') {
        clearActiveOrder()
      }
    } catch (err) {
      console.error(err)
      setError("Cette commande n'existe pas ou n'est plus accessible.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`order-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new
          setOrder((prev) => (prev ? { ...prev, ...updated } : updated))
          if (updated.status === 'completed' || updated.status === 'cancelled') {
            clearActiveOrder()
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  function startEditing() {
    setEditItems(order.items.map((i) => ({ ...i })))
    setEditing(true)
    setActionError('')
  }

  function updateQty(itemId, qty) {
    setEditItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, qty } : i)).filter((i) => i.qty > 0)
    )
  }

  const editTotal = editItems.reduce((sum, i) => sum + i.price * i.qty, 0)

  async function saveEdits() {
    if (editItems.length === 0) {
      setActionError('Votre commande ne peut pas être vide. Annulez-la plutôt si vous ne voulez plus rien.')
      return
    }
    setSaving(true)
    setActionError('')
    try {
      const updated = await updateOrderItems(order.id, { items: editItems, total_price: editTotal })
      setOrder(updated)
      setEditing(false)
    } catch (err) {
      console.error(err)
      setActionError("Impossible de modifier la commande — elle est peut-être déjà en cours de préparation.")
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!confirm('Voulez-vous vraiment annuler cette commande ?')) return
    setSaving(true)
    setActionError('')
    try {
      const updated = await cancelOwnOrder(order.id)
      setOrder(updated)
    } catch (err) {
      console.error(err)
      setActionError("Impossible d'annuler — la commande est peut-être déjà en cours de préparation.")
    } finally {
      setSaving(false)
    }
  }

  async function handlePay() {
    setPaying(true)
    setPayError('')
    try {
      const { url } = await createCheckoutSession(order.id)
      window.location.href = url
    } catch (err) {
      console.error(err)
      setPayError(err.message || 'Erreur lors de la création du paiement.')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return <div className="container order-status-state">Chargement…</div>
  }

  if (error) {
    return (
      <div className="container order-status-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="10" cy="10" r="7" /><line x1="21" y1="21" x2="15" y2="15" />
        </svg>
        <p>{error}</p>
        <Link to="/boutique" className="btn btn-primary">Voir la boutique</Link>
        <style>{`.order-status-state svg { margin-bottom: 14px; color: var(--color-text-muted); }`}</style>
      </div>
    )
  }

  const canModify = order.status === 'pending'

  return (
    <div className="order-status-page">
      <div className="order-status-header">
        <div className="container">
          <div className="section-label section-label-light">Suivi de commande</div>
          <h1>Commande #{order.id.slice(0, 8).toUpperCase()}</h1>
        </div>
      </div>

      <div className="container order-status-body">
        <div className="status-card">
          <span className="badge badge-status status-badge-large">{STATUS_LABELS[order.status]}</span>
          <p className="status-desc">{STATUS_DESCRIPTIONS[order.status]}</p>
          {STATUS_ALERTS[order.status] && (
            <div className={`status-alert status-alert-${STATUS_ALERTS[order.status].type}`}>
              {STATUS_ALERTS[order.status].type === 'warning' && '⚠️ '}
              {STATUS_ALERTS[order.status].type === 'info' && 'ℹ️ '}
              {STATUS_ALERTS[order.status].type === 'success' && '✅ '}
              {STATUS_ALERTS[order.status].text}
            </div>
          )}
        </div>

        <div className="status-block">
          <h3>Détail de la commande</h3>
          {editing ? (
            <>
              {editItems.map((item) => (
                <div key={item.id} className="edit-item-row">
                  <span className="edit-item-name">{item.name}</span>
                  <div className="qty-controls">
                    <button onClick={() => updateQty(item.id, item.qty - 1)} aria-label="Diminuer">−</button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} aria-label="Augmenter">+</button>
                  </div>
                  <span className="edit-item-total">{(item.price * item.qty).toFixed(2)} €</span>
                </div>
              ))}
              <div className="total-row">
                <span>Nouveau total</span>
                <strong>{editTotal.toFixed(2)} €</strong>
              </div>
              {actionError && <p className="error-msg">{actionError}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Annuler les modifs</button>
                <button className="btn btn-primary" onClick={saveEdits} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Valider les modifications'}
                </button>
              </div>
            </>
          ) : (
            <>
              {order.items.map((item) => (
                <div key={item.id} className="order-item-row">
                  <span>{item.name} <span className="text-muted">x{item.qty}</span></span>
                  <span>{(item.price * item.qty).toFixed(2)} €</span>
                </div>
              ))}
              <div className="total-row">
                <span>Total</span>
                <strong>{order.total_price.toFixed(2)} €</strong>
              </div>
              {actionError && <p className="error-msg">{actionError}</p>}
              {canModify && (
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button className="btn btn-ghost btn-block" onClick={startEditing} disabled={saving}>
                    Modifier ma commande
                  </button>
                  <button className="btn btn-danger btn-block" onClick={handleCancel} disabled={saving}>
                    {saving ? '…' : 'Annuler'}
                  </button>
                </div>
              )}
              {!canModify && order.status !== 'cancelled' && (
                <p className="text-muted" style={{ marginTop: 14, fontSize: 13 }}>
                  La boucherie a commencé à traiter votre commande, elle ne peut plus être modifiée en ligne. Pour toute question, contactez directement la boucherie.
                </p>
              )}
            </>
          )}
        </div>

        <div className="status-block status-block-sm">
          <p style={{ margin: 0 }}><strong>Client :</strong> {order.customer_name}</p>
          <p style={{ margin: '4px 0 0' }}><strong>Téléphone :</strong> {order.phone}</p>
          {order.address && <p style={{ margin: '4px 0 0' }}><strong>Adresse :</strong> {order.address}</p>}
        </div>

        {order.status === 'confirmed' && order.payment_status !== 'paid' && (
          <div className="status-block">
            <h3>Paiement</h3>
            {stripeEnabled ? (
              <>
                <p className="text-muted" style={{ marginTop: 0 }}>
                  Vous pouvez payer en ligne par carte ou directement sur place.
                </p>
                {payError && <p className="error-msg">{payError}</p>}
                <button className="btn btn-primary btn-block" onClick={handlePay} disabled={paying}>
                  {paying ? 'Redirection…' : 'Payer maintenant par carte'}
                </button>
                <p className="text-muted" style={{ marginTop: 10, fontSize: 12.5, textAlign: 'center' }}>
                  ou réglez sur place lors du retrait/livraison
                </p>
              </>
            ) : (
              <p className="text-muted" style={{ margin: 0 }}>Paiement sur place lors du retrait/livraison.</p>
            )}
          </div>
        )}

        <div className="status-block">
          <h3>Mon ticket</h3>
          <Receipt order={order} shopName={shopName} />
        </div>

        <Link to="/boutique" className="btn btn-ghost btn-block" style={{ marginTop: 16 }}>
          Continuer mes achats
        </Link>
      </div>

      <style>{`
        .order-status-state { padding: 80px 16px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .order-status-page { padding-bottom: 70px; }
        .order-status-header { background: var(--color-ink); padding: 56px 0 40px; color: var(--color-paper); margin-bottom: 32px; }
        .order-status-header h1 { font-family: var(--font-heading); font-size: 28px; font-weight: 800; letter-spacing: -0.3px; margin: 6px 0 0; color: var(--color-paper); }
        .order-status-body { max-width: 560px; display: flex; flex-direction: column; gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); }
        .status-card, .status-block { padding: 22px 24px; background: var(--color-surface); }
        .status-card { text-align: center; }
        .status-badge-large { font-size: 11px; padding: 6px 16px; }
        .status-desc { color: var(--color-text-muted); margin-top: 10px; margin-bottom: 0; font-size: 13.5px; line-height: 1.6; }
        .status-alert { margin-top: 14px; padding: 12px 16px; font-size: 13px; font-weight: 600; line-height: 1.55; text-align: left; }
        .status-alert-warning { background: rgba(181,24,31,0.07); border: 1px solid rgba(181,24,31,0.28); color: var(--color-red); }
        .status-alert-info { background: rgba(40,80,160,0.06); border: 1px solid rgba(40,80,160,0.22); color: #2850a0; }
        .status-alert-success { background: rgba(47,107,58,0.07); border: 1px solid rgba(47,107,58,0.28); color: #2f6b3a; }
        .status-block h3 { font-family: var(--font-display); font-weight: 600; font-size: 17px; margin: 0 0 16px; color: var(--color-text); }
        .status-block-sm { font-size: 13px; }
        .order-item-row, .edit-item-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--color-border); font-size: 14px; }
        .edit-item-row { gap: 10px; }
        .edit-item-name { flex: 1; }
        .edit-item-total { min-width: 56px; text-align: right; font-weight: 700; font-family: var(--font-mono); }
        .qty-controls { display: flex; align-items: center; gap: 0; border: 1px solid var(--color-border); }
        .qty-controls button { width: 26px; height: 26px; border: none; background: transparent; font-size: 14px; transition: background 0.15s; }
        .qty-controls button:hover { background: var(--color-paper-dim); }
        .qty-controls span { font-family: var(--font-mono); font-size: 13px; min-width: 22px; text-align: center; display: inline-block; }
        .total-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-border); padding-top: 14px; margin-top: 10px; font-size: 18px; font-weight: 700; font-family: var(--font-mono); color: var(--color-text); }
        .total-row span { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--color-text-muted); font-family: var(--font-mono); }
        .error-msg { color: var(--color-red); font-size: 13px; margin: 10px 0 0; background: rgba(181,24,31,0.06); padding: 10px 14px; border: 1px solid rgba(181,24,31,0.25); }
      `}</style>
    </div>
  )
}
