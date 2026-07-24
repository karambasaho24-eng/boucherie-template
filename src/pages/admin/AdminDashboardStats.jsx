// ============================================================
// src/pages/admin/AdminDashboardStats.jsx  (REMPLACEMENT COMPLET)
// Tableau de bord professionnel :
// - Filtres de période (7j / 30j / 3 mois / personnalisé)
// - Comparaison avec la période précédente équivalente
// - Graphique CA + nombre de commandes combinés, barres/courbe
// - Répartition du CA par catégorie de produit
// - Activité par jour de la semaine et par heure
// - Export CSV des données affichées
// - Enregistrement de performances (snapshots figés)
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import {
  fetchDashboardStats,
  fetchTopProducts,
  fetchRevenueByDay,
  fetchTopCustomers,
  fetchRevenueByCategory,
  fetchOrdersByWeekday,
  fetchOrdersByHour,
  saveSnapshot,
} from '../../lib/api'
import { fetchStockDashboard } from '../../lib/stockApi'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const PERIODS = [
  { id: '7d',  label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '3m',  label: '3 mois' },
  { id: 'custom', label: 'Personnalisé' },
]

function formatEUR(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

function computeRange(periodId, customStart, customEnd) {
  const today = new Date()
  const end = new Date(today)
  let start = new Date(today)

  if (periodId === '7d') start.setDate(start.getDate() - 6)
  else if (periodId === '30d') start.setDate(start.getDate() - 29)
  else if (periodId === '3m') start.setMonth(start.getMonth() - 3)
  else if (periodId === 'custom' && customStart && customEnd) {
    return { start: customStart, end: customEnd, prevStart: null, prevEnd: null }
  }

  const startISO = toISODate(start)
  const endISO = toISODate(end)

  const spanDays = Math.round((end - start) / 86400000) + 1
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - spanDays + 1)

  return { start: startISO, end: endISO, prevStart: toISODate(prevStart), prevEnd: toISODate(prevEnd) }
}

function StatCard({ label, value, sub, trend, accent }) {
  const isUp = trend && trend.value >= 0
  return (
    <div className={`stat-card${accent ? ' accent' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {sub && <span className="stat-sub">{sub}</span>}
        {trend && (
          <span className={`stat-trend ${isUp ? 'up' : 'down'}`}>
            {isUp ? '▲' : '▼'}{' '}
            {trend.kind === 'pct'
              ? `${Math.abs(trend.value).toFixed(0)}%`
              : `${Math.abs(trend.value)}`}
          </span>
        )}
      </div>
    </div>
  )
}

function RevenueChart({ data }) {
  const [mode, setMode] = useState('bars')
  const [showOrders, setShowOrders] = useState(true)
  const [hovered, setHovered] = useState(null)

  if (!data || data.length === 0) {
    return <p className="text-muted" style={{ fontSize: 13 }}>Pas encore de données sur cette période.</p>
  }

  const width = 760
  const height = 260
  const padLeft = 56
  const padBottom = 26
  const padTop = 14
  const plotW = width - padLeft - 10
  const plotH = height - padTop - padBottom

  const maxRevenue = Math.max(...data.map((d) => Number(d.revenue)), 1)
  const maxOrders = Math.max(...data.map((d) => Number(d.orders_count)), 1)

  const niceMax = (() => {
    const raw = maxRevenue * 1.15
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw || 1)))
    const steps = [1, 2, 2.5, 5, 10]
    for (const s of steps) {
      if (raw <= s * magnitude) return s * magnitude
    }
    return 10 * magnitude
  })()
  const ySteps = 4
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => Math.round((niceMax / ySteps) * i))

  function xFor(i) {
    if (data.length === 1) return padLeft + plotW / 2
    return padLeft + (i / (data.length - 1)) * plotW
  }
  function yFor(value) {
    return padTop + plotH - (value / niceMax) * plotH
  }
  function yForOrders(value) {
    return padTop + plotH - (value / maxOrders) * plotH
  }

  const barSlot = plotW / data.length
  const barWidth = Math.min(Math.max(barSlot - 8, 3), 36)

  const linePoints = data.map((d, i) => `${xFor(i)},${yFor(Number(d.revenue))}`).join(' ')
  const areaPoints = `${padLeft},${padTop + plotH} ${linePoints} ${padLeft + plotW},${padTop + plotH}`
  const orderLinePoints = data.map((d, i) => `${xFor(i)},${yForOrders(Number(d.orders_count))}`).join(' ')

  const labelStride = Math.ceil(data.length / 8)

  return (
    <div className="revenue-chart-wrap">
      <div className="chart-controls">
        <div className="chart-toggle">
          <button className={`chart-toggle-btn${mode === 'bars' ? ' active' : ''}`} onClick={() => setMode('bars')}>Barres</button>
          <button className={`chart-toggle-btn${mode === 'line' ? ' active' : ''}`} onClick={() => setMode('line')}>Courbe</button>
        </div>
        <label className="chart-checkbox">
          <input type="checkbox" checked={showOrders} onChange={(e) => setShowOrders(e.target.checked)} />
          Afficher le nombre de commandes
        </label>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="revenue-chart" preserveAspectRatio="xMidYMid meet">
        {yLabels.map((val, i) => (
          <line key={`gl-${i}`} x1={padLeft} y1={yFor(val)} x2={width - 10} y2={yFor(val)} className="grid-line" />
        ))}

        {mode === 'bars' ? (
          data.map((d, i) => {
            const x = xFor(i) - barWidth / 2
            const y = yFor(Number(d.revenue))
            const h = padTop + plotH - y
            return (
              <rect
                key={d.day}
                x={x} y={y} width={barWidth} height={Math.max(h, 1.5)}
                className={`revenue-bar${hovered === i ? ' hovered' : ''}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })
        ) : (
          <>
            <polygon points={areaPoints} className="revenue-area" />
            <polyline points={linePoints} className="revenue-line" />
            {data.map((d, i) => (
              <circle
                key={d.day}
                cx={xFor(i)} cy={yFor(Number(d.revenue))} r={hovered === i ? 5 : 3}
                className="revenue-dot"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </>
        )}

        {showOrders && (
          <polyline points={orderLinePoints} className="orders-line" />
        )}

        {data.map((d, i) => (
          <rect
            key={`hit-${d.day}`}
            x={xFor(i) - barSlot / 2} y={padTop} width={barSlot} height={plotH}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}

        <line x1={padLeft} y1={padTop + plotH} x2={width - 10} y2={padTop + plotH} className="revenue-axis" />
        {(() => {
          // Distance minimale en pixels entre deux labels pour éviter la superposition
          const MIN_PX = 38
          let lastX = -Infinity
          return data.map((d, i) => {
            const x = xFor(i)
            // Toujours afficher le premier label
            if (i !== 0 && x - lastX < MIN_PX) return null
            // Ne pas afficher si trop proche de la fin (évite superposition avec le dernier)
            const distToEnd = xFor(data.length - 1) - x
            if (i !== data.length - 1 && distToEnd > 0 && distToEnd < MIN_PX) return null
            lastX = x
            const dateLabel = new Date(d.day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
            return (
              <text key={d.day} x={x} y={height - 6} textAnchor="middle" className="axis-label-x">
                {dateLabel}
              </text>
            )
          })
        })()}

        {hovered !== null && (
          <line x1={xFor(hovered)} y1={padTop} x2={xFor(hovered)} y2={padTop + plotH} className="hover-line" />
        )}

        {yLabels.map((val, i) => (
          <g key={`yl-${i}`}>
            <rect x={0} y={yFor(val) - 9} width={padLeft - 6} height={16} className="axis-label-bg" />
            <text x={padLeft - 10} y={yFor(val) + 3} textAnchor="end" className="axis-label">
              {val >= 1000 ? `${Math.round(val / 100) / 10}k€` : `${val}€`}
            </text>
          </g>
        ))}
      </svg>

      <div className="chart-legend">
        <span className="legend-item"><span className="legend-dot legend-dot-revenue" /> Chiffre d'affaires</span>
        {showOrders && <span className="legend-item"><span className="legend-dot legend-dot-orders" /> Nombre de commandes</span>}
      </div>

      {hovered !== null && (
        <div className="chart-tooltip" style={{ left: `${(xFor(hovered) / width) * 100}%` }}>
          <strong>{formatEUR(data[hovered].revenue)}</strong>
          <span>{new Date(data[hovered].day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}</span>
          <span className="text-muted">{data[hovered].orders_count} commande{data[hovered].orders_count > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

function CategoryBars({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-muted" style={{ fontSize: 13 }}>Aucune vente sur cette période.</p>
  }
  const total = data.reduce((s, c) => s + Number(c.total_revenue), 0) || 1
  const max = Math.max(...data.map((c) => Number(c.total_revenue)), 1)

  return (
    <div className="category-bars">
      {data.map((c) => {
        const pct = (Number(c.total_revenue) / total) * 100
        const barPct = (Number(c.total_revenue) / max) * 100
        return (
          <div key={c.category} className="category-row">
            <div className="category-row-head">
              <span className="category-name">{c.category}</span>
              <span className="category-value">{formatEUR(c.total_revenue)} · {pct.toFixed(0)}%</span>
            </div>
            <div className="category-track">
              <div className="category-fill" style={{ width: `${barPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
function WeekdayHeatmap({ weekdayData, hourData }) {
  const maxWeekday = Math.max(...weekdayData.map((d) => Number(d.order_count)), 1)
  const maxHour = Math.max(...hourData.map((d) => Number(d.order_count)), 1)

  const fullWeek = WEEKDAY_LABELS.map((label, i) => {
    const found = weekdayData.find((d) => Number(d.weekday) === i + 1)
    return { label, count: found ? Number(found.order_count) : 0 }
  })

  const fullDay = Array.from({ length: 24 }, (_, h) => {
    const found = hourData.find((d) => Number(d.hour_of_day) === h)
    return { hour: h, count: found ? Number(found.order_count) : 0 }
  })

  return (
    <div className="activity-grid">
      <div>
        <p className="activity-subtitle">Par jour de la semaine</p>
        <div className="weekday-bars">
          {fullWeek.map((d) => (
            <div key={d.label} className="weekday-col">
              <div className="weekday-bar-track">
                <div className="weekday-bar-fill" style={{ height: `${(d.count / maxWeekday) * 100}%` }} title={`${d.count} commande${d.count > 1 ? 's' : ''}`} />
              </div>
              <span className="weekday-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="activity-subtitle">Par heure de la journée</p>
        <div className="hour-bars">
          {fullDay.map((d) => (
            <div
              key={d.hour}
              className="hour-cell"
              style={{ opacity: d.count === 0 ? 0.08 : 0.15 + (d.count / maxHour) * 0.85 }}
              title={`${d.hour}h : ${d.count} commande${d.count > 1 ? 's' : ''}`}
            />
          ))}
        </div>
        <div className="hour-axis">
          <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboardStats() {
  const [period, setPeriod] = useState('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [stats, setStats] = useState(null)
  const [prevStats, setPrevStats] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [revenueByDay, setRevenueByDay] = useState([])
  const [revenueByCategory, setRevenueByCategory] = useState([])
  const [weekdayData, setWeekdayData] = useState([])
  const [hourData, setHourData] = useState([])
  const [stockDashboard, setStockDashboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const range = useMemo(
    () => computeRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  )

  async function loadAll() {
    if (period === 'custom' && (!customStart || !customEnd)) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { start, end, prevStart, prevEnd } = range

      const [
        statsData, products, customers, revenue, category, weekday, hour, stock,
      ] = await Promise.all([
        fetchDashboardStats(start, end),
        fetchTopProducts(start, end, 8),
        fetchTopCustomers(start, end, 8),
        fetchRevenueByDay(start, end),
        fetchRevenueByCategory(start, end),
        fetchOrdersByWeekday(start, end),
        fetchOrdersByHour(start, end),
        fetchStockDashboard().catch(() => []),
      ])

      setStats(statsData)
      setTopProducts(products)
      setTopCustomers(customers)
      setRevenueByDay(revenue)
      setRevenueByCategory(category)
      setWeekdayData(weekday)
      setHourData(hour)
      setStockDashboard(stock || [])

      if (prevStart && prevEnd) {
        const prev = await fetchDashboardStats(prevStart, prevEnd)
        setPrevStats(prev)
      } else {
        setPrevStats(null)
      }
    } catch (e) {
      console.error(e)
      setError('Impossible de charger les statistiques.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 60000)
    return () => clearInterval(interval)
  }, [period, customStart, customEnd])

  function trendPct(current, previous) {
    if (previous === null || previous === undefined) return null
    const delta = current - previous
    if (previous < 5) {
      return { kind: 'delta', value: delta }
    }
    const pct = (delta / previous) * 100
    return { kind: 'pct', value: Math.max(Math.min(pct, 999), -999) }
  }

  function handleExportCSV() {
    const rows = [
      ['Date', 'Chiffre affaires (€)', 'Nombre de commandes'],
      ...revenueByDay.map((d) => [d.day, Number(d.revenue).toFixed(2), d.orders_count]),
    ]
    const csv = rows.map((r) => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `statistiques_${range.start}_${range.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false)
  const [snapshotTitle, setSnapshotTitle] = useState('')
  const [snapshotDesc, setSnapshotDesc] = useState('')
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [snapshotSaved, setSnapshotSaved] = useState(false)

  function openSnapshotModal() {
    const todayLabel = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    setSnapshotTitle(`Performance du ${todayLabel}`)
    setSnapshotDesc('')
    setSnapshotSaved(false)
    setSnapshotModalOpen(true)
  }

  async function handleSaveSnapshot() {
    if (!snapshotTitle.trim()) return
    setSavingSnapshot(true)
    try {
      await saveSnapshot({
        title: snapshotTitle.trim(),
        description: snapshotDesc.trim(),
        periodStart: range.start,
        periodEnd: range.end,
        data: {
          stats,
          prevStats,
          revenueByDay,
          topProducts,
          topCustomers,
          revenueByCategory,
          weekdayData,
          hourData,
        },
      })
      setSnapshotSaved(true)
      setTimeout(() => setSnapshotModalOpen(false), 1200)
    } catch (e) {
      console.error(e)
      alert("Erreur lors de l'enregistrement de la performance.")
    } finally {
      setSavingSnapshot(false)
    }
  }

  if (loading && !stats) return <p className="text-muted">Chargement des statistiques…</p>
  if (error) return <p className="error-msg">{error}</p>

  const lowStock = stockDashboard.filter((p) => p.alert_triggered)

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>Tableau de bord</h2>
        <div className="header-actions">
          <button className="btn btn-ghost btn-sm" onClick={openSnapshotModal}>Enregistrer une performance</button>
          <button className="btn btn-ghost btn-sm" onClick={handleExportCSV}>Exporter en CSV</button>
        </div>
      </div>

      <div className="period-bar">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            className={`period-btn${period === p.id ? ' active' : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="period-custom">
            <input type="date" className="input input-sm" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span className="text-muted">→</span>
            <input type="date" className="input input-sm" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
      </div>

      {period === 'custom' && (!customStart || !customEnd) ? (
        <p className="text-muted" style={{ marginTop: 16 }}>Choisissez une date de début et de fin.</p>
      ) : (
        <>
          <div className="stats-grid">
            <StatCard
              label="Chiffre d'affaires"
              value={formatEUR(stats?.total_revenue)}
              sub={`${stats?.paid_orders ?? 0} commande${stats?.paid_orders === 1 ? '' : 's'} payée${stats?.paid_orders === 1 ? '' : 's'}`}
              trend={prevStats ? trendPct(stats?.total_revenue, prevStats?.total_revenue) : null}
              accent
            />
            <StatCard
              label="Panier moyen"
              value={formatEUR(stats?.avg_order_value)}
              trend={prevStats ? trendPct(stats?.avg_order_value, prevStats?.avg_order_value) : null}
            />
            <StatCard
              label="Clients"
              value={stats?.unique_customers ?? 0}
              sub="numéros distincts"
              trend={prevStats ? trendPct(stats?.unique_customers, prevStats?.unique_customers) : null}
            />
            <StatCard
              label="Commandes"
              value={stats?.total_orders ?? 0}
              sub={`${stats?.pending_orders ?? 0} en attente · ${stats?.confirmed_orders ?? 0} confirmée${stats?.confirmed_orders === 1 ? '' : 's'}`}
              trend={prevStats ? trendPct(stats?.total_orders, prevStats?.total_orders) : null}
            />
            <StatCard
              label="Produits en alerte stock"
              value={lowStock.length}
              sub={lowStock.length > 0 ? lowStock.slice(0, 3).map((p) => p.name).join(', ') : 'Tout va bien'}
            />
          </div>

          {prevStats && (
            <p className="compare-note text-muted">
              Comparé à la période précédente équivalente ({range.prevStart} → {range.prevEnd})
            </p>
          )}

          <div className="dash-block">
            <h4>Chiffre d'affaires &amp; commandes</h4>
            <RevenueChart data={revenueByDay} />
          </div>

          <div className="dash-columns">
            <div className="dash-block">
              <h4>Répartition par catégorie</h4>
              <CategoryBars data={revenueByCategory} />
            </div>

            <div className="dash-block">
              <h4>Activité</h4>
              <WeekdayHeatmap weekdayData={weekdayData} hourData={hourData} />
            </div>
          </div>

          <div className="dash-columns">
            <div className="dash-block">
              <h4>Produits les plus vendus</h4>
              {topProducts.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>Aucune vente sur cette période.</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr><th>Produit</th><th>Qté vendue</th><th>CA généré</th></tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p) => (
                      <tr key={p.product_id || p.product_name}>
                        <td>{p.product_name}</td>
                        <td>{Number(p.total_qty_kg).toFixed(2)} kg</td>
                        <td>{formatEUR(p.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="dash-block">
              <h4>Meilleurs clients</h4>
              {topCustomers.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>Aucun client sur cette période.</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr><th>Client</th><th>Commandes</th><th>Total dépensé</th></tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c) => (
                      <tr key={c.phone}>
                        <td>{c.customer_name}<br /><span className="text-muted mono-sm">{c.phone}</span></td>
                        <td>{c.order_count}</td>
                        <td>{formatEUR(c.total_spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {snapshotModalOpen && (
        <div className="modal-overlay" onClick={() => setSnapshotModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Enregistrer cette performance</h3>
            <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8 }}>
              Figez l'état actuel du tableau de bord ({range.start} → {range.end}) pour le retrouver à vie dans vos performances enregistrées.
            </p>

            {snapshotSaved ? (
              <p className="config-success" style={{ marginTop: 16 }}>Performance enregistrée ✓</p>
            ) : (
              <>
                <div className="field">
                  <label>Titre</label>
                  <input className="input" value={snapshotTitle} onChange={(e) => setSnapshotTitle(e.target.value)} placeholder="Ex : Très bon mois de décembre" />
                </div>
                <div className="field">
                  <label>Description (optionnel)</label>
                  <textarea className="textarea" rows={3} value={snapshotDesc} onChange={(e) => setSnapshotDesc(e.target.value)} placeholder="Notes, contexte particulier, objectif atteint..." />
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => setSnapshotModalOpen(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={handleSaveSnapshot} disabled={savingSnapshot || !snapshotTitle.trim()}>
                    {savingSnapshot ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .period-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 22px; }
        .period-btn { padding: 7px 14px; font-size: 12px; font-weight: 600; border: 1px solid var(--color-border); background: var(--color-paper-dim); color: var(--color-text-muted); transition: all 0.2s; }
        .period-btn:hover { color: var(--color-text); }
        .period-btn.active { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }
        .period-custom { display: flex; align-items: center; gap: 8px; margin-left: 4px; }
        .input-sm { padding: 7px 10px; font-size: 12px; width: auto; }
        .compare-note { font-size: 11.5px; margin: -8px 0 18px; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1px;
          background: var(--color-border);
          border: 1px solid var(--color-border);
          margin-bottom: 12px;
        }
        .stat-card { background: var(--color-surface); padding: 18px 20px; }
        .stat-card.accent { background: var(--color-ink); color: var(--color-paper); }
        .stat-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); margin-bottom: 8px; }
        .stat-card.accent .stat-label { color: rgba(250,249,246,0.55); }
        .stat-value { font-family: var(--font-mono); font-size: 24px; font-weight: 700; line-height: 1.1; }
        .stat-foot { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
        .stat-sub { font-size: 11.5px; color: var(--color-text-muted); }
        .stat-card.accent .stat-sub { color: rgba(250,249,246,0.6); }
        .stat-trend { font-size: 11px; font-weight: 700; font-family: var(--font-mono); }
        .stat-trend.up { color: #2f6b3a; }
        .stat-trend.down { color: var(--color-red); }
        .stat-card.accent .stat-trend.up { color: #6fcf87; }
        .stat-card.accent .stat-trend.down { color: #ff8a82; }

        .dash-block { background: var(--color-surface); border: 1px solid var(--color-border); padding: 20px; margin-bottom: 20px; }
        .dash-block h4 { margin: 0 0 16px; font-family: var(--font-display); font-weight: 600; font-size: 15px; }

        .dash-columns { display: grid; grid-template-columns: 1fr; gap: 20px; }

        .revenue-chart-wrap { position: relative; }
        .chart-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .chart-toggle { display: flex; gap: 6px; }
        .chart-toggle-btn { padding: 6px 14px; font-size: 11.5px; font-weight: 600; border: 1px solid var(--color-border); background: var(--color-paper-dim); color: var(--color-text-muted); transition: all 0.2s; }
        .chart-toggle-btn:hover { color: var(--color-text); }
        .chart-toggle-btn.active { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }
        .chart-checkbox { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--color-text-muted); cursor: pointer; }
        .revenue-chart { width: 100%; height: 260px; display: block; overflow: visible; }
        .grid-line { stroke: var(--color-border); stroke-width: 1; }
        .axis-label-bg { fill: var(--color-surface); }
        .axis-label { font-family: var(--font-mono); font-size: 10px; fill: var(--color-text-muted); }
        .axis-label-x { font-family: var(--font-mono); font-size: 9.5px; fill: var(--color-text-muted); }
        .revenue-bar { fill: var(--color-ink); opacity: 0.85; transition: opacity 0.15s; cursor: pointer; }
        .revenue-bar.hovered { opacity: 1; fill: var(--color-red); }
        .revenue-area { fill: var(--color-red); opacity: 0.08; }
        .revenue-line { fill: none; stroke: var(--color-red); stroke-width: 2; }
        .revenue-dot { fill: var(--color-surface); stroke: var(--color-red); stroke-width: 2; cursor: pointer; transition: r 0.15s; }
        .orders-line { fill: none; stroke: var(--color-text-muted); stroke-width: 1.5; stroke-dasharray: 4 3; }
        .revenue-axis { stroke: var(--color-border); stroke-width: 1; }
        .hover-line { stroke: var(--color-text-muted); stroke-width: 1; stroke-dasharray: 3 3; pointer-events: none; }
        .chart-legend { display: flex; gap: 16px; margin-top: 10px; font-size: 11.5px; color: var(--color-text-muted); }
        .legend-item { display: flex; align-items: center; gap: 6px; }
        .legend-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
        .legend-dot-revenue { background: var(--color-red); }
        .legend-dot-orders { background: var(--color-text-muted); }
        .chart-tooltip {
          position: absolute;
          top: 6px;
          transform: translateX(-50%);
          background: var(--color-ink);
          color: var(--color-paper);
          padding: 8px 12px;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          pointer-events: none;
          white-space: nowrap;
          z-index: 2;
          box-shadow: var(--shadow-lg);
        }
        .chart-tooltip strong { font-family: var(--font-mono); font-size: 13px; }
        .chart-tooltip .text-muted { color: rgba(250,249,246,0.55); font-size: 10.5px; }

        .category-bars { display: flex; flex-direction: column; gap: 14px; }
        .category-row-head { display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 6px; }
        .category-name { font-weight: 600; text-transform: capitalize; }
        .category-value { font-family: var(--font-mono); font-size: 11.5px; color: var(--color-text-muted); }
        .category-track { height: 8px; background: var(--color-paper-dim); border: 1px solid var(--color-border); }
        .category-fill { height: 100%; background: var(--color-red); transition: width 0.4s ease; }

        .activity-grid { display: flex; flex-direction: column; gap: 24px; }
        .activity-subtitle { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); margin: 0 0 12px; }
        .weekday-bars { display: flex; align-items: flex-end; gap: 8px; height: 90px; }
        .weekday-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
        .weekday-bar-track { width: 100%; height: 70px; display: flex; align-items: flex-end; }
        .weekday-bar-fill { width: 100%; background: var(--color-ink); min-height: 2px; transition: height 0.3s ease; }
        .weekday-label { font-size: 10.5px; color: var(--color-text-muted); font-family: var(--font-mono); }
        .hour-bars { display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; height: 28px; }
        .hour-cell { background: var(--color-red); border-radius: 1px; }
        .hour-axis { display: flex; justify-content: space-between; margin-top: 6px; font-size: 10px; color: var(--color-text-muted); font-family: var(--font-mono); }

        .dash-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .dash-table th { text-align: left; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-muted); padding: 0 8px 10px 0; border-bottom: 1px solid var(--color-border); }
        .dash-table td { padding: 9px 8px 9px 0; border-bottom: 1px solid var(--color-border); vertical-align: top; }
        .dash-table tr:last-child td { border-bottom: none; }
        .mono-sm { font-family: var(--font-mono); font-size: 11px; }

        @media (min-width: 640px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1024px) {
          .dash-columns { grid-template-columns: 1fr 1fr; }
        }

        .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(10,10,10,0.55);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 100;
        }
        .modal-card {
          background: var(--color-surface); border: 1px solid var(--color-border);
          padding: 28px; max-width: 440px; width: 100%;
        }
        .modal-card h3 { margin: 0 0 6px; font-family: var(--font-display); font-weight: 600; font-size: 19px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
      `}</style>
    </div>
  )
}
