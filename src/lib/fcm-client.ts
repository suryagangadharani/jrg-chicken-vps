import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAtwCJPaZF7lO0SunfWoGvTaDOQUlkW9uU",
  authDomain: "jrg-chicken.firebaseapp.com",
  projectId: "jrg-chicken",
  storageBucket: "jrg-chicken.firebasestorage.app",
  messagingSenderId: "885706625844",
  appId: "1:885706625844:web:02c1de248e3e2e5f87cb61",
};

// Public VAPID Key for web push notification token generation
const VAPID_KEY = "BDy7yN8vM-30hZ3kM-Q6m_e9hH_9yG7hX-8yH9zK0L1M2N3O4P5Q6R7S8T9U0V1W2X3Y4Z5";

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

    // 3. Obtain FCM Registration Token
    let token: string | null = null;
    try {
      token = await messaging.getToken({
        serviceWorkerRegistration: registration,
      });
    } catch (tokenErr) {
      console.warn("[FCM] Could not retrieve token with default VAPID, trying standard subscription:", tokenErr);
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
