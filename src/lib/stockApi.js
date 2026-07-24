// ============================================================
// src/lib/stockApi.js
// API Supabase pour la gestion des stocks, réservations et mouvements
// ============================================================

import { supabase } from './supabaseClient'

// ─────────────────────────────────────────────
// STOCK
// ─────────────────────────────────────────────

/**
 * Met à jour les paramètres de stock d'un produit.
 * Enregistre un mouvement si le stock_kg change manuellement.
 */
export async function updateProductStock(productId, updates) {
  // Lire le stock actuel pour calculer le delta
  const { data: current, error: readErr } = await supabase
    .from('products')
    .select('stock_kg, stock_enabled')
    .eq('id', productId)
    .single()
  if (readErr) throw readErr

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select()
    .single()
  if (error) throw error

  // Enregistre un mouvement si le stock_kg a changé
  if (
    updates.stock_kg !== undefined &&
    current.stock_kg !== updates.stock_kg
  ) {
    const delta = updates.stock_kg - current.stock_kg
    await supabase.from('stock_movements').insert({
      product_id: productId,
      delta_kg: delta,
      stock_after: updates.stock_kg,
      reason: 'manual_adjust',
      note: 'Ajustement manuel du stock',
    })
  }

  return data
}

/**
 * Décrémente le stock de tous les articles d'une commande (côté admin).
 * Appelle la fonction SQL qui gère l'atomicité.
 * Sans effet si déjà décrémenté pour cette commande (protection SQL).
 */
export async function decrementStockForOrder(orderId) {
  const { error } = await supabase.rpc('decrement_stock_for_order', {
    p_order_id: orderId,
  })
  if (error) throw error
}

/**
 * Restaure le stock d'une commande dont le stock avait été décrémenté
 * (ex: la commande est repassée en "En attente" après avoir été confirmée,
 * ou refusée/annulée après décrémentation).
 * Sans effet si le stock n'avait pas été décrémenté pour cette commande.
 */
export async function restockOrder(orderId) {
  const { error } = await supabase.rpc('restock_order', {
    p_order_id: orderId,
  })
  if (error) throw error
}

/**
 * Récupère le stock disponible réel (stock_kg - stock_reserved_kg) pour un produit.
 */
export async function getAvailableStock(productId) {
  const { data, error } = await supabase
    .from('products')
    .select('stock_kg, stock_reserved_kg, stock_enabled')
    .eq('id', productId)
    .single()
  if (error) throw error
  if (!data.stock_enabled) return null // pas de limite
  return Math.max(data.stock_kg - data.stock_reserved_kg, 0)
}

/**
 * Tableau de bord des stocks (vue v_stock_dashboard).
 */
export async function fetchStockDashboard() {
  const { data, error } = await supabase
    .from('v_stock_dashboard')
    .select('*')
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────
// MOUVEMENTS DE STOCK
// ─────────────────────────────────────────────

/**
 * Historique des mouvements d'un produit (ou de tous les produits).
 */
export async function fetchStockMovements(productId = null, limit = 50) {
  let query = supabase
    .from('stock_movements')
    .select('*, products(name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (productId) query = query.eq('product_id', productId)

  const { data, error } = await query
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────
// RÉSERVATIONS
// ─────────────────────────────────────────────

/**
 * Crée une demande de réservation (côté client).
 * Vérifie en amont que la quantité demandée ne dépasse pas le stock disponible.
 */
export async function createReservation({ productId, customerName, phone, quantityKg, note }) {
  // 1. Vérifier la disponibilité
  const availableKg = await getAvailableStock(productId)
  if (availableKg !== null && quantityKg > availableKg) {
    const err = new Error(
      availableKg === 0
        ? 'Ce produit n\'est plus disponible à la réservation.'
        : `Seulement ${availableKg.toFixed(2)} kg sont disponibles à la réservation.`
    )
    err.code = 'STOCK_EXCEEDED'
    err.availableKg = availableKg
    throw err
  }

  // 2. Insérer la réservation (le trigger sync_reserved_stock met à jour stock_reserved_kg)
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      product_id: productId,
      customer_name: customerName,
      phone,
      quantity_kg: quantityKg,
      note,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Liste toutes les réservations (admin).
 */
export async function fetchReservations(statusFilter = null) {
  let query = supabase
    .from('reservations')
    .select('*, products(name, category)')
    .order('created_at', { ascending: false })

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) throw error
  return data
}

/**
 * Accepte une réservation (admin).
 * Décrémente le stock physique et enregistre le mouvement.
 */
export async function acceptReservation(reservationId) {
  // 1. Lire la réservation
  const { data: res, error: readErr } = await supabase
    .from('reservations')
    .select('*, products(stock_kg, stock_enabled, stock_reserved_kg)')
    .eq('id', reservationId)
    .single()
  if (readErr) throw readErr

  const product = res.products

  // 2. Vérifier le stock disponible (hors réservations)
  const availableKg = product.stock_enabled
    ? Math.max(product.stock_kg - product.stock_reserved_kg, 0)
    : Infinity

  if (product.stock_enabled && res.quantity_kg > availableKg) {
    throw new Error(`Stock insuffisant : ${availableKg.toFixed(2)} kg disponibles, ${res.quantity_kg} kg demandés.`)
  }

  // 3. Accepter la réservation (le trigger retire la quantité de stock_reserved_kg)
  const { data: updated, error: updErr } = await supabase
    .from('reservations')
    .update({ status: 'accepted' })
    .eq('id', reservationId)
    .select()
    .single()
  if (updErr) throw updErr

  // 4. Décrémenter le stock physique si activé
  if (product.stock_enabled) {
    const newStock = Math.max(product.stock_kg - res.quantity_kg, 0)
    const { error: stockErr } = await supabase
      .from('products')
      .update({ stock_kg: newStock })
      .eq('id', res.product_id)
    if (stockErr) throw stockErr

    // 5. Enregistrer le mouvement
    await supabase.from('stock_movements').insert({
      product_id: res.product_id,
      delta_kg: -res.quantity_kg,
      stock_after: newStock,
      reason: 'reservation_accept',
      reference_id: reservationId,
      note: `Réservation acceptée — ${res.customer_name}`,
    })
  }

  return updated
}

/**
 * Refuse une réservation (admin). Le trigger libère le stock réservé.
 */
export async function refuseReservation(reservationId) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'refused' })
    .eq('id', reservationId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Annule une réservation (par le client ou l'admin).
 */
export async function cancelReservation(reservationId) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservationId)
    .select()
    .single()
  if (error) throw error
  return data
}
