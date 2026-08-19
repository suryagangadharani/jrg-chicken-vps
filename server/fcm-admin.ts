import { query } from "./db/index.js";
import { broadcastRealtimeEvent } from "./index.js";

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

    for (const tokenStr of tokens) {
      try {
        if (tokenStr.startsWith("{")) {
          // Native WebPush Subscription Endpoint
          const sub = JSON.parse(tokenStr);
          if (sub.endpoint) {
            await fetch(sub.endpoint, {
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
            }).catch((err) => console.log("[WebPush Dispatch Warning]", err.message));
          }
        } else if (serverKey) {
          // FCM Legacy REST Dispatch Endpoint
          await fetch("https://fcm.googleapis.com/fcm/send", {
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
                click_action: data.actionUrl || "/orders",
              },
              data: {
                ...data,
                title,
                body,
              },
              priority: "high",
            }),
          }).catch((err) => console.log("[FCM Server Key Dispatch Warning]", err.message));
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

  if (adminUserIds.length > 0) {
    for (const adminId of adminUserIds) {
      await createAndSendNotification({
        userId: adminId,
        role: "admin",
        type: "NEW_ORDER",
        title: "🔔 New Order Received!",
        message: `New order #${order.order_number} from ${order.customer_name} (₹${order.total})`,
        orderId: order.id,
        actionUrl: `/admin/orders`,
        soundType: "loud_alert",
        priority: "high",
      });
    }
  } else {
    // Role-wide fallback
    await createAndSendNotification({
      role: "admin",
      type: "NEW_ORDER",
      title: "🔔 New Order Received!",
      message: `New order #${order.order_number} from ${order.customer_name} (₹${order.total})`,
      orderId: order.id,
      actionUrl: `/admin/orders`,
      soundType: "loud_alert",
      priority: "high",
    });
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
  let title = "✅ Order Confirmed";
  let message = `Your order #${order.order_number} has been confirmed.`;
  let soundType: any = "normal_alert";

  switch (order.status) {
    case "confirmed":
      type = "ORDER_CONFIRMED";
      title = "✅ Order Confirmed";
      message = `Your order #${order.order_number} has been confirmed and is being prepared! 🍗`;
      soundType = "normal_alert";
      break;
    case "out_for_delivery":
      type = "ORDER_OUT_FOR_DELIVERY";
      title = "🛵 Out for Delivery";
      message = `Your order #${order.order_number} is on the way! 🚴`;
      soundType = "normal_alert";
      break;
    case "delivered":
      type = "ORDER_DELIVERED";
      title = "🎉 Order Delivered";
      message = `Your order #${order.order_number} has been delivered. Enjoy your fresh chicken! 😊`;
      soundType = "success";
      break;
    case "cancelled":
      type = "ORDER_CANCELLED";
      title = "❌ Order Cancelled";
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
