import admin from "firebase-admin";

/**
 * Robust Firebase Private Key Normalizer for Node.js OpenSSL 3.0.
 * Handles:
 * - JSON object strings (extracting .private_key if full JSON was pasted)
 * - Base64 encoded private keys / JSON objects
 * - Stripping outer quotes ("..." or '...') and escaped quotes (\")
 * - Replacing literal '\\n', '\\\\n', '\\r\\n' with real newline characters
 * - Validating PEM markers (-----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----)
 */
export function normalizePrivateKey(rawKey?: string): string | null {
  if (!rawKey) return null;
  let key = rawKey.trim();

  // 1. If full JSON object was pasted into FIREBASE_PRIVATE_KEY
  if (key.startsWith("{")) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) {
        key = parsed.private_key;
      }
    } catch (e) {
      // ignore
    }
  }

  // 2. If base64 encoded
  if (!key.includes("BEGIN PRIVATE KEY") && !key.includes("\n") && !key.includes("\\n") && key.length > 100) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf8");
      if (decoded.includes("BEGIN PRIVATE KEY")) {
        key = decoded;
      } else if (decoded.startsWith("{")) {
        const parsed = JSON.parse(decoded);
        if (parsed.private_key) {
          key = parsed.private_key;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Strip escaped double quotes at start/end (e.g. \"-----BEGIN...\")
  key = key.replace(/^\\"/, "").replace(/\\"$/, "");

  // 4. Strip outer quotes if passed in quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // 5. Replace single-escaped and double-escaped newlines with real line breaks
  key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");
  key = key.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // 6. Ensure proper newline after header and before footer
  if (key.includes("-----BEGIN PRIVATE KEY-----") && key.includes("-----END PRIVATE KEY-----")) {
    if (!key.startsWith("-----BEGIN PRIVATE KEY-----\n")) {
      key = key.replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n");
    }
    if (!key.endsWith("\n-----END PRIVATE KEY-----") && !key.endsWith("\n-----END PRIVATE KEY-----\n")) {
      key = key.replace("-----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----");
    }
    return key.trim();
  }

  return null;
}

export function getFirebaseHealthStatus() {
  const base64Creds = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_BASE64;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const normalizedKey = normalizePrivateKey(privateKeyRaw);

  const isConfigured = Boolean(base64Creds || serviceAccountJson || googleAppCreds || (projectId && clientEmail && normalizedKey));
  const isInitialized = admin.apps.length > 0;

  return {
    firebase: {
      configured: isConfigured,
      initialized: isInitialized,
      hasBase64Creds: Boolean(base64Creds),
      hasServiceAccountJson: Boolean(serviceAccountJson),
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

  const base64Creds = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_BASE64;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  try {
    // Strategy 1: Base64 Encoded Service Account JSON (SAFEST FOR DOCKER / COOLIFY ARGS)
    if (base64Creds) {
      try {
        const decoded = Buffer.from(base64Creds.trim(), "base64").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (parsed.private_key) {
          parsed.private_key = normalizePrivateKey(parsed.private_key) || parsed.private_key;
        }
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
        });
        messagingInstance = admin.messaging();
        console.log("[FCM] Firebase Admin SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT_BASE64.");
        return messagingInstance;
      } catch (b64Err: any) {
        console.error("[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:", b64Err?.message || b64Err);
      }
    }

    // Strategy 2: Raw Service Account JSON text string
    if (serviceAccountJson) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        if (parsed.private_key) {
          parsed.private_key = normalizePrivateKey(parsed.private_key) || parsed.private_key;
        }
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
        });
        messagingInstance = admin.messaging();
        console.log("[FCM] Firebase Admin SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT_JSON.");
        return messagingInstance;
      } catch (jsonErr: any) {
        console.error("[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", jsonErr?.message || jsonErr);
      }
    }

    // Strategy 3: GOOGLE_APPLICATION_CREDENTIALS file path
    if (googleAppCreds) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId || "jrg-chicken-vps",
      });
      messagingInstance = admin.messaging();
      console.log("[FCM] Firebase Admin SDK initialized successfully via GOOGLE_APPLICATION_CREDENTIALS.");
      return messagingInstance;
    }

    // Strategy 4: Individual Environment Variables
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
