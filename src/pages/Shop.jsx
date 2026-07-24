// ============================================================
// src/pages/Shop.jsx  (REMPLACEMENT COMPLET)
// Boutique avec Supabase Realtime — mise à jour instantanée
// des stocks sans recharger la page.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { fetchAvailableProducts } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard'
import CategoryFilter from '../components/CategoryFilter'
import SearchBar from '../components/SearchBar'

export default function Shop() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [stockFlash, setStockFlash] = useState(null) // id du produit mis à jour

  // Chargement initial
  async function load() {
    try {
      const data = await fetchAvailableProducts()
      setProducts(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    // Supabase Realtime : écoute les changements sur la table products
    const channel = supabase
      .channel('shop-products-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          const updated = payload.new

          // Met à jour le produit dans la liste locale immédiatement
          setProducts((prev) => {
            // Si le produit passe en "disabled", on le retire
            if (updated.availability_mode === 'disabled') {
              return prev.filter((p) => p.id !== updated.id)
            }
            // Sinon on met à jour ses données
            const exists = prev.find((p) => p.id === updated.id)
            if (exists) {
              return prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            }
            // Nouveau produit devenu disponible
            return [...prev, updated]
          })

          // Flash visuel sur la carte mise à jour
          setStockFlash(updated.id)
          setTimeout(() => setStockFlash(null), 2000)
        }
      )
      .subscribe()

    // Nettoyage à la destruction du composant
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products]
  )

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = category === 'all' || p.category === category
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [products, category, search])

  return (
    <div className="shop-page">
      <div className="shop-hero">
        <div className="container shop-hero-content">
          <div className="section-label section-label-light">Notre sélection</div>
          <h1>La Boutique</h1>
          <p>Viandes fraîches, produits halal &amp; spécialités orientales</p>
        </div>
      </div>

      <div className="container shop-body">
        <div className="shop-controls">
          <SearchBar value={search} onChange={setSearch} />
          <CategoryFilter categories={categories} active={category} onChange={setCategory} />
        </div>

        {loading ? (
          <div className="product-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 320 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="10" cy="10" r="7" /><line x1="21" y1="21" x2="15" y2="15" />
            </svg>
            <p>Aucun produit trouvé pour cette recherche.</p>
          </div>
        ) : (
          <>
            <div className="shop-results-count">
              {filtered.length} produit{filtered.length > 1 ? 's' : ''} disponible{filtered.length > 1 ? 's' : ''}
            </div>
            <div className="product-grid">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className={`product-grid-item${stockFlash === p.id ? ' stock-updated' : ''}`}
                >
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`
        .shop-page {}
        .shop-hero {
          position: relative;
          background: var(--color-ink);
          padding: 80px 0 56px;
          color: var(--color-paper);
          overflow: hidden;
        }
        .shop-hero-content { position: relative; z-index: 1; }
        .shop-hero-content h1 {
          font-family: var(--font-heading);
          font-size: clamp(38px, 7vw, 64px);
          font-weight: 800;
          letter-spacing: -1px;
          margin: 6px 0 10px;
        }
        .shop-hero-content p { font-size: 15px; color: rgba(250,249,246,0.6); margin: 0; }
        .shop-body { padding: 40px 0 70px; }
        .shop-controls {
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-bottom: 28px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--color-border);
        }
        .shop-results-count {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--color-text-muted);
          margin-bottom: 20px;
        }
        .product-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1px;
          background: var(--color-border);
        }
        .product-grid-item {
          background: var(--color-surface);
          transition: outline 0.3s ease;
        }
        /* Flash vert quand le stock est mis à jour en temps réel */
        .product-grid-item.stock-updated {
          outline: 2px solid #2f6b3a;
          outline-offset: -2px;
          animation: stock-flash 2s ease forwards;
        }
        @keyframes stock-flash {
          0%   { outline-color: #2f6b3a; }
          100% { outline-color: transparent; }
        }
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
        }
        .empty-state svg { margin: 0 auto 16px; opacity: 0.4; }
        .empty-state p { font-size: 15px; margin: 0; }
        @media (min-width: 640px) {
          .shop-controls { flex-direction: row; align-items: center; justify-content: space-between; }
          .product-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1024px) {
          .product-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  )
}
