// JRG Chicken Firebase Cloud Messaging Service Worker (Swiggy/Zomato Style Background Push)
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

// Handle Background Push Notifications when website tab is closed
messaging.onBackgroundMessage((payload) => {
  console.log("[FCM Service Worker] Background push received:", payload);

  const title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "JRG Chicken 🍗";
  const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "You have a new order update.";
  const targetUrl = (payload.data && (payload.data.actionUrl || payload.data.url)) || "/";

  const options = {
    body: body,
    icon: "/jrg-logo.png",
    badge: "/jrg-logo.png",
    image: (payload.data && payload.data.imageUrl) || undefined,
    vibrate: [300, 100, 300, 100, 300],
    tag: (payload.data && payload.data.notificationId) || "jrg-background-alert",
    requireInteraction: true, // Keep notification visible on screen (Swiggy/Zomato style)
    renotify: true,
    data: {
      url: targetUrl,
      orderId: (payload.data && payload.data.orderId) || ""
    }
  };

  return self.registration.showNotification(title, options);
});

// Handle Notification Click (Focus or Open App Window)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "/";

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
