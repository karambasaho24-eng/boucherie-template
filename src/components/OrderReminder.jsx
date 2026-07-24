import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const ACTIVE_ORDER_KEY = 'boucherie_active_order'

export function rememberActiveOrder(orderId) {
  try {
    localStorage.setItem(ACTIVE_ORDER_KEY, orderId)
  } catch {
    // Stockage indisponible — le rappel ne s'affichera simplement pas, sans bloquer le reste
  }
}

export function clearActiveOrder() {
  try {
    localStorage.removeItem(ACTIVE_ORDER_KEY)
  } catch {
    // rien à faire si indisponible
  }
}

export default function OrderReminder() {
  const [orderId, setOrderId] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_ORDER_KEY)
      setOrderId(saved || null)
    } catch {
      setOrderId(null)
    }
  }, [location.pathname])

  const isOnOrderPage = location.pathname === `/commande/${orderId}`
  if (!orderId || dismissed || isOnOrderPage) return null

  return (
    <div className="order-reminder">
      <div className="container order-reminder-inner">
        <span>Vous avez une commande en cours</span>
        <div className="order-reminder-actions">
          <Link to={`/commande/${orderId}`} className="order-reminder-link">Voir ma commande</Link>
          <button className="order-reminder-close" onClick={() => setDismissed(true)} aria-label="Fermer">✕</button>
        </div>
      </div>

      <style>{`
        .order-reminder {
          background: var(--color-ink);
          color: var(--color-paper);
          padding: 10px 0;
          font-size: 13px;
        }
        .order-reminder-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .order-reminder-actions { display: flex; align-items: center; gap: 14px; }
        .order-reminder-link {
          font-weight: 700;
          text-decoration: underline;
          color: var(--color-paper);
        }
        .order-reminder-close {
          background: none;
          border: none;
          color: var(--color-paper);
          opacity: 0.6;
          font-size: 13px;
          padding: 2px 6px;
          transition: opacity 0.2s;
        }
        .order-reminder-close:hover { opacity: 1; }
      `}</style>
    </div>
  )
}
