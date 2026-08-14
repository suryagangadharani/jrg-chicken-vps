// JRG Chicken Service Worker for Background Push Notifications
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Background Push Notification Event
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "JRG Chicken 🍗", body: event.data.text() };
    }
  }

  const title = data.title || data.notification?.title || "JRG Chicken Order Update 🍗";
  const options = {
    body: data.body || data.notification?.body || "You have a new update regarding your order.",
    icon: "/jrg-logo.png",
    badge: "/jrg-logo.png",
    data: data.data || { url: "/orders" },
    vibrate: [200, 100, 200],
    tag: data.tag || "jrg-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle Notification Click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "/orders";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
