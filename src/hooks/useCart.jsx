// ============================================================
// src/hooks/useCart.jsx  (REMPLACEMENT COMPLET)
// Panier avec validation de stock intégrée.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const CartContext = createContext(null)
const STORAGE_KEY = 'africa_food_cart'

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [lastAdded, setLastAdded] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  /**
   * Vérifie en temps réel si la quantité demandée est disponible.
   * Retourne { ok: true } ou { ok: false, availableKg: number, message: string }
   */
  async function checkStock(product, qty) {
    // Si pas de gestion de stock, on vérifie juste le mode de disponibilité
    if (!product.stock_enabled) {
      const mode = product.availability_mode ?? (product.is_available ? 'available' : 'disabled')
      if (mode === 'disabled' || mode === 'out_of_stock') {
        return { ok: false, message: 'Ce produit n\'est pas disponible.' }
      }
      if (mode === 'reservation_only') {
        return { ok: false, message: 'Ce produit n\'est disponible que sur réservation.' }
      }
      return { ok: true }
    }

    // Récupère le stock en temps réel depuis Supabase
    const { data, error } = await supabase
      .from('products')
      .select('stock_kg, stock_reserved_kg, availability_mode')
      .eq('id', product.id)
      .single()

    if (error || !data) return { ok: true } // si erreur réseau, on laisse passer (non bloquant)

    const mode = data.availability_mode ?? 'available'
    if (mode === 'disabled' || mode === 'out_of_stock') {
      return { ok: false, message: 'Ce produit n\'est pas disponible.' }
    }
    if (mode === 'reservation_only') {
      return { ok: false, message: 'Ce produit n\'est disponible que sur réservation.' }
    }

    const currentInCart = items.find((i) => i.id === product.id)?.qty ?? 0
    const totalRequestedKg = currentInCart + qty
    const availableKg = Math.max(data.stock_kg - data.stock_reserved_kg, 0)

    if (totalRequestedKg > availableKg) {
      const remaining = Math.max(availableKg - currentInCart, 0)
      if (remaining <= 0) {
        return {
          ok: false,
          availableKg,
          message: availableKg <= 0
            ? 'Ce produit n\'est plus disponible.'
            : `Vous avez déjà ${currentInCart} en panier (stock : ${availableKg} kg).`,
        }
      }
      return {
        ok: false,
        availableKg,
        suggestedKg: remaining,
        message: `Seulement ${remaining} kg supplémentaire(s) disponible(s).`,
      }
    }

    return { ok: true, availableKg }
  }

  /**
   * Ajoute un produit au panier avec vérification de stock.
   * Retourne { success: true } ou { success: false, message, suggestedKg? }
   */
  async function addItem(product, qty = 1) {
    const stockCheck = await checkStock(product, qty)
    if (!stockCheck.ok) {
      return { success: false, ...stockCheck }
    }

    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      const unitPrice = product.promo_price ?? product.price
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + qty } : i
        )
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: unitPrice,
          image_url: product.image_url,
          qty,
          // On mémorise si ce produit a une gestion de stock active
          is_stock_managed: product.stock_enabled ?? false,
        },
      ]
    })

    setLastAdded({ name: product.name, token: Date.now() })
    return { success: true }
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function updateQty(id, qty) {
    if (qty <= 0) return removeItem(id)

    // Trouver le produit dans le panier pour vérifier le stock
    const item = items.find((i) => i.id === id)
    if (!item) return

    // Récupérer les infos de stock à la volée
    const { data } = await supabase
      .from('products')
      .select('stock_kg, stock_reserved_kg, stock_enabled, availability_mode')
      .eq('id', id)
      .single()

    if (data?.stock_enabled) {
      const availableKg = Math.max(data.stock_kg - data.stock_reserved_kg, 0)
      if (qty > availableKg) {
        return {
          success: false,
          message: `Seulement ${availableKg} kg disponible(s).`,
          suggestedKg: availableKg,
        }
      }
    }

    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)))
    return { success: true }
  }

  function clearCart() {
    setItems([])
  }

  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const count = items.reduce((sum, i) => sum + i.qty, 0)

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQty, clearCart, total, count, lastAdded }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
