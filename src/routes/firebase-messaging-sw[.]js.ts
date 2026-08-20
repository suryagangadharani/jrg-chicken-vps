import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/firebase-messaging-sw.js")({
  server: {
    handlers: {
      GET: async () => {
        const cfg = {
          apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyBgnkjmYmQNzc64YSlvohRcG1_3fWxTaSs",
          authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "jrg-chicken-vps.firebaseapp.com",
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "jrg-chicken-vps",
          storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "jrg-chicken-vps.firebasestorage.app",
          messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "500615705360",
          appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "1:500615705360:web:ce4444212069cfdf05eb95",
          measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID || "G-DTSJN218XB",
        };

        const js = `// JRG Chicken Service Worker for Android/Mobile & Web Background Push Notifications
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

console.log("[FCM SW] loaded");

if (!firebase.apps.length) {
  firebase.initializeApp(${JSON.stringify(cfg)});
}
const messaging = firebase.messaging();

// 1. Firebase Background Message Handler (triggers when site is closed/background)
messaging.onBackgroundMessage(function(payload) {
  console.log("[FCM SW] background message received", payload);

  const title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "🔔 New Order Received";
  const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "You have a new order notification.";
  const targetUrl = (payload.data && (payload.data.actionUrl || payload.data.url)) || "/admin/orders";
  const orderId = (payload.data && (payload.data.orderId || payload.data.order_id)) || "none";

  console.log("[FCM SW] showing notification orderId=" + orderId);

  const absoluteIcon = new URL("/rakesh-logo.png", self.location.origin).href;
  const tag = (payload.data && (payload.data.orderId || payload.data.order_id)) 
    ? "order-" + (payload.data.orderId || payload.data.order_id) 
    : (payload.data && payload.data.notificationId ? "notif-" + payload.data.notificationId : "jrg-" + Date.now());

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
self.addEventListener("push", function(event) {
  console.log("[FCM SW] push event received", event);
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
  const url = (payload.data && (payload.data.actionUrl || payload.data.url)) || payload.url || "/admin/orders";
  const orderId = (payload.data && (payload.data.orderId || payload.data.order_id)) || "none";

  console.log("[FCM SW] showing notification orderId=" + orderId);

  const absoluteIcon = new URL("/rakesh-logo.png", self.location.origin).href;
  const tag = (payload.data && (payload.data.orderId || payload.data.order_id)) 
    ? "order-" + (payload.data.orderId || payload.data.order_id) 
    : (payload.data && payload.data.notificationId ? "notif-" + payload.data.notificationId : "jrg-push-" + Date.now());

  const options = {
    body: body,
    icon: absoluteIcon,
    badge: absoluteIcon,
    vibrate: [300, 100, 300, 100, 300],
    tag: tag,
    requireInteraction: true,
    renotify: true,
    data: { url: url }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 3. Handle Notification Click (Open or Focus App Window)
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "/admin/orders";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
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
});`;

        return new Response(js, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-cache, no-store, must-revalidate",
            "service-worker-allowed": "/",
          },
        });
      },
    },
  },
});
