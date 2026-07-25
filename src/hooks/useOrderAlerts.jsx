import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { savePushSubscription, removePushSubscription } from '../lib/api'
import { getStoredSoundEnabled, getStoredDuration, playNotificationSound } from '../lib/notifSound'

// Convertit la clé VAPID publique (base64url) au format attendu par l'API Push
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function useOrderAlerts(vapidPublicKey) {
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  // Écoute en temps réel (instantanée, pas de polling) : dès qu'une commande
  // est créée, ça sonne, quel que soit l'onglet admin ouvert.
  useEffect(() => {
    const channel = supabase
      .channel('admin_new_orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          if (getStoredSoundEnabled()) playNotificationSound(getStoredDuration())
          // Si l'onglet est en arrière-plan (mais le navigateur ouvert) et que
          // la permission a été donnée, on affiche aussi une notification système.
          if (document.hidden && Notification?.permission === 'granted') {
            try {
              new Notification('Nouvelle commande', { body: 'Une nouvelle commande vient d\'arriver.' })
            } catch { /* ignore */ }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Vérifie si un abonnement push (app/navigateur fermé) est déjà actif
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setPushSupported(true)
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setPushSubscribed(!!sub)
    }).catch(() => {})
  }, [])

  const subscribeToPush = useCallback(async () => {
    if (!vapidPublicKey || pushBusy) return
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Notifications refusées. Active-les dans les paramètres du navigateur pour recevoir des alertes même app fermée.')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      await savePushSubscription(sub.toJSON())
      setPushSubscribed(true)
    } catch (err) {
      console.error('Erreur activation notifications push:', err)
      alert('Impossible d\'activer les notifications sur cet appareil.')
    } finally {
      setPushBusy(false)
    }
  }, [vapidPublicKey, pushBusy])

  const unsubscribeFromPush = useCallback(async () => {
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setPushSubscribed(false)
    } catch (err) {
      console.error('Erreur désactivation notifications push:', err)
    } finally {
      setPushBusy(false)
    }
  }, [])

  return { pushSupported, pushSubscribed, pushBusy, subscribeToPush, unsubscribeFromPush }
}
