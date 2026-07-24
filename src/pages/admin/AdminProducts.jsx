// ============================================================
// src/pages/admin/AdminProducts.jsx  (REMPLACEMENT COMPLET)
// Gestion des produits avec champs de stock intégrés.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from '../../lib/api'
import { AVAILABILITY_MODES } from '../../hooks/useStock'

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  promo_price: '',
  category: '',
  image_url: '',
  is_available: true,
  is_featured: false,
  // Champs de stock
  availability_mode: 'available',
  stock_enabled: false,
  stock_kg: '',
  stock_alert_kg: '1',
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const fileRef = useRef()

  async function load() {
    try {
      const data = await fetchProducts()
      setProducts(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  function openEdit(p) {
    setEditId(p.id)
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      promo_price: p.promo_price != null ? String(p.promo_price) : '',
      category: p.category || '',
      image_url: p.image_url || '',
      is_available: p.is_available,
      is_featured: !!p.is_featured,
      // Champs de stock
      availability_mode: p.availability_mode ?? (p.is_available ? 'available' : 'disabled'),
      stock_enabled: !!p.stock_enabled,
      stock_kg: p.stock_kg != null ? String(p.stock_kg) : '',
      stock_alert_kg: p.stock_alert_kg != null ? String(p.stock_alert_kg) : '1',
    })
    setError('')
    setShowForm(true)
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadProductImage(file)
      setForm((f) => ({ ...f, image_url: url }))
    } catch {
      setError('Erreur upload image.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price) { setError('Nom et prix obligatoires.'); return }
    if (form.stock_enabled && form.stock_kg === '') { setError('Indiquez un stock en kg.'); return }

    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price),
        promo_price: form.promo_price !== '' ? parseFloat(form.promo_price) : null,
        category: form.category.trim(),
        image_url: form.image_url,
        // Rétrocompatibilité is_available
        is_available: form.availability_mode === 'available' || form.availability_mode === 'pickup_only',
        is_featured: form.is_featured,
        // Champs de stock
        availability_mode: form.availability_mode,
        stock_enabled: form.stock_enabled,
        stock_kg: form.stock_enabled ? parseFloat(form.stock_kg || 0) : 0,
        stock_alert_kg: form.stock_enabled ? parseFloat(form.stock_alert_kg || 1) : 1,
      }
      if (editId) {
        await updateProduct(editId, payload)
      } else {
        await createProduct(payload)
      }
      await load()
      setShowForm(false)
    } catch (err) {
      console.error(err)
      setError('Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce produit ?')) return
    try {
      await deleteProduct(id)
      setProducts((p) => p.filter((x) => x.id !== id))
    } catch {
      alert('Erreur lors de la suppression.')
    }
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Produits</h2>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nouveau produit</button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Modifier' : 'Nouveau produit'}</h3>

            {/* ── INFORMATIONS DE BASE ── */}
            <div className="field">
              <label>Nom *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Prix (€/kg) *</label>
                <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="field">
                <label>Prix promo (€)</label>
                <input className="input" type="number" min="0" step="0.01" value={form.promo_price} onChange={(e) => setForm((f) => ({ ...f, promo_price: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>Catégorie</label>
              <input className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Bœuf, Agneau, Épicerie..." />
            </div>
            <div className="field">
              <label>Image</label>
              {form.image_url && <img src={form.image_url} alt="preview" className="img-preview" />}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImageUpload} />
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? 'Upload…' : 'Prendre une photo / Choisir une image'}
              </button>
            </div>

            {/* ── MODE DE DISPONIBILITÉ ── */}
            <div className="form-section-title">Disponibilité</div>
            <div className="field">
              <label>Mode</label>
              <select
                className="input"
                value={form.availability_mode}
                onChange={(e) => setForm((f) => ({ ...f, availability_mode: e.target.value }))}
              >
                {AVAILABILITY_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* ── GESTION DU STOCK ── */}
            <div className="form-section-title">Gestion du stock</div>
            <div className="field field-row">
              <input
                type="checkbox"
                id="stock_enabled"
                checked={form.stock_enabled}
                onChange={(e) => setForm((f) => ({ ...f, stock_enabled: e.target.checked }))}
              />
              <label htmlFor="stock_enabled" className="field-row-label">Activer la gestion de stock au kilo</label>
            </div>

            {form.stock_enabled && (
              <div className="form-row">
                <div className="field">
                  <label>Stock disponible (kg)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.stock_kg}
                    onChange={(e) => setForm((f) => ({ ...f, stock_kg: e.target.value }))}
                    placeholder="ex : 15.0"
                  />
                </div>
                <div className="field">
                  <label>Seuil d'alerte (kg)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.stock_alert_kg}
                    onChange={(e) => setForm((f) => ({ ...f, stock_alert_kg: e.target.value }))}
                    placeholder="ex : 2.0"
                  />
                </div>
              </div>
            )}

            {/* ── OPTIONS ── */}
            <div className="field field-row">
              <input
                type="checkbox"
                id="featured"
                checked={form.is_featured}
                onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
              />
              <label htmlFor="featured" className="field-row-label">Mettre en avant (section «&nbsp;Produits du moment&nbsp;»)</label>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : (
        <div className="product-table">
          <div className="product-table-header">
            <span>Produit</span>
            <span>Prix</span>
            <span>Catégorie</span>
            <span>Disponibilité</span>
            <span>Stock</span>
            <span>Actions</span>
          </div>
          {products.map((p) => {
            const mode = p.availability_mode ?? (p.is_available ? 'available' : 'disabled')
            const modeConfig = AVAILABILITY_MODES.find((m) => m.value === mode)
            const availKg = p.stock_enabled
              ? Math.max((p.stock_kg ?? 0) - (p.stock_reserved_kg ?? 0), 0)
              : null
            const isLow = p.stock_enabled && availKg !== null && availKg <= (p.stock_alert_kg ?? 1)

            return (
              <div key={p.id} className="product-row">
                <div className="product-row-name">
                  {p.image_url && <img src={p.image_url} alt={p.name} />}
                  <span>{p.name}</span>
                  {p.is_featured && <span className="featured-tag" title="Mis en avant">★</span>}
                </div>
                <span>
                  {p.promo_price != null ? (
                    <><s className="price-struck">{p.price.toFixed(2)}€</s>{' '}
                      <strong className="price-promo">{p.promo_price.toFixed(2)}€</strong></>
                  ) : (
                    `${p.price.toFixed(2)} €`
                  )}
                </span>
                <span className="text-muted">{p.category || '—'}</span>
                <span>
                  <span className="avail-pill" style={{ '--c': modeConfig?.color ?? '#aaa' }}>
                    {modeConfig?.label ?? mode}
                  </span>
                </span>
                <span>
                  {p.stock_enabled ? (
                    <span className={`stock-pill ${isLow ? 'stock-low' : ''}`}>
                      {availKg?.toFixed(2)} kg
                      {isLow && ' ⚠'}
                    </span>
                  ) : (
                    <span className="text-muted" style={{ fontSize: 11 }}>—</span>
                  )}
                </span>
                <div className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} aria-label="Modifier">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 3l4 4-12 12H5v-4z" /></svg>
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)} aria-label="Supprimer">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M9 6V4h6v2m-9 0l1 14h10l1-14" /></svg>
                  </button>
                </div>
              </div>
            )
          })}
          {products.length === 0 && <p className="text-muted empty-row">Aucun produit.</p>}
        </div>
      )}

      <style>{`
        .admin-section { padding: 0 0 40px; }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .section-header h2 { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 22px; letter-spacing: -0.3px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(10,10,10,0.6); z-index: 100; display: flex; align-items: flex-start; justify-content: center; padding: 24px; overflow-y: auto; }
        .modal { width: 100%; max-width: 520px; padding: 32px; background: var(--color-surface); border: 1px solid var(--color-border); }
        .modal h3 { font-family: var(--font-display); font-weight: 600; font-size: 19px; margin: 0 0 20px; }
        .form-section-title { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--color-text-muted); border-top: 1px solid var(--color-border); padding-top: 16px; margin: 16px 0 12px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .field label { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-muted); }
        .field-row { flex-direction: row; align-items: center; gap: 10px; }
        .field-row-label { margin-bottom: 0; font-size: 13px; text-transform: none; letter-spacing: 0; font-family: var(--font-body); color: var(--color-text); }
        .img-preview { width: 76px; height: 76px; object-fit: cover; margin-bottom: 8px; border: 1px solid var(--color-border); }
        .form-error { color: var(--color-red); font-size: 13px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
        .product-table { border: 1px solid var(--color-border); overflow-x: auto; }
        .product-table-header, .product-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr 1fr 90px; align-items: center; gap: 12px; padding: 13px 16px; font-size: 12.5px; min-width: 700px; }
        .product-table-header { background: var(--color-paper-dim); font-family: var(--font-mono); font-weight: 700; color: var(--color-text-muted); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
        .product-row { border-top: 1px solid var(--color-border); }
        .product-row-name { display: flex; align-items: center; gap: 10px; font-weight: 600; font-family: var(--font-heading); }
        .product-row-name img { width: 36px; height: 36px; object-fit: cover; }
        .featured-tag { color: var(--color-red); font-size: 13px; flex-shrink: 0; }
        .price-struck { opacity: 0.45; font-size: 12px; font-family: var(--font-mono); }
        .price-promo { color: var(--color-red); font-family: var(--font-mono); }
        .avail-pill { font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--c); }
        .stock-pill { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--color-text); }
        .stock-low { color: #c47a00; }
        .row-actions { display: flex; gap: 6px; }
        .empty-row { padding: 20px 16px; }
        .btn-danger { background: var(--color-red); color: #fff; border-color: var(--color-red); }
        .btn-danger:hover { background: transparent; color: var(--color-red); }
      `}</style>
    </div>
  )
}
