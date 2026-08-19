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
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const normalizedKey = normalizePrivateKey(privateKeyRaw);

  const isConfigured = Boolean(projectId && clientEmail && normalizedKey);
  const isInitialized = admin.apps.length > 0;

  return {
    firebase: {
      configured: isConfigured,
      initialized: isInitialized,
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

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.warn("[FCM Standby] Firebase Admin environment variables missing (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). Push gateway in standby mode.");
    return null;
  }

  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!privateKey) {
    console.error("[FCM Error] FIREBASE_PRIVATE_KEY is malformed or invalid PEM format. Missing BEGIN/END PRIVATE KEY markers.");
    return null;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    messagingInstance = admin.messaging();
    console.log(`[FCM] Firebase Admin initialized successfully for project "${projectId}".`);
    return messagingInstance;
  } catch (err: any) {
    console.error("[FCM Error] Firebase authentication failed:", err?.message || err);
    return null;
  }
}
