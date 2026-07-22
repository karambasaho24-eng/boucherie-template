import { useEffect, useState } from 'react'
import { useCart } from '../hooks/useCart'

export default function CartToast() {
  const { lastAdded } = useCart()
  const [visible, setVisible] = useState(false)
  const [productName, setProductName] = useState('')

  useEffect(() => {
    if (!lastAdded) return
    setProductName(lastAdded.name)
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 2200)
    return () => clearTimeout(timer)
  }, [lastAdded])

  if (!lastAdded) return null

  return (
    <div className={`cart-toast ${visible ? 'cart-toast-visible' : ''}`} role="status" aria-live="polite">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" /><path d="M8 12.5l2.6 2.6L16 9.5" />
      </svg>
      <span><strong>{productName}</strong> ajouté au panier</span>

      <style>{`
        .cart-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(20px);
          background: var(--color-ink);
          color: var(--color-paper);
          padding: 13px 22px;
          border-radius: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13.5px;
          font-weight: 500;
          z-index: 300;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .cart-toast-visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        @media (min-width: 768px) {
          .cart-toast { bottom: 32px; }
        }
      `}</style>
    </div>
  )
}
