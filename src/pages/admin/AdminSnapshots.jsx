// ============================================================
// src/pages/admin/AdminSnapshots.jsx  (NOUVEAU FICHIER)
// ============================================================

import { useEffect, useState } from 'react'
import { fetchSnapshots, fetchSnapshotById, deleteSnapshot } from '../../lib/api'

function formatEUR(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function formatDateTime(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SnapshotDetail({ snapshot, onClose }) {
  const d = snapshot.data || {}
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="snapshot-detail-header">
          <div>
            <h3>{snapshot.title}</h3>
            <p className="text-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
              Période {snapshot.period_start} → {snapshot.period_end} · enregistré le {formatDateTime(snapshot.created_at)}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fermer</button>
        </div>

        {snapshot.description && <p className="snapshot-desc">{snapshot.description}</p>}

        <div className="snap-stats-grid">
          <div className="snap-stat"><span className="snap-stat-label">CA</span><strong>{formatEUR(d.stats?.total_revenue)}</strong></div>
          <div className="snap-stat"><span className="snap-stat-label">Panier moyen</span><strong>{formatEUR(d.stats?.avg_order_value)}</strong></div>
          <div className="snap-stat"><span className="snap-stat-label">Commandes</span><strong>{d.stats?.total_orders ?? 0}</strong></div>
          <div className="snap-stat"><span className="snap-stat-label">Clients</span><strong>{d.stats?.unique_customers ?? 0}</strong></div>
        </div>

        {d.topProducts?.length > 0 && (
          <div className="snap-section">
            <h4>Produits les plus vendus</h4>
            <table className="dash-table">
              <thead><tr><th>Produit</th><th>Qté</th><th>CA</th></tr></thead>
              <tbody>
                {d.topProducts.map((p) => (
                  <tr key={p.product_id || p.product_name}>
                    <td>{p.product_name}</td>
                    <td>{Number(p.total_qty_kg).toFixed(2)} kg</td>
                    <td>{formatEUR(p.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {d.topCustomers?.length > 0 && (
          <div className="snap-section">
            <h4>Meilleurs clients</h4>
            <table className="dash-table">
              <thead><tr><th>Client</th><th>Commandes</th><th>Total</th></tr></thead>
              <tbody>
                {d.topCustomers.map((c) => (
                  <tr key={c.phone}>
                    <td>{c.customer_name}</td>
                    <td>{c.order_count}</td>
                    <td>{formatEUR(c.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {d.revenueByCategory?.length > 0 && (
          <div className="snap-section">
            <h4>Répartition par catégorie</h4>
            {d.revenueByCategory.map((c) => (
              <div key={c.category} className="snap-category-row">
                <span>{c.category}</span>
                <span className="mono-sm">{formatEUR(c.total_revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(10,10,10,0.55); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 100; overflow-y: auto; }
        .modal-card { background: var(--color-surface); border: 1px solid var(--color-border); padding: 28px; max-width: 440px; width: 100%; }
        .modal-card-wide { max-width: 640px; max-height: 86vh; overflow-y: auto; }
        .snapshot-detail-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
        .snapshot-detail-header h3 { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 19px; }
        .snapshot-desc { font-size: 13px; color: var(--color-text-muted); background: var(--color-paper-dim); padding: 10px 14px; border: 1px solid var(--color-border); margin: 0 0 18px; }
        .snap-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: var(--color-border); border: 1px solid var(--color-border); margin-bottom: 22px; }
        .snap-stat { background: var(--color-surface); padding: 12px 14px; }
        .snap-stat-label { display: block; font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-muted); margin-bottom: 4px; }
        .snap-section { margin-bottom: 20px; }
        .snap-section h4 { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-red); margin: 0 0 10px; }
        .snap-category-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid var(--color-border); }
        .mono-sm { font-family: var(--font-mono); font-size: 11px; }
        .dash-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .dash-table th { text-align: left; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-muted); padding: 0 8px 8px 0; border-bottom: 1px solid var(--color-border); }
        .dash-table td { padding: 7px 8px 7px 0; border-bottom: 1px solid var(--color-border); }
        .dash-table tr:last-child td { border-bottom: none; }
        @media (min-width: 640px) { .snap-stats-grid { grid-template-columns: repeat(4, 1fr); } }
      `}</style>
    </div>
  )
}

export default function AdminSnapshots() {
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function load() {
    try {
      const data = await fetchSnapshots()
      setSnapshots(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function openDetail(id) {
    setLoadingDetail(true)
    try {
      const full = await fetchSnapshotById(id)
      setSelected(full)
    } catch (e) {
      console.error(e)
      alert('Impossible de charger cette performance.')
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation()
    if (!confirm('Supprimer définitivement cette performance enregistrée ?')) return
    try {
      await deleteSnapshot(id)
      setSnapshots((prev) => prev.filter((s) => s.id !== id))
    } catch {
      alert('Erreur lors de la suppression.')
    }
  }

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Performances enregistrées</h2>
      </div>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : snapshots.length === 0 ? (
        <p className="text-muted">
          Aucune performance enregistrée pour le moment. Depuis le Tableau de bord, cliquez sur « Enregistrer une performance » pour figer un instantané que vous pourrez retrouver ici à tout moment.
        </p>
      ) : (
        <div className="snapshots-list">
          {snapshots.map((s) => (
            <div key={s.id} className="snapshot-card" onClick={() => openDetail(s.id)}>
              <div className="snapshot-card-main">
                <p className="snapshot-card-title">{s.title}</p>
                {s.description && <p className="snapshot-card-desc">{s.description}</p>}
                <p className="snapshot-card-meta">
                  Période {s.period_start} → {s.period_end} · enregistré le {formatDateTime(s.created_at)}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm snapshot-delete-btn" onClick={(e) => handleDelete(s.id, e)}>
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}

      {loadingDetail && <p className="text-muted" style={{ marginTop: 12 }}>Chargement de la performance…</p>}
      {selected && <SnapshotDetail snapshot={selected} onClose={() => setSelected(null)} />}

      <style>{`
        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .section-header h2 { margin: 0; font-family: var(--font-display); font-weight: 600; font-size: 22px; letter-spacing: -0.3px; }
        .snapshots-list { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--color-border); }
        .snapshot-card { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 16px 18px; border-bottom: 1px solid var(--color-border); cursor: pointer; transition: background 0.15s; }
        .snapshot-card:last-child { border-bottom: none; }
        .snapshot-card:hover { background: var(--color-paper-dim); }
        .snapshot-card-title { font-weight: 700; font-size: 14px; margin: 0 0 4px; }
        .snapshot-card-desc { font-size: 12.5px; color: var(--color-text-muted); margin: 0 0 6px; }
        .snapshot-card-meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--color-text-muted); margin: 0; }
        .snapshot-delete-btn { color: var(--color-red); flex-shrink: 0; }
      `}</style>
    </div>
  )
}
