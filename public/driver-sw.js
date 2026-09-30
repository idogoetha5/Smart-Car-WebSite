/* SmartCar driver & manager apps — service worker for phone notifications.
   Scope: /driver/ (registered from the driver and manager pages). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SmartCar', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'SmartCar';
  const options = {
    body: data.body || '',
    icon: '/icons/driver-icon-192.png',
    badge: '/icons/driver-icon-192.png',
    dir: 'rtl',
    lang: 'he',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/driver' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/driver', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url.startsWith(self.location.origin + '/driver') && 'focus' in win) {
          win.navigate(url);
          return win.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
