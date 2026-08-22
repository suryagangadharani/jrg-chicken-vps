// JRG Chicken Service Worker for Android/Mobile & Web Background Push Notifications
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

console.log("[FCM SW] LOADED");

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
  console.log("[FCM SW] BACKGROUND MESSAGE RECEIVED", payload);

  const title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "🔔 New Order Received";
  const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "You have a new order notification.";
  const targetUrl = (payload.data && (payload.data.actionUrl || payload.data.url)) || "/admin/orders";
  const orderId = (payload.data && (payload.data.orderId || payload.data.order_id)) || "none";
  const orderNumber = (payload.data && (payload.data.orderNumber || payload.data.order_number)) || orderId;

  console.log(`[FCM SW] orderId=${orderId}`);
  console.log(`[FCM SW] orderNumber=${orderNumber}`);
  console.log(`[FCM SW] SHOWING NOTIFICATION`);

  const absoluteIcon = new URL("/jrg-notification-icon.png", self.location.origin).href;
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
      orderId: orderId,
      orderNumber: orderNumber
    }
  };

  const promise = self.registration.showNotification(title, options);
  console.log(`[FCM SW] NOTIFICATION DISPLAY REQUESTED`);
  return promise;
});

// 2. Fallback Raw WebPush Listener (Wakes Service Worker on Android Lockscreen/Statusbar)
self.addEventListener("push", (event) => {
  console.log("[FCM SW] BACKGROUND MESSAGE RECEIVED (RAW PUSH)", event);
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
  const orderId = (payload.data && (payload.data.orderId || payload.data.order_id)) || "none";
  const orderNumber = (payload.data && (payload.data.orderNumber || payload.data.order_number)) || orderId;

  console.log(`[FCM SW] orderId=${orderId}`);
  console.log(`[FCM SW] orderNumber=${orderNumber}`);
  console.log(`[FCM SW] SHOWING NOTIFICATION`);

  const absoluteIcon = new URL("/jrg-notification-icon.png", self.location.origin).href;
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
    data: { url: targetUrl, orderId: orderId, orderNumber: orderNumber }
  };

  const promise = self.registration.showNotification(title, options);
  console.log(`[FCM SW] NOTIFICATION DISPLAY REQUESTED`);
  event.waitUntil(promise);
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
