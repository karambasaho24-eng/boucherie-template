// ============================================================
// src/components/ProductCard.jsx  (REMPLACEMENT COMPLET)
// Carte produit avec badge de disponibilité et vérification de stock.
// ============================================================

import { useState } from 'react'
import { useCart } from '../hooks/useCart'
import { useStockInfo } from '../hooks/useStock'
import StockBadge from './StockBadge'
import ReservationForm from './ReservationForm'

export default function ProductCard({ product }) {
  const { addItem } = useCart()
  const stockInfo = useStockInfo(product)

  const [qty, setQty] = useState(1)
  const [stockError, setStockError] = useState('')
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [adding, setAdding] = useState(false)

  const hasPromo = product.promo_price != null && product.promo_price < product.price
  const discount = hasPromo ? Math.round((1 - product.promo_price / product.price) * 100) : 0

  const isReservationMode = stockInfo.availabilityMode === 'reservation_only'
  const isPickupOnly = stockInfo.availabilityMode === 'pickup_only'
  const isUnavailable =
    stockInfo.availabilityMode === 'disabled' ||
    stockInfo.availabilityMode === 'out_of_stock' ||
    (stockInfo.isStockManaged && stockInfo.availableKg <= 0 && !isReservationMode)

  async function handleAdd() {
    setStockError('')
    setAdding(true)
    const result = await addItem(product, qty)
    setAdding(false)

    if (!result.success) {
      setStockError(result.message)
      // Si une quantité est suggérée, on la propose automatiquement
      if (result.suggestedKg > 0) {
        setQty(parseFloat(result.suggestedKg.toFixed(2)))
      }
    }
  }

  return (
    <div className="product-card">
      {/* Image */}
      <div className="product-img-wrap">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-img-placeholder" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M4 4h16v16H4z" />
              <path d="M4 14l5-5 4 4 7-7" />
            </svg>
          </div>
        )}
        {hasPromo && <span className="badge-promo-pill">-{discount}%</span>}
        {product.category && (
          <span className="product-category-pill">{product.category}</span>
        )}
        {/* Badge de disponibilité en overlay */}
        <div className="stock-badge-overlay">
          <StockBadge product={product} compact />
        </div>
      </div>

      {/* Corps */}
      <div className="product-body">
        <div className="product-halal-dot">Halal</div>
        <h3 className="product-name">{product.name}</h3>
        {product.description && (
          <p className="product-desc">{product.description}</p>
        )}

        {/* Sélecteur de quantité si gestion de stock au kg */}
        {product.stock_enabled && !isUnavailable && !isReservationMode && (
          <div className="qty-selector">
            <label className="qty-label">Quantité (kg)</label>
            <div className="qty-row">
              <button
                className="qty-btn"
                onClick={() => setQty((q) => Math.max(parseFloat((q - 0.5).toFixed(2)), 0.5))}
                aria-label="Moins"
              >−</button>
              <input
                className="qty-input"
                type="number"
                min="0.5"
                step="0.5"
                max={stockInfo.maxKg ?? undefined}
                value={qty}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!isNaN(v) && v > 0) {
                    setQty(parseFloat(v.toFixed(2)))
                    setStockError('')
                  }
                }}
              />
              <button
                className="qty-btn"
                onClick={() => {
                  const next = parseFloat((qty + 0.5).toFixed(2))
                  if (stockInfo.maxKg !== null && next > stockInfo.maxKg) {
                    setStockError(`Maximum disponible : ${stockInfo.maxKg.toFixed(2)} kg`)
                    return
                  }
                  setQty(next)
                  setStockError('')
                }}
                aria-label="Plus"
              >+</button>
            </div>
            {stockInfo.isStockManaged && stockInfo.maxKg !== null && (
              <p className="qty-max-hint">Max disponible : {stockInfo.maxKg.toFixed(2)} kg</p>
            )}
          </div>
        )}

        {/* Erreur de stock */}
        {stockError && (
          <div className="stock-error-msg">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {stockError}
          </div>
        )}

        {/* Footer prix + action */}
        <div className="product-footer">
          <div className="price-block">
            {hasPromo ? (
              <>
                <span className="price-old">{product.price.toFixed(2)} €</span>
                <span className="price-new">{product.promo_price.toFixed(2)} €</span>
              </>
            ) : (
              <span className="price-new">{product.price.toFixed(2)} €</span>
            )}
            <span className="price-unit">/ kg</span>
          </div>

          {isReservationMode ? (
            <button
              className="add-to-cart-btn btn-reservation"
              onClick={() => setShowReservationModal(true)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Réserver
            </button>
          ) : isUnavailable ? (
            <button className="add-to-cart-btn" disabled>
              {stockInfo.availabilityMode === 'out_of_stock' || (stockInfo.isStockManaged && stockInfo.availableKg <= 0)
                ? 'Rupture'
                : 'Indispo'}
            </button>
          ) : (
            <button
              className="add-to-cart-btn"
              onClick={handleAdd}
              disabled={adding}
              aria-label={`Ajouter ${product.name} au panier`}
            >
              {adding ? (
                '…'
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Ajouter
                </>
              )}
            </button>
          )}
        </div>

        {/* Mention retrait boutique */}
        {isPickupOnly && (
          <p className="pickup-mention">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/>
            </svg>
            Retrait en boutique uniquement
          </p>
        )}
      </div>

      {/* Modal réservation */}
      {showReservationModal && (
        <div className="modal-overlay" onClick={() => setShowReservationModal(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <ReservationForm
              product={product}
              onClose={() => setShowReservationModal(false)}
              onSuccess={() => setTimeout(() => setShowReservationModal(false), 2000)}
            />
          </div>
        </div>
      )}

      <style>{`
        .product-card {
          display: flex; flex-direction: column;
          border-radius: 0; overflow: hidden;
          background: var(--color-surface); height: 100%;
          transition: box-shadow 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .product-card:hover { box-shadow: var(--shadow-lg); }
        .product-img-wrap {
          position: relative; aspect-ratio: 4/3;
          background: var(--color-paper-dim); overflow: hidden;
        }
        .product-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s cubic-bezier(0.16,1,0.3,1); }
        .product-card:hover .product-img-wrap img { transform: scale(1.05); }
        .product-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--color-border-dark); }
        .badge-promo-pill { position: absolute; top: 12px; left: 12px; background: var(--color-red); color: #fff; font-family: var(--font-mono); font-size: 11px; font-weight: 700; padding: 4px 9px; letter-spacing: 0.3px; }
        .product-category-pill { position: absolute; bottom: 12px; left: 12px; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; padding: 4px 10px; letter-spacing: 1px; text-transform: uppercase; }
        .stock-badge-overlay { position: absolute; top: 12px; right: 12px; }
        .product-body { padding: 20px 22px 22px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .product-halal-dot { font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--color-red); text-transform: uppercase; letter-spacing: 1.5px; }
        .product-name { margin: 4px 0 0; font-family: var(--font-heading); font-size: 17px; font-weight: 700; letter-spacing: -0.2px; color: var(--color-text); line-height: 1.3; }
        .product-desc { font-size: 12.5px; margin: 0; color: var(--color-text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; }
        .qty-selector { margin: 8px 0 4px; }
        .qty-label { font-size: 11px; font-family: var(--font-mono); font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-muted); display: block; margin-bottom: 6px; }
        .qty-row { display: flex; align-items: center; border: 1px solid var(--color-border); width: fit-content; }
        .qty-btn { width: 30px; height: 30px; border: none; background: transparent; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
        .qty-btn:hover { background: var(--color-paper-dim); }
        .qty-input { width: 56px; height: 30px; border: none; border-left: 1px solid var(--color-border); border-right: 1px solid var(--color-border); text-align: center; font-family: var(--font-mono); font-size: 13px; font-weight: 600; background: transparent; color: var(--color-text); }
        .qty-max-hint { font-size: 10.5px; color: var(--color-text-muted); font-family: var(--font-mono); margin: 4px 0 0; }
        .stock-error-msg { display: flex; align-items: flex-start; gap: 7px; background: rgba(181,24,31,0.06); border: 1px solid rgba(181,24,31,0.25); padding: 9px 12px; font-size: 12px; color: var(--color-red); line-height: 1.4; }
        .product-footer { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 16px; border-top: 1px solid var(--color-border); }
        .price-block { display: flex; flex-direction: column; line-height: 1.15; gap: 1px; }
        .price-old { font-family: var(--font-mono); font-size: 11px; text-decoration: line-through; color: var(--color-text-muted); }
        .price-new { font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--color-text); }
        .price-unit { font-size: 10px; color: var(--color-text-muted); font-weight: 500; }
        .add-to-cart-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; background: var(--color-ink); color: var(--color-paper); border: 1px solid var(--color-ink); font-size: 11px; font-weight: 700; font-family: var(--font-body); letter-spacing: 0.8px; text-transform: uppercase; transition: all 0.25s ease; flex-shrink: 0; }
        .add-to-cart-btn:hover:not(:disabled) { background: var(--color-paper); color: var(--color-ink); }
        .add-to-cart-btn:disabled { background: var(--color-border); color: var(--color-text-muted); border-color: var(--color-border); cursor: not-allowed; }
        .btn-reservation { background: #1a4d8f; border-color: #1a4d8f; }
        .btn-reservation:hover { background: var(--color-paper); color: #1a4d8f; }
        .pickup-mention { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--color-text-muted); margin: 4px 0 0; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(10,10,10,0.6); z-index: 200; display: flex; align-items: flex-start; justify-content: center; padding: 24px; overflow-y: auto; }
        .modal { width: 100%; max-width: 500px; padding: 32px; background: var(--color-surface); border: 1px solid var(--color-border); }
      `}</style>
    </div>
  )
}
