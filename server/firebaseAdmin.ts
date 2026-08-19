import admin from "firebase-admin";

/**
 * Cleanly normalizes Firebase private keys passed via environment variables.
 * Handles:
 * - Stripping outer quotes ("..." or '...')
 * - Replacing literal '\\n' or '\\\\n' string sequences with actual line breaks
 * - Validating PEM structure (-----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----)
 */
export function normalizePrivateKey(rawKey?: string): string | null {
  if (!rawKey) return null;
  let key = rawKey.trim();

  // Strip outer quotes if passed in quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // Handle double-escaped newlines and single-escaped newlines
  key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").trim();

  if (!key.includes("-----BEGIN PRIVATE KEY-----") || !key.includes("-----END PRIVATE KEY-----")) {
    return null;
  }

  return key;
}

export function getFirebaseHealthStatus() {
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const normalizedKey = normalizePrivateKey(privateKeyRaw);

  const isConfigured = Boolean(googleAppCreds || (projectId && clientEmail && normalizedKey));
  const isInitialized = admin.apps.length > 0;

  return {
    firebase: {
      configured: isConfigured,
      initialized: isInitialized,
      hasGoogleAppCreds: Boolean(googleAppCreds),
      hasProjectId: Boolean(projectId),
      hasClientEmail: Boolean(clientEmail),
      hasValidPrivateKeyPEM: Boolean(normalizedKey),
    },
  };
}

let messagingInstance: admin.messaging.Messaging | null = null;

export function initFirebaseAdmin(): admin.messaging.Messaging | null {
  if (messagingInstance) return messagingInstance;

  if (admin.apps.length > 0) {
    messagingInstance = admin.messaging();
    return messagingInstance;
  }

  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  try {
    if (googleAppCreds) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId || "jrg-chicken-vps",
      });
      messagingInstance = admin.messaging();
      console.log("[FCM] Firebase Admin SDK initialized successfully via GOOGLE_APPLICATION_CREDENTIALS.");
      return messagingInstance;
    }

    if (!projectId || !clientEmail || !privateKeyRaw) {
      console.warn("[FCM] Firebase Admin credentials are not configured.");
      return null;
    }

    const privateKey = normalizePrivateKey(privateKeyRaw);
    if (!privateKey) {
      console.error("[FCM] Firebase Admin authentication failed. Malformed private key (missing BEGIN/END PRIVATE KEY PEM markers).");
      return null;
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    messagingInstance = admin.messaging();
    console.log("[FCM] Firebase Admin SDK initialized successfully.");
    return messagingInstance;
  } catch (err: any) {
    console.error("[FCM] Firebase Admin authentication failed:", err?.message || err);
    return null;
  }
}
