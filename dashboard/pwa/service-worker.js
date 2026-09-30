
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'Crucix Alert',
    body: 'New prediction available',
    icon: '/pwa/icons/icon-192.png',
    badge: '/pwa/icons/icon-96.png',
    tag: 'crucix-default',
    requireInteraction: false,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        ...data,
        ...payload,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
      };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  if (data.type) {
    data.tag = `crucix-${data.type}`;
  }

  if (data.level === 'critical') {
    data.requireInteraction = true;
    data.vibrate = [200, 100, 200, 100, 200];
    data.actions = [
      { action: 'open', title: 'Open Dashboard' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data,
      requireInteraction: data.requireInteraction,
      vibrate: data.vibrate,
      actions: data.actions,
      timestamp: Date.now(),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/crucix.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-predictions') {
    event.waitUntil(syncPredictions());
  }
});

async function syncPredictions() {
  try {
    const cache = await caches.open(API_CACHE);
    const response = await fetch('/api/predictions/latest');
    if (response.ok) {
      await cache.put('/api/predictions/latest', response);
    }
  } catch (e) {
    // Retry later
  }
}

async function registerPeriodicSync() {
  if (!('periodicSync' in self.registration)) return;

  try {
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync',
    });

    if (status.state === 'granted') {
      await self.registration.periodicSync.register('refresh-predictions', {
        minInterval: 15 * 60 * 1000,
      });
    }
  } catch (e) {
    console.log('[SW] Periodic sync not available:', e.message);
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-predictions') {
    event.waitUntil(syncPredictions());
  }
});

self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(data.title, data);
  }

  if (type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});

console.log(`[SW] Service Worker ${VERSION} loaded`);
