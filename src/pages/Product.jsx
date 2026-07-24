import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useCart } from '../hooks/useCart'

export default function Product() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const { addItem } = useCart()

  useEffect(() => {
    supabase.from('products').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error) throw error
        setProduct(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="container product-state">Chargement…</div>
  if (!product) return (
    <div className="container product-state">
      <p>Produit introuvable.</p>
      <Link to="/boutique" className="btn btn-primary">Retour à la boutique</Link>
    </div>
  )

  const hasPromo = product.promo_price != null && product.promo_price < product.price

  return (
    <div className="container product-page">
      <Link to="/boutique" className="back-link">← Retour à la boutique</Link>

      <div className="product-detail">
        <div className="product-detail-img">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} loading="lazy" />
          ) : (
            <div className="placeholder" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M4 4h16v16H4z" /><path d="M4 14l5-5 4 4 7-7" />
              </svg>
            </div>
          )}
        </div>

        <div className="product-detail-info">
          {product.category && <span className="product-detail-cat">{product.category}</span>}
          <h1>{product.name}</h1>
          <span className="product-detail-halal">Halal</span>
          <p className="product-detail-desc">{product.description}</p>

          <div className="price-row">
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

          <div className="qty-row">
            <span className="qty-label">Quantité</span>
            <div className="qty-stepper">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuer">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="Augmenter">+</button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            disabled={!product.is_available}
            onClick={() => addItem(product, qty)}
          >
            {product.is_available ? 'Ajouter au panier' : 'Indisponible'}
          </button>
        </div>
      </div>

      <style>{`
        .product-state { padding: 80px 16px; text-align: center; }
        .product-page { padding: 28px 16px 70px; }
        .back-link {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-muted);
          margin-bottom: 28px;
          transition: color 0.2s;
        }
        .back-link:hover { color: var(--color-text); }
        .product-detail {
          display: grid;
          gap: 36px;
          grid-template-columns: 1fr;
        }
        .product-detail-img {
          aspect-ratio: 1;
          overflow: hidden;
          background: var(--color-paper-dim);
        }
        .product-detail-img img { width: 100%; height: 100%; object-fit: cover; }
        .placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--color-border-dark); }
        .product-detail-cat {
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }
        .product-detail-info h1 {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: clamp(28px, 4vw, 38px);
          margin: 8px 0 6px;
          letter-spacing: -0.5px;
        }
        .product-detail-halal {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--color-red);
          margin-bottom: 16px;
        }
        .product-detail-desc { font-size: 15px; color: var(--color-text-muted); line-height: 1.75; margin: 0 0 28px; }
        .price-row { margin: 0 0 28px; display: flex; gap: 10px; align-items: baseline; padding-bottom: 24px; border-bottom: 1px solid var(--color-border); }
        .price-old { font-family: var(--font-mono); text-decoration: line-through; color: var(--color-text-muted); font-size: 14px; }
        .price-new { font-family: var(--font-mono); font-size: 30px; font-weight: 700; color: var(--color-text); }
        .price-unit { font-size: 13px; color: var(--color-text-muted); }
        .qty-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .qty-label { font-family: var(--font-mono); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--color-text-muted); }
        .qty-stepper { display: flex; align-items: center; gap: 0; border: 1px solid var(--color-border); }
        .qty-stepper button {
          width: 38px; height: 38px; background: transparent; border: none; font-size: 16px; color: var(--color-text);
          transition: background 0.2s;
        }
        .qty-stepper button:hover { background: var(--color-paper-dim); }
        .qty-stepper span { width: 40px; text-align: center; font-family: var(--font-mono); font-size: 14px; }
        @media (min-width: 768px) {
          .product-detail { grid-template-columns: 1fr 1fr; gap: 60px; }
        }
      `}</style>
    </div>
  )
}

