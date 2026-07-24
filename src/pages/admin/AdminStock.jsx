// ============================================================
// src/pages/admin/AdminStock.jsx
// Tableau de bord complet de gestion des stocks
// ============================================================

import { useEffect, useState } from 'react'
import {
  fetchStockDashboard,
  fetchStockMovements,
  fetchReservations,
  acceptReservation,
  refuseReservation,
  cancelReservation,
  updateProductStock,
  decrementStockForOrder,
} from '../../lib/stockApi'
import { updateProduct } from '../../lib/api'
import { AVAILABILITY_MODES } from '../../hooks/useStock'

const SUB_TABS = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'reservations', label: 'Réservations' },
  { id: 'movements', label: 'Historique' },
]

function formatDate(d) {
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────────
// VUE D'ENSEMBLE DES STOCKS
// ─────────────────────────────────────────────

function StockOverview({ onEdit }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const data = await fetchStockDashboard()
      setRows(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const alerts = rows.filter((r) => r.alert_triggered)

  return (
    <div>
      {alerts.length > 0 && (
        <div className="stock-alerts-banner">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <strong>Alerte stock bas</strong> —{' '}
            {alerts.map((a, i) => (
              <span key={a.id}>
                {a.name} ({a.stock_available_kg?.toFixed(2) ?? '0'} kg restants)
                {i < alerts.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted empty-row">
          Aucun produit avec gestion de stock activée. Activez-la depuis l'onglet Produits.
        </p>
      ) : (
        <div className="stock-table">
          <div className="stock-table-header">
            <span>Produit</span>
            <span>Stock total</span>
            <span>Réservé</span>
            <span>Disponible</span>
            <span>Seuil alerte</span>
            <span>Mode</span>
            <span>Réservations</span>
            <span>Action</span>
          </div>
          {rows.map((row) => (
            <div key={row.id} className={`stock-row${row.alert_triggered ? ' stock-row-alert' : ''}`}>
              <span className="stock-row-name">{row.name}</span>
              <span className="mono">{parseFloat(row.stock_kg ?? 0).toFixed(2)} kg</span>
              <span className="mono text-muted">{parseFloat(row.stock_reserved_kg ?? 0).toFixed(2)} kg</span>
              <span className={`mono ${row.alert_triggered ? 'text-alert' : 'text-ok'}`}>
                {parseFloat(row.stock_available_kg ?? 0).toFixed(2)} kg
              </span>
              <span className="mono text-muted">{parseFloat(row.stock_alert_kg ?? 0).toFixed(2)} kg</span>
              <span>
                <span
                  className="avail-badge"
                  style={{ '--c': AVAILABILITY_MODES.find((m) => m.value === row.availability_mode)?.color ?? '#aaa' }}
                >
                  {AVAILABILITY_MODES.find((m) => m.value === row.availability_mode)?.label ?? row.availability_mode}
                </span>
              </span>
              <span>
                {row.pending_reservations > 0 && (
                  <span className="res-count-badge">{row.pending_reservations} en attente</span>
                )}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => onEdit(row)}>
                Ajuster
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// MODAL D'AJUSTEMENT DE STOCK
// ─────────────────────────────────────────────

function StockEditModal({ product, onClose, onSaved }) {
  const [stockKg, setStockKg] = useState(String(product.stock_kg ?? 0))
  const [alertKg, setAlertKg] = useState(String(product.stock_alert_kg ?? 1))
  const [mode, setMode] = useState(product.availability_mode ?? 'available')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const sk = parseFloat(stockKg)
    const ak = parseFloat(alertKg)
    if (isNaN(sk) || sk < 0) return setError('Stock invalide.')
    if (isNaN(ak) || ak < 0) return setError('Seuil d\'alerte invalide.')

    setSaving(true)
    setError('')
    try {
      await updateProductStock(product.id, {
        stock_kg: sk,
        stock_alert_kg: ak,
        availability_mode: mode,
        // Rétrocompatibilité
        is_available: mode === 'available' || mode === 'pickup_only',
      })
      onSaved()
      onClose()
    } catch (e) {
      console.error(e)
      setError('Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h3>Ajuster le stock — {product.name}</h3>

        <div className="field">
          <label>Stock disponible (kg)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.1"
            value={stockKg}
            onChange={(e) => setStockKg(e.target.value)}
          />
          {parseFloat(product.stock_reserved_kg ?? 0) > 0 && (
            <p className="field-hint">
              {parseFloat(product.stock_reserved_kg).toFixed(2)} kg actuellement réservés
              — stock disponible réel : {Math.max(parseFloat(stockKg || 0) - parseFloat(product.stock_reserved_kg), 0).toFixed(2)} kg
            </p>
          )}
        </div>

        <div className="field">
          <label>Seuil d'alerte (kg)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.1"
            value={alertKg}
            onChange={(e) => setAlertKg(e.target.value)}
          />
          <p className="field-hint">Une alerte s'affiche quand le stock passe sous ce seuil.</p>
        </div>

        <div className="field">
          <label>Mode de disponibilité</label>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            {AVAILABILITY_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// GESTION DES RÉSERVATIONS
// ─────────────────────────────────────────────

function ReservationsPanel() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [actionId, setActionId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await fetchReservations(filter || null)
      setReservations(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  async function handleAccept(id) {
    setActionId(id)
    try {
      await acceptReservation(id)
      await load()
    } catch (e) {
      alert(e.message ?? 'Erreur lors de l\'acceptation.')
    }
    setActionId(null)
  }

  async function handleRefuse(id) {
    if (!confirm('Refuser cette réservation ?')) return
    setActionId(id)
    try {
      await refuseReservation(id)
      await load()
    } catch (e) {
      alert('Erreur lors du refus.')
    }
    setActionId(null)
  }

  const STATUS_LABELS = {
    pending:   { label: 'En attente', color: '#8a8a86' },
    accepted:  { label: 'Acceptée',   color: '#2f6b3a' },
    refused:   { label: 'Refusée',    color: '#b5181f' },
    cancelled: { label: 'Annulée',    color: '#b5181f' },
  }

  return (
    <div>
      <div className="filter-row">
        {[
          { value: 'pending',   label: 'En attente' },
          { value: 'accepted',  label: 'Acceptées' },
          { value: 'refused',   label: 'Refusées' },
          { value: '',          label: 'Toutes' },
        ].map((f) => (
          <button
            key={f.value}
            className={`filter-btn${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : reservations.length === 0 ? (
        <p className="text-muted empty-row">Aucune réservation trouvée.</p>
      ) : (
        <div className="res-table">
          <div className="res-table-header">
            <span>Date</span>
            <span>Client</span>
            <span>Produit</span>
            <span>Quantité</span>
            <span>Note</span>
            <span>Statut</span>
            <span>Actions</span>
          </div>
          {reservations.map((r) => {
            const sc = STATUS_LABELS[r.status] ?? { label: r.status, color: '#aaa' }
            return (
              <div key={r.id} className="res-row">
                <span className="text-muted mono-small">{formatDate(r.created_at)}</span>
                <div>
                  <p className="res-client-name">{r.customer_name}</p>
                  <p className="text-muted mono-small">{r.phone}</p>
                </div>
                <span>{r.products?.name ?? '—'}</span>
                <span className="mono">{parseFloat(r.quantity_kg).toFixed(2)} kg</span>
                <span className="text-muted" style={{ fontSize: 12 }}>{r.note ?? '—'}</span>
                <span>
                  <span className="status-dot" style={{ '--c': sc.color }}>
                    {sc.label}
                  </span>
                </span>
                <div className="row-actions">
                  {r.status === 'pending' && (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={actionId === r.id}
                        onClick={() => handleAccept(r.id)}
                      >
                        Accepter
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actionId === r.id}
                        onClick={() => handleRefuse(r.id)}
                      >
                        Refuser
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// HISTORIQUE DES MOUVEMENTS
// ─────────────────────────────────────────────

function MovementsPanel() {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStockMovements(null, 100)
      .then(setMovements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const REASON_LABELS = {
    order:              'Commande',
    reservation_accept: 'Réservation acceptée',
    manual_adjust:      'Ajustement manuel',
    refund:             'Remboursement / retour',
  }

  return (
    <div>
      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : movements.length === 0 ? (
        <p className="text-muted empty-row">Aucun mouvement enregistré.</p>
      ) : (
        <div className="mov-table">
          <div className="mov-table-header">
            <span>Date</span>
            <span>Produit</span>
            <span>Mouvement</span>
            <span>Stock après</span>
            <span>Motif</span>
            <span>Note</span>
          </div>
          {movements.map((m) => (
            <div key={m.id} className="mov-row">
              <span className="text-muted mono-small">{formatDate(m.created_at)}</span>
              <span>{m.products?.name ?? '—'}</span>
              <span className={`mono delta ${m.delta_kg >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                {m.delta_kg >= 0 ? '+' : ''}{parseFloat(m.delta_kg).toFixed(2)} kg
              </span>
              <span className="mono">{parseFloat(m.stock_after).toFixed(2)} kg</span>
              <span className="text-muted">{REASON_LABELS[m.reason] ?? m.reason}</span>
              <span className="text-muted" style={{ fontSize: 12 }}>{m.note ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────

export default function AdminStock() {
  const [subTab, setSubTab] = useState('overview')
  const [editProduct, setEditProduct] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleSaved() { setRefreshKey((k) => k + 1) }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Gestion des stocks</h2>
      </div>

      <div className="sub-tabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            className={`sub-tab-btn${subTab === t.id ? ' active' : ''}`}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="sub-tab-content">
        {subTab === 'overview' && (
          <StockOverview key={refreshKey} onEdit={setEditProduct} />
        )}
        {subTab === 'reservations' && <ReservationsPanel />}
        {subTab === 'movements'    && <MovementsPanel />}
      </div>

      {editProduct && (
        <StockEditModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={handleSaved}
        />
      )}

      <style>{`
        .admin-section { padding: 0 0 40px; }
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .section-header h2 { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 22px; letter-spacing: -0.3px; }
        .sub-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--color-border); margin-bottom: 24px; }
        .sub-tab-btn { padding: 10px 18px; font-size: 12.5px; font-weight: 600; background: none; border: none; border-bottom: 2px solid transparent; color: var(--color-text-muted); transition: all 0.2s; }
        .sub-tab-btn:hover { color: var(--color-text); }
        .sub-tab-btn.active { color: var(--color-text); border-bottom-color: var(--color-red); }

        /* Alertes */
        .stock-alerts-banner {
          display: flex; align-items: flex-start; gap: 12px;
          background: rgba(196,122,0,0.08); border: 1px solid rgba(196,122,0,0.3);
          padding: 14px 16px; margin-bottom: 20px; font-size: 13px; color: #7a5500;
        }
        .stock-alerts-banner svg { flex-shrink: 0; margin-top: 1px; }

        /* Tableau stocks */
        .stock-table { border: 1px solid var(--color-border); overflow-x: auto; }
        .stock-table-header, .stock-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1.8fr 1.2fr 80px;
          align-items: center; gap: 12px; padding: 12px 16px;
          font-size: 12.5px; min-width: 900px;
        }
        .stock-table-header {
          background: var(--color-paper-dim); font-family: var(--font-mono);
          font-weight: 700; color: var(--color-text-muted); font-size: 10px;
          letter-spacing: 1px; text-transform: uppercase;
        }
        .stock-row { border-top: 1px solid var(--color-border); }
        .stock-row-alert { background: rgba(196,122,0,0.04); }
        .stock-row-name { font-weight: 600; font-family: var(--font-heading); }
        .mono { font-family: var(--font-mono); font-size: 12px; }
        .text-ok { color: #2f6b3a; }
        .text-alert { color: #c47a00; font-weight: 700; }
        .avail-badge { font-family: var(--font-mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--c); }
        .res-count-badge { font-family: var(--font-mono); font-size: 10px; background: rgba(26,77,143,0.1); color: #1a4d8f; padding: 2px 7px; font-weight: 700; }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(10,10,10,0.6); z-index: 100; display: flex; align-items: flex-start; justify-content: center; padding: 24px; overflow-y: auto; }
        .modal { width: 100%; max-width: 480px; padding: 32px; background: var(--color-surface); border: 1px solid var(--color-border); }
        .modal h3 { font-family: var(--font-display); font-weight: 600; font-size: 18px; margin: 0 0 22px; }
        .field { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 11.5px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-muted); }
        .field-hint { font-size: 11.5px; color: var(--color-text-muted); margin: 0; }
        .form-error { color: var(--color-red); font-size: 13px; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
        .empty-row { padding: 20px 0; }

        /* Filtres */
        .filter-row { display: flex; gap: 4px; margin-bottom: 20px; flex-wrap: wrap; }
        .filter-btn { padding: 7px 14px; font-size: 12px; font-weight: 600; background: var(--color-paper-dim); border: 1px solid var(--color-border); color: var(--color-text-muted); transition: all 0.2s; }
        .filter-btn:hover, .filter-btn.active { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }

        /* Tableau réservations */
        .res-table { border: 1px solid var(--color-border); overflow-x: auto; }
        .res-table-header, .res-row {
          display: grid;
          grid-template-columns: 1.2fr 1.5fr 1.5fr 1fr 1.5fr 1fr 1.5fr;
          align-items: center; gap: 12px; padding: 12px 16px;
          font-size: 12.5px; min-width: 900px;
        }
        .res-table-header { background: var(--color-paper-dim); font-family: var(--font-mono); font-weight: 700; color: var(--color-text-muted); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
        .res-row { border-top: 1px solid var(--color-border); }
        .res-client-name { font-weight: 600; margin: 0 0 2px; font-size: 13px; }
        .mono-small { font-family: var(--font-mono); font-size: 11px; }
        .status-dot { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--c); }
        .row-actions { display: flex; gap: 6px; }
        .btn-success { background: #2f6b3a; color: #fff; border-color: #2f6b3a; }
        .btn-success:hover { background: transparent; color: #2f6b3a; }
        .btn-danger { background: var(--color-red); color: #fff; border-color: var(--color-red); }
        .btn-danger:hover { background: transparent; color: var(--color-red); }

        /* Tableau mouvements */
        .mov-table { border: 1px solid var(--color-border); overflow-x: auto; }
        .mov-table-header, .mov-row {
          display: grid;
          grid-template-columns: 1.2fr 1.5fr 1fr 1fr 1.5fr 2fr;
          align-items: center; gap: 12px; padding: 12px 16px;
          font-size: 12.5px; min-width: 800px;
        }
        .mov-table-header { background: var(--color-paper-dim); font-family: var(--font-mono); font-weight: 700; color: var(--color-text-muted); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
        .mov-row { border-top: 1px solid var(--color-border); }
        .delta { font-weight: 700; }
        .delta-pos { color: #2f6b3a; }
        .delta-neg { color: var(--color-red); }
      `}</style>
    </div>
  )
}
