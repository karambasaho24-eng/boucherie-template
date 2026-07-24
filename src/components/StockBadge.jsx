// ============================================================
// src/components/StockBadge.jsx
// Badge d'affichage du statut de disponibilité (côté client)
// ============================================================

export default function StockBadge({ product, compact = false }) {
  if (!product) return null

  const {
    stock_enabled,
    stock_kg = 0,
    stock_reserved_kg = 0,
    stock_alert_kg = 1,
    availability_mode = 'available',
  } = product

  const availableKg = stock_enabled
    ? Math.max(stock_kg - stock_reserved_kg, 0)
    : null

  // Calcule le statut effectif
  let status = availability_mode
  if (status === 'available' && stock_enabled) {
    if (availableKg <= 0) status = 'out_of_stock'
    else if (availableKg <= stock_alert_kg) status = 'low_stock'
  }

  const BADGE_CONFIG = {
    available: {
      label: compact ? 'En stock' : 'En stock',
      dot: '#2f6b3a',
      bg: 'rgba(47,107,58,0.1)',
      color: '#2f6b3a',
    },
    low_stock: {
      label: compact
        ? `Stock faible`
        : `Stock faible (${availableKg?.toFixed(2)} kg)`,
      dot: '#c47a00',
      bg: 'rgba(196,122,0,0.1)',
      color: '#c47a00',
    },
    out_of_stock: {
      label: 'Rupture de stock',
      dot: '#b5181f',
      bg: 'rgba(181,24,31,0.08)',
      color: '#b5181f',
    },
    reservation_only: {
      label: compact ? 'Sur réservation' : 'Disponible sur réservation',
      dot: '#1a4d8f',
      bg: 'rgba(26,77,143,0.08)',
      color: '#1a4d8f',
    },
    pickup_only: {
      label: compact ? 'Retrait boutique' : 'Retrait boutique uniquement',
      dot: '#7a5500',
      bg: 'rgba(122,85,0,0.08)',
      color: '#7a5500',
    },
    disabled: {
      label: 'Indisponible',
      dot: '#8a8a86',
      bg: 'rgba(138,138,134,0.1)',
      color: '#8a8a86',
    },
  }

  const cfg = BADGE_CONFIG[status] ?? BADGE_CONFIG.available

  return (
    <span
      className="stock-badge"
      style={{ '--dot': cfg.dot, '--bg': cfg.bg, '--color': cfg.color }}
    >
      <span className="stock-badge-dot" />
      {cfg.label}

      <style>{`
        .stock-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--color);
          background: var(--bg);
          padding: 3px 8px 3px 6px;
          white-space: nowrap;
        }
        .stock-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--dot);
          flex-shrink: 0;
        }
      `}</style>
    </span>
  )
}
