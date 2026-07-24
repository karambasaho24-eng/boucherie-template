// ============================================================
// src/hooks/useStock.jsx
// Hook pour vérifier la disponibilité d'un produit côté client
// avant l'ajout au panier ou la réservation.
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Retourne les infos de stock d'un produit en temps réel.
 * Utilisé dans ProductCard et la page de détail produit.
 *
 * @param {Object} product - L'objet produit (depuis la DB)
 * @returns {{
 *   availableKg: number|null,
 *   isStockManaged: boolean,
 *   canAdd: (qtyKg: number) => boolean,
 *   maxKg: number|null,
 *   stockLabel: string,
 *   stockSeverity: 'ok'|'low'|'empty'|'unavailable'
 * }}
 */
export function useStockInfo(product) {
  if (!product) return defaultInfo()

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

  const isStockManaged = !!stock_enabled

  function canAdd(qtyKg = 1) {
    if (availability_mode === 'disabled' || availability_mode === 'out_of_stock') return false
    if (availability_mode === 'reservation_only') return false
    if (!isStockManaged) return availability_mode === 'available' || availability_mode === 'pickup_only'
    return qtyKg <= availableKg
  }

  function getStockLabel() {
    switch (availability_mode) {
      case 'disabled':          return 'Désactivé'
      case 'out_of_stock':      return 'Rupture de stock'
      case 'reservation_only':  return 'Sur réservation'
      case 'pickup_only':       return 'Retrait boutique uniquement'
      case 'available':
        if (!isStockManaged)    return 'En stock'
        if (availableKg <= 0)   return 'Rupture de stock'
        if (availableKg <= stock_alert_kg) return `Stock faible — ${availableKg.toFixed(2)} kg`
        return 'En stock'
      default:                  return 'Disponible'
    }
  }

  function getSeverity() {
    if (availability_mode === 'disabled')         return 'unavailable'
    if (availability_mode === 'out_of_stock')     return 'empty'
    if (availability_mode === 'reservation_only') return 'reservation'
    if (availability_mode === 'pickup_only')      return 'pickup'
    if (!isStockManaged)                          return 'ok'
    if (availableKg <= 0)                         return 'empty'
    if (availableKg <= stock_alert_kg)            return 'low'
    return 'ok'
  }

  return {
    availableKg,
    isStockManaged,
    canAdd,
    maxKg: availableKg,
    stockLabel: getStockLabel(),
    stockSeverity: getSeverity(),
    availabilityMode: availability_mode,
  }
}

function defaultInfo() {
  return {
    availableKg: null,
    isStockManaged: false,
    canAdd: () => false,
    maxKg: null,
    stockLabel: '',
    stockSeverity: 'unavailable',
    availabilityMode: 'disabled',
  }
}

// ─────────────────────────────────────────────
// Constantes d'étiquettes (pour ProductCard, Shop, etc.)
// ─────────────────────────────────────────────

export const AVAILABILITY_MODES = [
  { value: 'available',         label: 'Disponible',                    color: '#2f6b3a' },
  { value: 'pickup_only',       label: 'Retrait boutique uniquement',   color: '#7a5500' },
  { value: 'reservation_only',  label: 'Sur réservation uniquement',    color: '#1a4d8f' },
  { value: 'out_of_stock',      label: 'Rupture de stock',              color: '#b5181f' },
  { value: 'disabled',          label: 'Désactivé temporairement',      color: '#8a8a86' },
]

export function availabilityLabel(mode) {
  return AVAILABILITY_MODES.find((m) => m.value === mode)?.label ?? mode
}

export function availabilityColor(mode) {
  return AVAILABILITY_MODES.find((m) => m.value === mode)?.color ?? '#8a8a86'
}
