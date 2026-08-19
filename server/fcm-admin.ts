import crypto from "crypto";
import { query } from "./db/index.js";
import { broadcastRealtimeEvent } from "./index.js";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getFirebaseAccessToken(): Promise<string | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID || "jrg-chicken-vps";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@jrg-chicken-vps.iam.gserviceaccount.com";
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) return null;

  // Clean up escaped newlines in env string
  privateKey = privateKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      })
    ).toString("base64url");

    const signInput = `${header}.${claimSet}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signInput);
    const signature = signer.sign(privateKey, "base64url");
    const jwt = `${signInput}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const data = await res.json();
    if (data.access_token) {
      cachedAccessToken = {
        token: data.access_token,
        expiresAt: now + (data.expires_in || 3600),
      };
      return data.access_token;
    }
  } catch (err: any) {
    console.error("[Firebase OAuth2 Token Error]", err?.message || err);
  }
  return null;
}

export interface NotificationCreateParams {
  userId?: string | null;
  role: "admin" | "delivery_boy" | "customer";
  type: "NEW_ORDER" | "ORDER_CONFIRMED" | "ORDER_OUT_FOR_DELIVERY" | "ORDER_DELIVERED" | "ORDER_CANCELLED" | "PAYMENT_SUCCESS" | "GENERAL" | "SYSTEM";
  title: string;
  message: string;
  orderId?: string | null;
  actionUrl?: string;
  soundType?: "loud_alert" | "normal_alert" | "success" | "warning";
  priority?: "high" | "normal";
}

/**
 * Creates a notification event in the database, sends FCM Push notifications to target device tokens,
 * and broadcasts WebSocket events for instant real-time popups.
 */
export async function createAndSendNotification(params: NotificationCreateParams) {
  const {
    userId = null,
    role,
    type,
    title,
    message,
    orderId = null,
    actionUrl = "/",
    soundType = "normal_alert",
    priority = "normal",
  } = params;

  try {
    // 1. Persist notification to VPS database for history & unread counter
    const insertRes = await query(
      `INSERT INTO notifications (user_id, role, type, title, message, order_id, action_url, sound_type, priority, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
       RETURNING *`,
      [userId, role, type, title, message, orderId, actionUrl, soundType, priority]
    );

    const notificationRecord = insertRes.rows[0];

    // 2. Broadcast live WebSocket event for in-app popups & sound playback
    broadcastRealtimeEvent("NOTIFICATION_CREATED", notificationRecord);

    // 3. Dispatch FCM Push Notifications to active device tokens
    await dispatchFcmPush({
      userId,
      role,
      title,
      body: message,
      data: {
        notificationId: String(notificationRecord.id),
        notificationType: type,
        orderId: orderId ? String(orderId) : "",
        actionUrl,
        soundType,
      },
    });

    return notificationRecord;
  } catch (err) {
    console.error("[Notification Engine Error]", err);
  }
}

async function dispatchFcmPush(params: {
  userId?: string | null;
  role: string;
  title: string;
  body: string;
  data: Record<string, string>;
}) {
  const { userId, role, title, body, data } = params;

  try {
    let whereClause = "WHERE is_active = true";
    const values: any[] = [];

    if (userId) {
      values.push(userId);
      whereClause += ` AND user_id = $${values.length}`;
    } else if (role) {
      values.push(role);
      whereClause += ` AND role::text = $${values.length}`;
    }

    const tokensRes = await query(`SELECT DISTINCT token FROM notification_tokens ${whereClause}`, values);
    const tokens = tokensRes.rows.map((r: any) => r.token);

    if (tokens.length === 0) {
      console.log(`[FCM Dispatch] No active FCM tokens found for target (user: ${userId}, role: ${role}).`);
      return;
    }

    console.log(`[FCM Dispatch] Dispatching push notification "${title}" to ${tokens.length} active device token(s).`);

    const serverKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
    const accessToken = await getFirebaseAccessToken();
    const projectId = process.env.FIREBASE_PROJECT_ID || "jrg-chicken-vps";

    for (const tokenStr of tokens) {
      try {
        if (tokenStr.startsWith("{")) {
          // Native WebPush Subscription Endpoint
          const sub = JSON.parse(tokenStr);
          if (sub.endpoint) {
            const pushRes = await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "TTL": "86400",
                "Urgency": "high",
              },
              body: JSON.stringify({
                title,
                body,
                icon: "/rakesh-logo.png",
                badge: "/rakesh-logo.png",
                tag: data.notificationId || "jrg-push",
                data: { ...data, title, body },
              }),
            });
            if (pushRes.status === 410 || pushRes.status === 404) {
              await query(`DELETE FROM notification_tokens WHERE token = $1`, [tokenStr]);
              console.log(`[FCM] Removed expired WebPush subscription token from database.`);
            }
          }
        } else if (accessToken) {
          // FCM HTTP v1 REST Dispatch API (Official Recommended Gateway)
          const fcmV1Res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                token: tokenStr,
                notification: {
                  title,
                  body,
                },
                data: {
                  ...data,
                  title,
                  body,
                  actionUrl: data.actionUrl || "https://jrgchicken.109.122.56.202.sslip.io/orders",
                },
                webpush: {
                  headers: { Urgency: "high", TTL: "86400" },
                  notification: {
                    title,
                    body,
                    icon: "/rakesh-logo.png",
                    badge: "/rakesh-logo.png",
                    requireInteraction: true,
                  },
                  fcm_options: {
                    link: data.actionUrl || "https://jrgchicken.109.122.56.202.sslip.io/orders",
                  },
                },
              },
            }),
          });
          const fcmV1Data = await fcmV1Res.json().catch(() => ({}));
          console.log(`[FCM v1 Response] Status ${fcmV1Res.status}:`, JSON.stringify(fcmV1Data));

          if (fcmV1Res.status === 404 || fcmV1Res.status === 400 || (fcmV1Data.error && fcmV1Data.error.status === "UNREGISTERED")) {
            await query(`DELETE FROM notification_tokens WHERE token = $1`, [tokenStr]);
            console.log(`[FCM] Automatically removed invalid token: ${tokenStr.slice(0, 15)}...`);
          }
        } else if (serverKey) {
          // FCM Legacy REST Dispatch Endpoint Fallback
          const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `key=${serverKey}`,
            },
            body: JSON.stringify({
              to: tokenStr,
              notification: {
                title,
                body,
                icon: "/rakesh-logo.png",
                badge: "/rakesh-logo.png",
                click_action: data.actionUrl || "https://jrgchicken.109.122.56.202.sslip.io/orders",
              },
              data: {
                ...data,
                title,
                body,
              },
              priority: "high",
            }),
          });
          const fcmResult = await fcmRes.json().catch(() => ({}));
          console.log(`[FCM Gateway Response] Status ${fcmRes.status}:`, JSON.stringify(fcmResult));

          if (
            fcmRes.status === 400 ||
            fcmRes.status === 404 ||
            (fcmResult.results && fcmResult.results[0] && (fcmResult.results[0].error === "NotRegistered" || fcmResult.results[0].error === "InvalidRegistration"))
          ) {
            await query(`DELETE FROM notification_tokens WHERE token = $1`, [tokenStr]);
            console.log(`[FCM] Automatically removed invalid token: ${tokenStr.slice(0, 15)}...`);
          }
        } else {
          console.warn("[FCM Warning] FIREBASE_PRIVATE_KEY or FIREBASE_SERVER_KEY is missing in server .env. Gateway push skipped.");
        }
      } catch (err: any) {
        console.error("[Push Dispatch Error]", err?.message || err);
      }
    }
  } catch (err) {
    console.error("[FCM Dispatch Error]", err);
  }
}

export async function sendAdminNewOrderPush(order: any) {
  // Query all active admin profiles
  const adminsRes = await query(
    `SELECT p.id FROM profiles p JOIN user_roles r ON p.id = r.user_id WHERE r.role = 'admin'`
  );

  const adminUserIds = adminsRes.rows.map((r: any) => r.id);

  const notificationData = {
    userId: null as any,
    role: "admin" as const,
    type: "NEW_ORDER" as const,
    title: "New Order 🔔",
    message: `New order #${order.order_number} from ${order.customer_name}.`,
    orderId: order.id,
    actionUrl: `/admin/orders`,
    soundType: "loud_alert" as const,
    priority: "high" as const,
  };

  if (adminUserIds.length > 0) {
    for (const adminId of adminUserIds) {
      await createAndSendNotification({
        ...notificationData,
        userId: adminId,
      });
    }
  } else {
    await createAndSendNotification(notificationData);
  }
}

export async function sendDeliveryBoyNewOrderPush(order: any) {
  const deliveryBoyId = order.delivery_boy_id;

  if (deliveryBoyId) {
    await createAndSendNotification({
      userId: deliveryBoyId,
      role: "delivery_boy",
      type: "NEW_ORDER",
      title: "🚚 New Delivery Order!",
      message: `Order #${order.order_number} is ready for delivery to ${order.address_line1}`,
      orderId: order.id,
      actionUrl: `/delivery`,
      soundType: "loud_alert",
      priority: "high",
    });
  } else {
    await createAndSendNotification({
      role: "delivery_boy",
      type: "NEW_ORDER",
      title: "🚚 New Delivery Order!",
      message: `Order #${order.order_number} is ready for delivery`,
      orderId: order.id,
      actionUrl: `/delivery`,
      soundType: "loud_alert",
      priority: "high",
    });
  }
}

export async function sendCustomerOrderStatusPush(order: any) {
  if (!order.user_id) return;

  let type: any = "ORDER_CONFIRMED";
  let title = "Order Confirmed ✅";
  let message = `Your order #${order.order_number} has been confirmed.`;
  let soundType: any = "normal_alert";

  switch (order.status) {
    case "placed":
      type = "ORDER_RECEIVED";
      title = "Order Received 🍗";
      message = `Your order #${order.order_number} has been received.`;
      break;
    case "confirmed":
      type = "ORDER_CONFIRMED";
      title = "Order Confirmed ✅";
      message = `Your order #${order.order_number} has been confirmed.`;
      break;
    case "preparing":
      type = "ORDER_PREPARING";
      title = "We're preparing your order 🍗";
      message = `Your order #${order.order_number} is being prepared.`;
      break;
    case "ready":
      type = "ORDER_READY";
      title = "Your order is ready 📦";
      message = `Your order #${order.order_number} is ready.`;
      break;
    case "out_for_delivery":
      type = "ORDER_OUT_FOR_DELIVERY";
      title = "Out for delivery 🛵";
      message = `Your order #${order.order_number} is on the way.`;
      break;
    case "delivered":
      type = "ORDER_DELIVERED";
      title = "Order Delivered ✅";
      message = `Your order #${order.order_number} has been delivered.`;
      soundType = "success";
      break;
    case "cancelled":
      type = "ORDER_CANCELLED";
      title = "Order Cancelled ❌";
      message = `Your order #${order.order_number} has been cancelled.`;
      soundType = "warning";
      break;
    default:
      type = "SYSTEM";
      title = `Order #${order.order_number} Update`;
      message = `Your order status is now ${order.status}.`;
  }

  await createAndSendNotification({
    userId: order.user_id,
    role: "customer",
    type,
    title,
    message,
    orderId: order.id,
    actionUrl: `/orders`,
    soundType,
    priority: "normal",
  });
}
