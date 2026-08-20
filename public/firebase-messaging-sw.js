// JRG Chicken Service Worker for Android/Mobile & Web Background Push Notifications
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBgnkjmYmQNzc64YSlvohRcG1_3fWxTaSs",
  authDomain: "jrg-chicken-vps.firebaseapp.com",
  projectId: "jrg-chicken-vps",
  storageBucket: "jrg-chicken-vps.firebasestorage.app",
  messagingSenderId: "500615705360",
  appId: "1:500615705360:web:ce4444212069cfdf05eb95",
  measurementId: "G-DTSJN218XB"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const messaging = firebase.messaging();

// 1. Firebase Background Message Handler (triggers when site is closed/background)
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM Service Worker] Background message received:", payload);

  const title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "🔔 New Order Received";
  const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "You have a new order notification.";
  const targetUrl = (payload.data && (payload.data.actionUrl || payload.data.url)) || "/admin/orders";

  const absoluteIcon = new URL("/rakesh-logo.png", self.location.origin).href;
  const tag = (payload.data && (payload.data.orderId || payload.data.order_id)) 
    ? `order-${payload.data.orderId || payload.data.order_id}` 
    : (payload.data && payload.data.notificationId ? `notif-${payload.data.notificationId}` : `jrg-${Date.now()}`);

  const options = {
    body: body,
    icon: absoluteIcon,
    badge: absoluteIcon,
    vibrate: [300, 100, 300, 100, 300],
    tag: tag,
    requireInteraction: true,
    renotify: true,
    data: {
      url: targetUrl,
      orderId: (payload.data && (payload.data.orderId || payload.data.order_id)) || ""
    }
  };

  return self.registration.showNotification(title, options);
});

// 2. Fallback Raw WebPush Listener (Wakes Service Worker on Android Lockscreen/Statusbar)
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Raw Push Event Received:", event);
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { notification: { title: "🔔 New Order Received", body: event.data.text() } };
    }
  }

  // If FCM SDK already handled it, skip duplicate
  if (payload.fcmMessageId || payload.from) {
    return;
  }

  const title = (payload.notification && payload.notification.title) || payload.title || "🔔 New Order Received";
  const body = (payload.notification && payload.notification.body) || payload.body || "New order update";
  const targetUrl = (payload.data && (payload.data.actionUrl || payload.data.url)) || payload.url || "/admin/orders";

  const absoluteIcon = new URL("/rakesh-logo.png", self.location.origin).href;
  const tag = (payload.data && (payload.data.orderId || payload.data.order_id)) 
    ? `order-${payload.data.orderId || payload.data.order_id}` 
    : (payload.data && payload.data.notificationId ? `notif-${payload.data.notificationId}` : `jrg-push-${Date.now()}`);

  const options = {
    body: body,
    icon: absoluteIcon,
    badge: absoluteIcon,
    vibrate: [300, 100, 300, 100, 300],
    tag: tag,
    requireInteraction: true,
    renotify: true,
    data: { url: targetUrl }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 3. Handle Notification Click (Open or Focus App Window)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "/admin/orders";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
