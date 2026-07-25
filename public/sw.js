// Service worker : reçoit les notifications push même si le site/l'onglet
// est fermé, et joue le rôle d'intermédiaire avec le système d'exploitation.

self.addEventListener('push', (event) => {
  let data = { title: 'Nouvelle commande', body: '' }
  try { data = event.data.json() } catch { /* payload non-JSON, on garde le défaut */ }

  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.order_id ? `order-${data.order_id}` : undefined,
    requireInteraction: true,
    data: { order_id: data.order_id },
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Nouvelle commande', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/admin/dashboard')
    })
  )
})
