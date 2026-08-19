import { query } from "./db/index.js";
import { broadcastRealtimeEvent } from "./index.js";
import { initFirebaseAdmin } from "./firebaseAdmin.js";

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

    console.log(`[FCM Dispatch] Sending push notification "${title}" to ${tokens.length} device token(s).`);

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
              console.log(`[FCM] Automatically removed expired WebPush token.`);
            }
          }
        } else if (messaging) {
          // Firebase Admin SDK Official Gateway Dispatch
          const actionLink = data.actionUrl || "/orders";
          const response = await messaging.send({
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
          console.log(`[FCM] Notification sent successfully. MessageId: ${response}`);
        } else {
          console.warn("[FCM] Firebase Admin SDK is not initialized. Gateway push skipped.");
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
          console.log(`[FCM] Automatically removed invalid token from PostgreSQL.`);
        }
      }
    }
  } catch (err: any) {
    console.error("[FCM Dispatch Error]", err?.message || err);
  }
}

export async function sendAdminNewOrderPush(order: any) {
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

export async function sendDeliveryBoyNewOrderPush(order: any) {
  const deliveryBoyId = order.delivery_boy_id;

  if (deliveryBoyId) {
    await createAndSendNotification({
      userId: deliveryBoyId,
      role: "delivery_boy",
      type: "NEW_ORDER",
      title: "🚚 New Delivery Order!",
      message: `Order #${order.order_number} is ready for delivery to ${order.address_line1}`,
      orderId: String(order.id),
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
      orderId: String(order.id),
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
    orderId: String(order.id),
    actionUrl: `/orders`,
    soundType,
    priority: "normal",
  });
}
