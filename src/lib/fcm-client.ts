import { apiClient } from "@/lib/api-client";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBgnkjmYmQNzc64YSlvohRcG1_3fWxTaSs",
  authDomain: "jrg-chicken-vps.firebaseapp.com",
  projectId: "jrg-chicken-vps",
  storageBucket: "jrg-chicken-vps.firebasestorage.app",
  messagingSenderId: "500615705360",
  appId: "1:500615705360:web:ce4444212069cfdf05eb95",
  measurementId: "G-DTSJN218XB",
};

const VAPID_KEY = "BF3zV3vW6UERx69AL5bix99_Em7zz0Jh9GdQPoMFTASQsgtJv4Tm_gek0JIGfV5CxXXtQlr3hFbt-RelZSjBJas";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

export async function initFirebasePushNotifications(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    console.warn("[FCM] Service workers or Notifications not supported on this browser.");
    return false;
  }

  try {
    // 1. Register Service Worker at public root
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    console.log("[FCM] Service worker registered successfully:", registration);

    // 2. Load Firebase App & Messaging compat SDKs dynamically
    await loadScript("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

    const firebase = (window as any).firebase;
    if (!firebase) {
      console.warn("[FCM] Firebase SDK failed to load.");
      return false;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    const messaging = firebase.messaging();

    // 3. Obtain FCM Registration Token using VAPID Key
    let token: string | null = null;
    try {
      token = await messaging.getToken({
        serviceWorkerRegistration: registration,
        vapidKey: VAPID_KEY,
      });
    } catch (tokenErr) {
      console.warn("[FCM] Error obtaining FCM token with VAPID Key:", tokenErr);
    }

    // Fallback: If Firebase token requires VAPID or standard PushSubscription
    if (!token && registration.pushManager) {
      try {
        const sub = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
          userVisibleOnly: true,
        });
        token = JSON.stringify(sub);
      } catch (subErr) {
        console.warn("[FCM] Native PushSubscription error:", subErr);
      }
    }

    if (token) {
      console.log("[FCM] Token retrieved successfully:", token.substring(0, 20) + "...");
      // Register token with Express backend PostgreSQL database
      await apiClient.fcm.registerToken(
        token,
        `${navigator.platform} - ${navigator.userAgent.slice(0, 50)}`
      );
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("[FCM Setup Error]", err);
    return false;
  }
}
