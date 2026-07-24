// ============================================================
// src/components/ReservationForm.jsx
// Formulaire de réservation côté client (produits en mode reservation_only)
// ============================================================

import { useState } from 'react'
import { createReservation } from '../lib/stockApi'

export default function ReservationForm({ product, onSuccess, onClose }) {
  const [form, setForm] = useState({ customer_name: '', phone: '', quantity_kg: '', note: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const availableKg = product.stock_enabled
    ? Math.max((product.stock_kg ?? 0) - (product.stock_reserved_kg ?? 0), 0)
    : null

  function handleField(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    setError('')

    if (!form.customer_name.trim()) return setError('Veuillez indiquer votre nom.')
    if (!form.phone.trim()) return setError('Veuillez indiquer votre téléphone.')
    const qty = parseFloat(form.quantity_kg)
    if (!qty || qty <= 0) return setError('Veuillez indiquer une quantité valide.')
    if (availableKg !== null && qty > availableKg) {
      return setError(
        availableKg <= 0
          ? 'Ce produit n\'est plus disponible à la réservation.'
          : `Seulement ${availableKg.toFixed(2)} kg disponibles. Veuillez réduire la quantité.`
      )
    }

    setLoading(true)
    try {
      await createReservation({
        productId: product.id,
        customerName: form.customer_name.trim(),
        phone: form.phone.trim(),
        quantityKg: qty,
        note: form.note.trim() || null,
      })
      setSuccess(true)
      if (onSuccess) onSuccess()
    } catch (err) {
      if (err.code === 'STOCK_EXCEEDED') {
        setError(err.message)
      } else {
        setError('Erreur lors de l\'envoi. Veuillez réessayer.')
        console.error(err)
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="res-success">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12.5l2.6 2.6L16 9.5" />
        </svg>
        <h3>Réservation envoyée</h3>
        <p>
          Votre demande de réservation pour <strong>{product.name}</strong> a bien été enregistrée.
          La boucherie vous contactera pour confirmer.
        </p>
        {onClose && (
          <button className="btn btn-primary" onClick={onClose}>Fermer</button>
        )}
        <style>{`
          .res-success { text-align: center; padding: 32px 20px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
          .res-success h3 { font-family: var(--font-display); font-weight: 600; font-size: 21px; margin: 0; }
          .res-success p { color: var(--color-text-muted); margin: 0; font-size: 14px; line-height: 1.6; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="res-form">
      <h3 className="res-title">Demande de réservation</h3>
      <p className="res-product-name">{product.name}</p>

      {availableKg !== null && (
        <p className="res-available">
          <span className="res-dot" />
          {availableKg > 0
            ? `${availableKg.toFixed(2)} kg disponibles à la réservation`
            : 'Plus de stock disponible à la réservation'}
        </p>
      )}

      <div className="field">
        <label>Nom *</label>
        <input
          className="input"
          name="customer_name"
          value={form.customer_name}
          onChange={handleField}
          placeholder="Votre nom"
        />
      </div>
      <div className="field">
        <label>Téléphone *</label>
        <input
          className="input"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleField}
          placeholder="06 XX XX XX XX"
        />
      </div>
      <div className="field">
        <label>Quantité souhaitée (kg) *</label>
        <input
          className="input"
          name="quantity_kg"
          type="number"
          min="0.1"
          step="0.1"
          max={availableKg ?? undefined}
          value={form.quantity_kg}
          onChange={handleField}
          placeholder="Ex : 2.5"
        />
      </div>
      <div className="field">
        <label>Note (facultative)</label>
        <textarea
          className="textarea"
          name="note"
          rows={2}
          value={form.note}
          onChange={handleField}
          placeholder="Préparation souhaitée, heure de retrait…"
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="res-actions">
        {onClose && (
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        )}
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading || (availableKg !== null && availableKg <= 0)}
        >
          {loading ? 'Envoi…' : 'Envoyer ma réservation'}
        </button>
      </div>

      <style>{`
        .res-form { display: flex; flex-direction: column; gap: 4px; }
        .res-title { font-family: var(--font-display); font-weight: 600; font-size: 19px; margin: 0 0 4px; }
        .res-product-name { font-family: var(--font-heading); font-weight: 700; font-size: 15px; color: var(--color-text); margin: 0 0 14px; }
        .res-available {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--color-text-muted);
          font-family: var(--font-mono);
          background: var(--color-paper-dim);
          border: 1px solid var(--color-border);
          padding: 9px 12px;
          margin-bottom: 14px;
        }
        .res-dot { width: 7px; height: 7px; border-radius: 50%; background: #2f6b3a; flex-shrink: 0; }
        .res-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
        .form-error { color: var(--color-red); font-size: 13px; background: rgba(181,24,31,0.06); padding: 10px 12px; border: 1px solid rgba(181,24,31,0.25); }
      `}</style>
    </div>
  )
}
