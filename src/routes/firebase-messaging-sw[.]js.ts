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
        const js = `importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify(cfg)});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(function(payload){
  const title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || "JRG Chicken";
  const body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || "";
  const url = (payload.data && (payload.data.actionUrl || payload.data.url)) || "/";
  self.registration.showNotification(title, {
    body: body,
    icon: "/jrg-logo.png",
    badge: "/jrg-logo.png",
    vibrate: [300, 100, 300, 100, 300],
    tag: (payload.data && payload.data.notificationId) || "jrg-order",
    requireInteraction: true,
    data: { url: url }
  });
});
self.addEventListener("notificationclick", function(event){
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(list){
    for (const c of list) { if ("focus" in c) { if ("navigate" in c) c.navigate(url); return c.focus(); } }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});`;
        return new Response(js, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-cache",
            "service-worker-allowed": "/",
          },
        });
      },
    },
  },
});
