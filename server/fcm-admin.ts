import { query } from "./db/index.js";
import { broadcastRealtimeEvent } from "./index.js";
import { initFirebaseAdmin } from "./firebaseAdmin.js";

export interface NotificationCreateParams {
  userId?: string | null;
  role: "admin" | "delivery_boy" | "customer";
  type: "NEW_ORDER" | "ORDER_CONFIRMED" | "ORDER_PREPARING" | "ORDER_READY" | "ORDER_OUT_FOR_DELIVERY" | "ORDER_DELIVERED" | "ORDER_CANCELLED" | "PAYMENT_SUCCESS" | "GENERAL" | "SYSTEM" | "ORDER_RECEIVED";
  title: string;
  message: string;
  orderId?: string | null;
  actionUrl?: string;
  soundType?: "loud_alert" | "normal_alert" | "success" | "warning";
  priority?: "high" | "normal";
}

/**
 * Creates a notification event in PostgreSQL database, dispatches Firebase Admin SDK FCM Push notifications,
 * and broadcasts WebSocket events for live in-app popups.
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
    // 1. Save notification to PostgreSQL (Transaction safe - does NOT fail if push fails)
    const insertRes = await query(
      `INSERT INTO notifications (user_id, role, type, title, message, order_id, action_url, sound_type, priority, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
       RETURNING *`,
      [userId, role, type, title, message, orderId, actionUrl, soundType, priority]
    );

    const notificationRecord = insertRes.rows[0];

    // 2. Broadcast live WebSocket event for in-app popups & sound playback
    broadcastRealtimeEvent("NOTIFICATION_CREATED", notificationRecord);

    // 3. Dispatch FCM Push Notifications via Firebase Admin SDK
    await dispatchFcmPush({
      userId,
      role,
      title,
      body: message,
      data: {
        notificationId: String(notificationRecord.id),
        notificationType: String(type),
        orderId: orderId ? String(orderId) : "",
        actionUrl: String(actionUrl),
        soundType: String(soundType),
      },
    }).catch((pushErr) => console.error("[FCM Push Dispatch Non-Fatal Warning]", pushErr?.message || pushErr));

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
    let queryText = "";
    const values: any[] = [];

    if (userId) {
      values.push(userId);
      values.push(role === "delivery" ? "delivery_boy" : role);
      queryText = `SELECT DISTINCT token FROM notification_tokens WHERE is_active = true AND user_id = $1 AND role::text = $2`;
    } else if (role === "admin") {
      queryText = `SELECT DISTINCT token FROM notification_tokens WHERE is_active = true AND role::text = 'admin' AND user_id IN (SELECT user_id FROM user_roles WHERE role::text = 'admin')`;
    } else if (role === "delivery_boy" || role === "delivery") {
      queryText = `SELECT DISTINCT token FROM notification_tokens WHERE is_active = true AND role::text = 'delivery_boy' AND user_id IN (SELECT user_id FROM user_roles WHERE role::text = 'delivery_boy')`;
    } else {
      console.log(`[FCM Dispatch] Skipping untargeted customer push broadcast`);
      return;
    }

    let tokensRes = await query(queryText, values);
    let tokens = tokensRes.rows.map((r: any) => r.token);

    if (tokens.length === 0) {
      console.log(`[FCM Dispatch] targetUser=${userId || "none"} role=${role} activeTokenCount=0`);
      return;
    }

    console.log(`[FCM Dispatch] targetUser=${userId || "none"} role=${role} activeTokenCount=${tokens.length}`);

    const messaging = initFirebaseAdmin();

    for (const tokenStr of tokens) {
      try {
        if (tokenStr.startsWith("{")) {
          // Native WebPush Subscription Fallback
          const sub = JSON.parse(tokenStr);
          if (sub.endpoint) {
            const pushRes = await fetch(sub.endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", TTL: "86400", Urgency: "high" },
              body: JSON.stringify({ title, body, icon: "/rakesh-logo.png", badge: "/rakesh-logo.png", data }),
            });
            if (pushRes.status === 410 || pushRes.status === 404) {
              await query(`DELETE FROM notification_tokens WHERE token = $1`, [tokenStr]);
              console.log(`[FCM] Invalid token removed`);
            }
          }
        } else if (messaging) {
          // Firebase Admin SDK Official Gateway Dispatch
          const actionLink = data.actionUrl || "/orders";
          await messaging.send({
            token: tokenStr,
            notification: {
              title,
              body,
            },
            data,
            webpush: {
              headers: {
                Urgency: "high",
                TTL: "86400",
              },
              notification: {
                title,
                body,
                icon: "/rakesh-logo.png",
                badge: "/rakesh-logo.png",
                requireInteraction: true,
              },
              fcmOptions: {
                link: actionLink,
              },
            },
          });
          console.log(`[FCM] Push notification sent successfully.`);
        } else {
          console.warn("[FCM] Firebase Admin credentials are not configured.");
        }
      } catch (tokenErr: any) {
        const errorCode = tokenErr?.code || tokenErr?.message || "";
        console.warn(`[FCM Send Error] Token error (${errorCode}):`, tokenErr?.message || tokenErr);

        if (
          errorCode.includes("messaging/registration-token-not-registered") ||
          errorCode.includes("messaging/invalid-registration-token") ||
          errorCode.includes("unregistered") ||
          errorCode.includes("invalid-argument")
        ) {
          await query(`DELETE FROM notification_tokens WHERE token = $1`, [tokenStr]);
          console.log(`[FCM] Invalid token removed`);
        }
      }
    }
  } catch (err: any) {
    console.error("[FCM Dispatch Error]", err?.message || err);
  }
}

/**
 * 1. Customer Order Placed Notification (Customer ONLY)
 * Idempotency guaranteed via event_key: ORDER_PLACED:order_number
 */
export async function sendCustomerOrderPlacedPush(order: any) {
  if (!order.user_id) return;

  const eventKey = `ORDER_PLACED:${order.order_number}`;

  try {
    const res = await query(
      `INSERT INTO notification_events (event_key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *`,
      [eventKey]
    );
    if (res.rows.length === 0) {
      console.log(`[FCM Idempotency] Skipping duplicate customer order placed notification for ${eventKey}`);
      return;
    }
  } catch (err) {
    // Proceed safely if check fails
  }

  await createAndSendNotification({
    userId: order.user_id,
    role: "customer",
    type: "ORDER_RECEIVED",
    title: "Order Placed!",
    message: `Your order ${order.order_number} has been placed successfully.`,
    orderId: String(order.id),
    actionUrl: `/orders`,
    soundType: "normal_alert",
    priority: "high",
  });
}

/**
 * 2. Admin New Order Notification (Admin ONLY)
 * Idempotency guaranteed via event_key: ADMIN_NEW_ORDER:order_number
 */
export async function sendAdminNewOrderPush(order: any) {
  const eventKey = `ADMIN_NEW_ORDER:${order.order_number}`;

  try {
    const res = await query(
      `INSERT INTO notification_events (event_key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *`,
      [eventKey]
    );
    if (res.rows.length === 0) return;
  } catch (err) {}

  const adminsRes = await query(
    `SELECT p.id FROM profiles p JOIN user_roles r ON p.id = r.user_id WHERE r.role::text = 'admin'`
  );
  const adminUserIds = adminsRes.rows.map((r: any) => r.id);

  const notificationData = {
    userId: null as any,
    role: "admin" as const,
    type: "NEW_ORDER" as const,
    title: "New Order 🔔",
    message: `New order ${order.order_number} received.`,
    orderId: String(order.id),
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

/**
 * 3. Delivery Boy New Order Notification (Delivery Boy ONLY)
 * Idempotency guaranteed via event_key: DELIVERY_NEW_ORDER:order_number
 */
export async function sendDeliveryBoyNewOrderPush(order: any) {
  const eventKey = `DELIVERY_NEW_ORDER:${order.order_number}`;

  try {
    const res = await query(
      `INSERT INTO notification_events (event_key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *`,
      [eventKey]
    );
    if (res.rows.length === 0) return;
  } catch (err) {}

  const deliveryBoyId = order.delivery_boy_id;

  if (deliveryBoyId) {
    await createAndSendNotification({
      userId: deliveryBoyId,
      role: "delivery_boy",
      type: "NEW_ORDER",
      title: "New Order 🔔",
      message: `New order ${order.order_number} received.`,
      orderId: String(order.id),
      actionUrl: `/delivery`,
      soundType: "loud_alert",
      priority: "high",
    });
  } else {
    await createAndSendNotification({
      role: "delivery_boy",
      type: "NEW_ORDER",
      title: "New Order 🔔",
      message: `New order ${order.order_number} received.`,
      orderId: String(order.id),
      actionUrl: `/delivery`,
      soundType: "loud_alert",
      priority: "high",
    });
  }
}

/**
 * 4. Customer Order Status Update Notification (Customer ONLY)
 * Triggered ONLY when status actually changes. Idempotency guaranteed via event_key: ORDER_STATUS:order_number:STATUS
 */
export async function sendCustomerOrderStatusPush(order: any) {
  if (!order.user_id) return;

  const eventKey = `ORDER_STATUS:${order.order_number}:${String(order.status).toUpperCase()}`;

  try {
    const res = await query(
      `INSERT INTO notification_events (event_key) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *`,
      [eventKey]
    );
    if (res.rows.length === 0) {
      console.log(`[FCM Idempotency] Skipping duplicate status notification for ${eventKey}`);
      return;
    }
  } catch (err) {}

  let type: any = "ORDER_CONFIRMED";
  let title = "Order Confirmed";
  let message = `Your order ${order.order_number} has been confirmed.`;
  let soundType: any = "normal_alert";

  switch (order.status) {
    case "confirmed":
      type = "ORDER_CONFIRMED";
      title = "Confirmed";
      message = `Your order ${order.order_number} has been confirmed.`;
      break;
    case "preparing":
      type = "ORDER_PREPARING";
      title = "Preparing";
      message = `Your order ${order.order_number} is being prepared.`;
      break;
    case "ready":
      type = "ORDER_READY";
      title = "Ready";
      message = `Your order ${order.order_number} is ready.`;
      break;
    case "out_for_delivery":
      type = "ORDER_OUT_FOR_DELIVERY";
      title = "Out for Delivery";
      message = `Your order ${order.order_number} is out for delivery.`;
      break;
    case "delivered":
      type = "ORDER_DELIVERED";
      title = "Delivered";
      message = `Your order ${order.order_number} has been delivered.`;
      soundType = "success";
      break;
    case "cancelled":
      type = "ORDER_CANCELLED";
      title = "Cancelled";
      message = `Your order ${order.order_number} has been cancelled.`;
      soundType = "warning";
      break;
    default:
      return;
  }

  await createAndSendNotification({
    userId: order.user_id,
    role: "customer",
    type,
    title,
    message,
    orderId: String(order.id),
    actionUrl: `/orders`,
    soundType,
    priority: "normal",
  });
}
