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

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 1. Firebase Background Message Handler (when site is closed/background)
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM Service Worker] Background message:", payload);

  const title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "JRG Chicken 🍗";
  const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "Order update received";
  const targetUrl = (payload.data && (payload.data.actionUrl || payload.data.url)) || "/orders";

  const options = {
    body: body,
    icon: "/rakesh-logo.png",
    badge: "/rakesh-logo.png",
    image: (payload.data && payload.data.imageUrl) || undefined,
    vibrate: [300, 100, 300, 100, 300],
    tag: (payload.data && payload.data.notificationId) || "jrg-order-status",
    requireInteraction: true, // Keep notification on screen until clicked (Swiggy/Zomato style)
    renotify: true,
    data: {
      url: targetUrl,
      orderId: (payload.data && payload.data.orderId) || ""
    }
  };

  return self.registration.showNotification(title, options);
});

// 2. Fallback Raw WebPush Listener (Wakes Service Worker on Android Lockscreen/Statusbar)
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Raw Push Event Received:", event);
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "JRG Chicken 🍗", body: event.data.text() };
    }
  }

  const title = data.title || (data.notification && data.notification.title) || "We're preparing your order 🍗";
  const body = data.body || (data.notification && data.notification.body) || "You have a new order status update.";
  const url = data.url || (data.data && (data.data.actionUrl || data.data.url)) || "/orders";

  const options = {
    body: body,
    icon: "/rakesh-logo.png",
    badge: "/rakesh-logo.png",
    vibrate: [300, 100, 300, 100, 300],
    tag: data.tag || (data.data && data.data.notificationId) || "jrg-push-notification",
    requireInteraction: true,
    renotify: true,
    data: { url: url }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 3. Handle Notification Click (Open or Focus App Window)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "/orders";

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
