import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

dotenv.config();

import { query, initDatabase } from "./db/index.js";
import {
  authenticateToken,
  requireAuth,
  requireAdmin,
  requireDeliveryBoy,
  requireDeliveryBoyOrAdmin,
  generateToken,
  AuthenticatedRequest,
} from "./middleware/auth.js";
import {
  createAndSendNotification,
  sendCustomerOrderPlacedPush,
  sendAdminNewOrderPush,
  sendDeliveryBoyNewOrderPush,
  sendCustomerOrderStatusPush,
} from "./fcm-admin.js";
import { initFirebaseAdmin, getFirebaseHealthStatus } from "./firebaseAdmin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Image Upload Storage
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage });

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));
app.use(authenticateToken);

// Create HTTP server & WebSocket Server for Realtime Notifications
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const connectedClients: Set<WebSocket> = new Set();

wss.on("connection", (ws) => {
  connectedClients.add(ws);
  ws.on("close", () => connectedClients.delete(ws));
  ws.on("error", (err) => console.error("WebSocket error:", err));
});

export function broadcastRealtimeEvent(type: "ORDER_CREATED" | "ORDER_UPDATED" | "DATA_CHANGED", payload: any) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ----------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "JRG Chicken API Server", timestamp: new Date().toISOString() });
});

// ----------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);

    const existing = await query(
      `SELECT id, email, phone FROM profiles WHERE email = $1 OR (phone = $2 AND phone != '')`,
      [cleanEmail, cleanPhone]
    );

    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      if (cleanPhone && match.phone === cleanPhone) {
        return res.status(400).json({ error: "An account with this mobile number already exists. Please sign in." });
      }
      return res.status(400).json({ error: "An account with this email address already exists. Please sign in." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    
    // Determine user role: First registered user becomes Admin automatically
    const countRes = await query("SELECT COUNT(*) FROM profiles");
    const totalProfiles = parseInt(countRes.rows[0].count, 10);
    const role = totalProfiles === 0 ? "admin" : "customer";

    const profileRes = await query(
      `INSERT INTO profiles (email, password_hash, full_name, phone) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, full_name, phone, created_at`,
      [cleanEmail, password_hash, full_name || "", cleanPhone]
    );

    const user = profileRes.rows[0];
    await query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user.id, role]);

    const token = generateToken({ id: user.id, email: user.email, role });
    res.json({ user: { ...user, role }, token, isFirstUser: totalProfiles === 0 });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message || "Failed to register account." });
  }
});

// ----------------------------------------------------
// GOOGLE OAUTH AUTHENTICATION
// ----------------------------------------------------
app.post("/api/auth/google", async (req, res) => {
  try {
    let { credential, access_token, email, full_name, phone } = req.body;

    // Decode Google ID Token if passed as credential
    if (credential) {
      try {
        const parts = credential.split(".");
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
          const payload = JSON.parse(payloadJson);
          if (payload.email) {
            email = payload.email;
            full_name = full_name || payload.name || `${payload.given_name || ""} ${payload.family_name || ""}`.trim();
          }
        }
      } catch (e) {
        console.warn("Failed to parse Google ID token credential:", e);
      }
    }

    // Fetch user profile from Google UserInfo endpoint if access_token is provided
    if (!email && access_token) {
      try {
        const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (googleRes.ok) {
          const googleUser = await googleRes.json();
          if (googleUser.email) {
            email = googleUser.email;
            full_name = full_name || googleUser.name || `${googleUser.given_name || ""} ${googleUser.family_name || ""}`.trim();
          }
        }
      } catch (e) {
        console.warn("Failed to fetch Google userinfo:", e);
      }
    }

    if (!email) {
      return res.status(400).json({ error: "Could not retrieve Google account email. Please try again." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);

    // Check if user already exists
    const existing = await query(
      `SELECT p.id, p.email, p.full_name, p.phone, p.created_at,
              COALESCE(
                (SELECT r.role::text FROM user_roles r WHERE r.user_id = p.id ORDER BY CASE r.role::text WHEN 'admin' THEN 1 WHEN 'delivery_boy' THEN 2 ELSE 3 END LIMIT 1),
                'customer'
              ) as role 
       FROM profiles p 
       WHERE p.email = $1`,
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      const role = user.role || "customer";
      const token = generateToken({ id: user.id, email: user.email, role });
      return res.json({ user: { ...user, role }, token, isNewUser: false });
    }

    // New user signing up with Google
    const countRes = await query("SELECT COUNT(*) FROM profiles");
    const totalProfiles = parseInt(countRes.rows[0].count, 10);
    const role = totalProfiles === 0 ? "admin" : "customer";

    const randomPassword = await bcrypt.hash(`google_${Date.now()}_${Math.random()}`, 10);

    const profileRes = await query(
      `INSERT INTO profiles (email, password_hash, full_name, phone) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, full_name, phone, created_at`,
      [cleanEmail, randomPassword, full_name || cleanEmail.split("@")[0], cleanPhone]
    );

    const newUser = profileRes.rows[0];
    await query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING", [newUser.id, role]);

    const token = generateToken({ id: newUser.id, email: newUser.email, role });
    return res.json({ user: { ...newUser, role }, token, isNewUser: true, isFirstUser: totalProfiles === 0 });
  } catch (err: any) {
    console.error("Google auth error:", err);
    res.status(500).json({ error: err.message || "Google sign in failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email/Phone and password are required." });
    }

    const cleanInput = email.trim().toLowerCase();
    const cleanPhone = cleanInput.replace(/\D/g, "").slice(-10);
    const autoGenEmail = `${cleanPhone}@customer.jrgchicken.in`;

    const result = await query(
      `SELECT p.*, 
              COALESCE(
                (SELECT r.role::text FROM user_roles r WHERE r.user_id = p.id ORDER BY CASE r.role::text WHEN 'admin' THEN 1 WHEN 'delivery_boy' THEN 2 ELSE 3 END LIMIT 1),
                'customer'
              ) as role 
       FROM profiles p 
       WHERE p.email = $1 OR p.phone = $2 OR (p.phone = $3 AND $3 != '') OR p.email = $4
       ORDER BY p.created_at DESC`,
      [cleanInput, cleanInput, cleanPhone, autoGenEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Account not found. Please register first." });
    }

    let matchedUser: any = null;
    for (const candidate of result.rows) {
      const valid = await bcrypt.compare(password, candidate.password_hash);
      if (valid) {
        matchedUser = candidate;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(400).json({ error: "Incorrect password. Please try again." });
    }

    const role = matchedUser.role || "customer";
    const token = generateToken({ id: matchedUser.id, email: matchedUser.email, role });

    delete matchedUser.password_hash;
    res.json({ user: { ...matchedUser, role }, token });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Failed to sign in." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.json({ success: true });
});

app.get("/api/auth/me", async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ user: null });
  }
  try {
    const result = await query(
      `SELECT p.id, p.email, p.full_name, p.phone, p.created_at,
              COALESCE(
                (SELECT r.role::text FROM user_roles r WHERE r.user_id = p.id ORDER BY CASE r.role::text WHEN 'admin' THEN 1 WHEN 'delivery_boy' THEN 2 ELSE 3 END LIMIT 1),
                'customer'
              ) as role 
       FROM profiles p 
       WHERE p.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ user: null });
    }

    const user = result.rows[0];
    res.json({ user: { ...user, role: user.role || "customer" } });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch user session." });
  }
});

// ----------------------------------------------------
// CATEGORIES & PRODUCTS ROUTES
// ----------------------------------------------------
app.get("/api/categories", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM categories ORDER BY sort_order ASC, name ASC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load categories" });
  }
});

app.post("/api/admin/categories", requireAdmin, async (req, res) => {
  try {
    const { name, slug, image_url, sort_order } = req.body;
    const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const result = await query(
      `INSERT INTO categories (name, slug, image_url, sort_order) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (slug) DO UPDATE SET name = $1, image_url = $3, sort_order = $4
       RETURNING *`,
      [name, cleanSlug, image_url || "", sort_order || 0]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save category" });
  }
});

app.put("/api/admin/categories/:id", requireAdmin, async (req, res) => {
  try {
    const { name, slug, image_url, sort_order } = req.body;
    const cleanSlug = slug || (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : undefined);
    const result = await query(
      `UPDATE categories 
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           image_url = COALESCE($3, image_url),
           sort_order = COALESCE($4, sort_order)
       WHERE id = $5
       RETURNING *`,
      [name, cleanSlug, image_url, sort_order, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Category not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update category" });
  }
});

app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete category" });
  }
});

app.put("/api/admin/categories/:id/price", requireAdmin, async (req, res) => {
  try {
    const { price_per_kg } = req.body;
    const priceVal = parseFloat(price_per_kg);
    if (isNaN(priceVal) || priceVal <= 0) {
      return res.status(400).json({ error: "Enter a valid price per kg" });
    }
    const result = await query(
      `UPDATE products 
       SET price_per_kg = $1, updated_at = NOW() 
       WHERE category_id = $2 
       RETURNING *`,
      [priceVal, req.params.id]
    );
    res.json({ success: true, count: result.rowCount, updatedProducts: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update category price" });
  }
});

app.get("/api/products", async (_req, res) => {
  try {
    const result = await query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       ORDER BY p.sort_order ASC, p.created_at DESC`
    );
    const products = result.rows.map((row) => ({
      ...row,
      categories: row.category_name ? { name: row.category_name, slug: row.category_slug } : null,
    }));
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load products" });
  }
});

app.get("/api/products/:slug", async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.slug = $1 OR p.id::text = $1`,
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    const row = result.rows[0];
    const product = {
      ...row,
      categories: row.category_name ? { name: row.category_name, slug: row.category_slug } : null,
    };
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

app.post("/api/admin/products", requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, price_per_kg, price_presets, badge, in_stock, images, category_id, sort_order } = req.body;
    const cleanSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const result = await query(
      `INSERT INTO products (category_id, name, slug, description, price_per_kg, price_presets, badge, in_stock, images, sort_order) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
      [
        category_id || null,
        name,
        cleanSlug,
        description || "",
        price_per_kg,
        price_presets || [250, 500, 1000],
        badge || null,
        in_stock !== false,
        images || [],
        sort_order || 0,
      ]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create product" });
  }
});

app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, price_per_kg, price_presets, badge, in_stock, images, category_id, sort_order } = req.body;
    const result = await query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           description = COALESCE($3, description),
           price_per_kg = COALESCE($4, price_per_kg),
           price_presets = COALESCE($5, price_presets),
           badge = COALESCE($6, badge),
           in_stock = COALESCE($7, in_stock),
           images = COALESCE($8, images),
           category_id = COALESCE($9, category_id),
           sort_order = COALESCE($10, sort_order),
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [name, slug, description, price_per_kg, price_presets, badge, in_stock, images, category_id, sort_order, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update product" });
  }
});

app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM products WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete product" });
  }
});

// ----------------------------------------------------
// BANNERS & PROMO CODES ROUTES
// ----------------------------------------------------
app.get("/api/banners", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM banners WHERE active = true ORDER BY sort_order ASC, created_at DESC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load banners" });
  }
});

app.get("/api/admin/banners", requireAdmin, async (_req, res) => {
  try {
    const result = await query("SELECT * FROM banners ORDER BY sort_order ASC, created_at DESC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load banners" });
  }
});

app.post("/api/admin/banners", requireAdmin, async (req, res) => {
  try {
    const { title, subtitle, button_text, image_url, link_url, active, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ error: "Banner image URL is required" });
    const result = await query(
      `INSERT INTO banners (title, subtitle, button_text, image_url, link_url, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title || "", subtitle || "", button_text || "", image_url, link_url || "", active !== false, sort_order || 0]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create banner" });
  }
});

app.put("/api/admin/banners/:id", requireAdmin, async (req, res) => {
  try {
    const { title, subtitle, button_text, image_url, link_url, active, sort_order } = req.body;
    const result = await query(
      `UPDATE banners
       SET title = COALESCE($1, title),
           subtitle = COALESCE($2, subtitle),
           button_text = COALESCE($3, button_text),
           image_url = COALESCE($4, image_url),
           link_url = COALESCE($5, link_url),
           active = COALESCE($6, active),
           sort_order = COALESCE($7, sort_order)
       WHERE id = $8
       RETURNING *`,
      [title, subtitle, button_text, image_url, link_url, active, sort_order, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Banner not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update banner" });
  }
});

app.delete("/api/admin/banners/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM banners WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete banner" });
  }
});

app.get("/api/promos", async (_req, res) => {
  try {
    const result = await query("SELECT * FROM promo_codes ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load promo codes" });
  }
});

app.post("/api/promos/validate", async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ error: "Promo code required" });

    const result = await query("SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND active = true", [code]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid promo code" });
    }

    const promo = result.rows[0];
    if (subtotal && subtotal < Number(promo.min_subtotal)) {
      return res.status(400).json({ error: `Minimum subtotal of ₹${promo.min_subtotal} required for this promo code.` });
    }

    let discount = 0;
    if (promo.discount_type === "percent") {
      discount = (Number(subtotal || 0) * Number(promo.discount_value)) / 100;
    } else {
      discount = Number(promo.discount_value);
    }

    res.json({ valid: true, discount, promo });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to validate promo code" });
  }
});

app.post("/api/admin/promos", requireAdmin, async (req, res) => {
  try {
    const { code, discount_type, discount_value, min_subtotal, min_qty_kg, active, description } = req.body;
    const result = await query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, min_subtotal, min_qty_kg, active, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code.toUpperCase(), discount_type, discount_value, min_subtotal || 0, min_qty_kg || 0, active !== false, description || ""]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create promo code" });
  }
});

app.delete("/api/admin/promos/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM promo_codes WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete promo code" });
  }
});

// ----------------------------------------------------
// STORE STATUS & BUSINESS HOURS (6 AM - 8 PM IST / 2 PM - 4 PM Lunch Break)
// ----------------------------------------------------
export function getBackendStoreStatus(manualLunchOverride?: boolean | null) {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  };
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

  const timeInMinutes = hour * 60 + minute;
  const openTimeInMinutes = 6 * 60; // 6:00 AM (360)
  const closeTimeInMinutes = 20 * 60; // 8:00 PM (1200)

  const lunchStartMinutes = 14 * 60; // 2:00 PM (840)
  const lunchEndMinutes = 16 * 60; // 4:00 PM (960)

  // 1. Business Hours Check (6 AM - 8 PM IST)
  if (timeInMinutes < openTimeInMinutes || timeInMinutes >= closeTimeInMinutes) {
    return {
      status: "closed",
      canOrder: false,
      message: "JRG Chicken is currently closed. Our ordering hours are 6:00 AM to 8:00 PM.",
      badgeLabel: "Closed · Opens at 6:00 AM",
      badgeColor: "rose",
      nextTime: "6:00 AM",
      manualLunchBreak: Boolean(manualLunchOverride),
    };
  }

  // 2. Lunch Break Check (2 PM - 4 PM IST OR Admin Manual Override)
  const isAutoLunchBreak = timeInMinutes >= lunchStartMinutes && timeInMinutes < lunchEndMinutes;
  const isLunchActive = manualLunchOverride !== undefined && manualLunchOverride !== null
    ? Boolean(manualLunchOverride)
    : isAutoLunchBreak;

  if (isLunchActive) {
    return {
      status: "lunch_break",
      canOrder: false,
      message: "We're currently on a lunch break. Ordering will resume at 4:00 PM.",
      badgeLabel: "Lunch Break · Resumes 4:00 PM",
      badgeColor: "amber",
      nextTime: "4:00 PM",
      manualLunchBreak: Boolean(manualLunchOverride),
    };
  }

  // 3. Open
  return {
    status: "open",
    canOrder: true,
    message: "We're open and accepting orders!",
    badgeLabel: "Open Now · 6:00 AM – 8:00 PM",
    badgeColor: "emerald",
    manualLunchBreak: Boolean(manualLunchOverride),
  };
}

async function getManualLunchOverride(): Promise<boolean | null> {
  try {
    const res = await query("SELECT value FROM store_settings WHERE key = 'manual_lunch_break'");
    if (res.rows.length > 0) {
      return Boolean(res.rows[0].value?.active);
    }
  } catch {}
  return null;
}

app.get("/api/store-status", async (_req, res) => {
  try {
    const manualOverride = await getManualLunchOverride();
    const statusObj = getBackendStoreStatus(manualOverride);
    res.json(statusObj);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch store status" });
  }
});

app.put("/api/admin/store-status", requireAdmin, async (req, res) => {
  try {
    const { manualLunchBreak } = req.body;
    const active = Boolean(manualLunchBreak);

    await query(
      `INSERT INTO store_settings (key, value, updated_at)
       VALUES ('manual_lunch_break', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify({ active })]
    );

    const statusObj = getBackendStoreStatus(active);
    broadcastRealtimeEvent("STORE_STATUS_UPDATED", statusObj);
    res.json(statusObj);
  } catch (err: any) {
    console.error("Failed to update store status:", err);
    res.status(500).json({ error: err?.message || "Failed to update store status" });
  }
});

// ----------------------------------------------------
// ORDERS & REALTIME NOTIFICATION ROUTES
// ----------------------------------------------------
app.post("/api/orders", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "LOGIN_REQUIRED",
        message: "Please sign in or create an account to place an order.",
      });
    }

    const manualOverride = await getManualLunchOverride();
    const storeStatus = getBackendStoreStatus(manualOverride);

    if (!storeStatus.canOrder) {
      if (storeStatus.status === "closed") {
        return res.status(400).json({
          error: "SHOP_CLOSED",
          message: storeStatus.message,
        });
      }
      if (storeStatus.status === "lunch_break") {
        return res.status(400).json({
          error: "LUNCH_BREAK",
          message: storeStatus.message,
        });
      }
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      address_line1,
      address_line2,
      city,
      pincode,
      landmark,
      items,
      subtotal,
      delivery_fee,
      discount,
      total,
      payment_method,
    } = req.body;

    if (!customer_name || !customer_phone || !address_line1 || !items || !total) {
      return res.status(400).json({ error: "Missing required order information." });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random4Digit = Math.floor(1000 + Math.random() * 9000);
    const order_number = `JCC-${dateStr}-${random4Digit}`;

    const userId = req.user.id;

    // Find active delivery boy to automatically distribute order
    const deliveryBoyRes = await query(
      `SELECT p.id FROM profiles p JOIN user_roles r ON p.id = r.user_id WHERE r.role = 'delivery_boy' ORDER BY p.created_at ASC LIMIT 1`
    );
    const activeDeliveryBoyId = deliveryBoyRes.rows.length > 0 ? deliveryBoyRes.rows[0].id : null;

    const result = await query(
      `INSERT INTO orders (
        order_number, user_id, delivery_boy_id, customer_name, customer_phone, customer_email,
        address_line1, address_line2, city, pincode, landmark,
        items, subtotal, delivery_fee, discount, total, payment_method, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'placed')
       RETURNING *`,
      [
        order_number,
        userId,
        activeDeliveryBoyId,
        customer_name,
        customer_phone,
        customer_email || null,
        address_line1,
        address_line2 || "",
        city || "Jangareddygudem",
        pincode || "534447",
        landmark || "",
        JSON.stringify(items),
        subtotal,
        delivery_fee || 0,
        discount || 0,
        total,
        payment_method || "cod",
      ]
    );

    const createdOrder = result.rows[0];

    // Create assignment entry for delivery boy tracking
    if (activeDeliveryBoyId) {
      await query(
        `INSERT INTO order_assignments (order_id, delivery_boy_id, status) VALUES ($1, $2, 'assigned')`,
        [createdOrder.id, activeDeliveryBoyId]
      );
    }

    console.log(`[ORDER CREATED] orderId=${createdOrder.id} orderNumber=${createdOrder.order_number || createdOrder.id}`);

    // Broadcast live WebSocket event to Admin Dashboard & Delivery Dashboard
    broadcastRealtimeEvent("ORDER_CREATED", createdOrder);

    // 1. Send ONE-TIME "Order Placed Successfully 🍗" push ONLY to Customer
    sendCustomerOrderPlacedPush(createdOrder).catch((err) => console.error("Customer FCM Push Error:", err));

    // 2. Send "New Order 🔔" push ONLY to Admin & Delivery Boy
    sendAdminNewOrderPush(createdOrder).catch((err) => console.error("FCM Admin Push Error:", err));
    if (activeDeliveryBoyId) {
      sendDeliveryBoyNewOrderPush(createdOrder).catch((err) => console.error("FCM Delivery Push Error:", err));
    }

    res.json(createdOrder);
  } catch (err: any) {
    console.error("Order creation error:", err);
    res.status(500).json({ error: err.message || "Failed to place order." });
  }
});

app.get("/api/orders/my-orders", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query("SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [req.user!.id]);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch order history" });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  try {
    const result = await query("SELECT * FROM orders WHERE id::text = $1 OR order_number = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch order details" });
  }
});

app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const result = await query("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

app.put(["/api/admin/orders/:id/status", "/api/admin/orders/:id/status/update"], requireAdmin, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;

    // Fetch existing order to prevent duplicate notifications if status hasn't changed
    const currentOrderRes = await query("SELECT * FROM orders WHERE id::text = $1 OR order_number = $1", [req.params.id]);
    if (currentOrderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const previousOrder = currentOrderRes.rows[0];
    const isStatusChanged = previousOrder.status !== status;

    const result = await query(
      `UPDATE orders 
       SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW() 
       WHERE id::text = $3 OR order_number = $3 
       RETURNING *`,
      [status, admin_notes, req.params.id]
    );

    const updatedOrder = result.rows[0];

    // Broadcast WebSocket notification to Admin & Customer tracker
    broadcastRealtimeEvent("ORDER_UPDATED", updatedOrder);

    // Trigger FCM Push notification to Customer ONLY if status actually changed
    if (isStatusChanged) {
      sendCustomerOrderStatusPush(updatedOrder).catch((err) => console.error("FCM Customer Push Error:", err));
    }

    res.json(updatedOrder);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update order status" });
  }
});

// ----------------------------------------------------
// FCM TOKEN REGISTRATION & PUSH NOTIFICATION ROUTES
// ----------------------------------------------------
app.post(["/api/fcm/register", "/api/notifications/register-device"], authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { token, fcm_token, device_info, browser, platform, device_type } = req.body;
    const finalToken = fcm_token || token;
    if (!finalToken) return res.status(400).json({ error: "FCM token is required" });
    const info = device_info || `${platform || ""} ${browser || device_type || "web"}`.trim() || "web";
    const userId = req.user?.id || null;

    // Secure Role Verification: ALWAYS verify user role from DB, never trust client-supplied role
    let verifiedRole: "admin" | "customer" | "delivery_boy" = "customer";
    if (userId) {
      const roleRes = await query(
        `SELECT r.role::text FROM user_roles r WHERE r.user_id = $1 ORDER BY CASE r.role::text WHEN 'admin' THEN 1 WHEN 'delivery_boy' THEN 2 ELSE 3 END LIMIT 1`,
        [userId]
      );
      if (roleRes.rows.length > 0) {
        const dbRole = roleRes.rows[0].role;
        if (dbRole === "admin" || dbRole === "delivery_boy" || dbRole === "customer") {
          verifiedRole = dbRole;
        }
      }
    }

    const tokenSuffix = String(finalToken).slice(-8);
    console.log(`[FCM Register] userId=${userId || "guest"} role=${verifiedRole} platform=${info} tokenSuffix=...${tokenSuffix} active=true`);

    await query(
      `INSERT INTO notification_tokens (user_id, token, role, device_info, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (token) DO UPDATE SET 
         user_id = COALESCE(EXCLUDED.user_id, notification_tokens.user_id), 
         role = CASE 
           WHEN EXCLUDED.user_id IS NOT NULL THEN EXCLUDED.role 
           ELSE notification_tokens.role 
         END, 
         device_info = COALESCE(EXCLUDED.device_info, notification_tokens.device_info),
         is_active = true, 
         updated_at = NOW()`,
      [userId, finalToken, verifiedRole, info]
    );
    res.json({ success: true, message: "Device registered successfully" });
  } catch (err: any) {
    console.error("[FCM Register Error]", err?.message || err);
    res.status(500).json({ error: "Failed to register FCM token" });
  }
});

app.post(["/api/fcm/unregister", "/api/notifications/unregister-device"], authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { token, fcm_token } = req.body;
    const finalToken = fcm_token || token;

    if (finalToken) {
      const tokenSuffix = String(finalToken).slice(-8);
      console.log(`[FCM Unregister] Deactivating token tokenSuffix=...${tokenSuffix}`);
      await query(`UPDATE notification_tokens SET is_active = false, updated_at = NOW() WHERE token = $1`, [finalToken]);
    }
    res.json({ success: true, message: "Device unregistered successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to unregister device" });
  }
});

app.get("/api/admin/fcm/status/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const tokensRes = await query(
      `SELECT id, user_id, role, device_info, is_active, created_at, updated_at, token
       FROM notification_tokens
       WHERE user_id::text = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    const devices = tokensRes.rows.map((r: any) => ({
      id: r.id,
      platform: r.device_info || "web",
      active: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      tokenPreview: `...${String(r.token).slice(-8)}`,
    }));

    res.json({
      userId,
      role: tokensRes.rows[0]?.role || "customer",
      activeTokenCount: devices.filter((d: any) => d.active).length,
      totalDeviceCount: devices.length,
      devices,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to fetch FCM diagnostic status" });
  }
});

app.get("/firebase-messaging-sw.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Service-Worker-Allowed", "/");
  const swPath = path.join(__dirname, "../public/firebase-messaging-sw.js");
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.status(404).send("// Service worker file not found");
  }
});

// ----------------------------------------------------
// WEBSITE VISITS (ANALYTICS) ROUTES
// ----------------------------------------------------
app.post("/api/visits", async (req, res) => {
  try {
    const { session_id, path = "/" } = req.body;
    const finalSession = session_id || req.ip || "guest_session";

    // Throttled visit check: count session only once per 30 minutes
    const existingRes = await query(
      `SELECT id FROM website_visits WHERE session_id = $1 AND created_at > NOW() - INTERVAL '30 minutes'`,
      [finalSession]
    );
    if (existingRes.rows.length === 0) {
      await query(
        `INSERT INTO website_visits (session_id, path, created_at) VALUES ($1, $2, NOW())`,
        [finalSession, path]
      );
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record visit" });
  }
});

app.get("/api/admin/visits/stats", requireAdmin, async (_req, res) => {
  try {
    const [todayRes, yesterdayRes, last7Res, last30Res, totalRes] = await Promise.all([
      query("SELECT COUNT(*) FROM website_visits WHERE created_at >= CURRENT_DATE"),
      query("SELECT COUNT(*) FROM website_visits WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE"),
      query("SELECT COUNT(*) FROM website_visits WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'"),
      query("SELECT COUNT(*) FROM website_visits WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'"),
      query("SELECT COUNT(*) FROM website_visits"),
    ]);
    res.json({
      today: Number(todayRes.rows[0].count),
      yesterday: Number(yesterdayRes.rows[0].count),
      last7Days: Number(last7Res.rows[0].count),
      last30Days: Number(last30Res.rows[0].count),
      total: Number(totalRes.rows[0].count),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch visit stats" });
  }
});

// ----------------------------------------------------
// NOTIFICATION HISTORY & MANAGEMENT ENDPOINTS
// ----------------------------------------------------
app.get("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user!.role || "customer";
    const result = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 OR (user_id IS NULL AND role::text = $2)
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user!.id, userRole]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch notification history" });
  }
});

app.get("/api/notifications/unread-count", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user!.role || "customer";
    const result = await query(
      `SELECT COUNT(*) FROM notifications 
       WHERE (user_id = $1 OR (user_id IS NULL AND role::text = $2)) AND is_read = false`,
      [req.user!.id, userRole]
    );
    res.json({ unreadCount: Number(result.rows[0].count) });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch unread notification count" });
  }
});

app.all("/api/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.method !== "PUT" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    await query(
      `UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

app.put("/api/notifications/read-all", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user!.role || "customer";
    await query(
      `UPDATE notifications SET is_read = true, read_at = NOW() 
       WHERE (user_id = $1 OR (user_id IS NULL AND role::text = $2)) AND is_read = false`,
      [req.user!.id, userRole]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

app.delete("/api/notifications/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user!.role || "customer";
    await query(
      `DELETE FROM notifications 
       WHERE id = $1 AND (user_id = $2 OR (user_id IS NULL AND role::text = $3))`,
      [req.params.id, req.user!.id, userRole]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

app.delete("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user!.role || "customer";
    await query(
      `DELETE FROM notifications 
       WHERE user_id = $1 OR (user_id IS NULL AND role::text = $2)`,
      [req.user!.id, userRole]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete all notifications" });
  }
});


app.get(["/api/firebase/health", "/api/admin/firebase-health"], (_req, res) => {
  res.json(getFirebaseHealthStatus());
});

app.post("/api/notifications/test", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { soundType = "loud_alert", title = "🔔 Test Alert Notification", message = "This is a test alert notification to verify push, custom popup, and audio chime!" } = req.body;
    const userRole: any = req.user!.role || "admin";

    const notif = await createAndSendNotification({
      userId: req.user!.id,
      role: userRole,
      type: "SYSTEM",
      title,
      message,
      actionUrl: userRole === "admin" ? "/admin" : userRole === "delivery_boy" ? "/delivery" : "/orders",
      soundType,
      priority: "high",
    });

    res.json({ success: true, notification: notif });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to dispatch test notification" });
  }
});

// ----------------------------------------------------
// DELIVERY BOY API ENDPOINTS
// ----------------------------------------------------
app.get("/api/delivery/orders", requireDeliveryBoyOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    let sql = `SELECT * FROM orders ORDER BY created_at DESC`;
    let params: any[] = [];
    if (req.user?.role === "delivery_boy") {
      sql = `SELECT * FROM orders WHERE delivery_boy_id = $1 OR delivery_boy_id IS NULL ORDER BY created_at DESC`;
      params = [req.user.id];
    }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch delivery orders" });
  }
});

app.put("/api/delivery/orders/:id/status", requireDeliveryBoyOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["placed", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const currentOrderRes = await query("SELECT * FROM orders WHERE id::text = $1 OR order_number = $1", [req.params.id]);
    if (currentOrderRes.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const previousOrder = currentOrderRes.rows[0];
    const isStatusChanged = previousOrder.status !== status;

    const deliveryBoyId = req.user?.role === "delivery_boy" || req.user?.id ? req.user.id : null;

    const result = await query(
      `UPDATE orders 
       SET status = $1, 
           delivery_boy_id = COALESCE(delivery_boy_id, $2::uuid), 
           updated_at = NOW() 
       WHERE id::text = $3 OR order_number = $3 
       RETURNING *`,
      [status, deliveryBoyId, req.params.id]
    );

    const updatedOrder = result.rows[0];

    // Record or update order assignment
    if (deliveryBoyId) {
      await query(
        `INSERT INTO order_assignments (order_id, delivery_boy_id, status, completed_at)
         VALUES ($1, $2, $3, CASE WHEN $3 = 'delivered' THEN NOW() ELSE NULL END)
         ON CONFLICT DO NOTHING`,
        [updatedOrder.id, deliveryBoyId, status === "delivered" ? "completed" : "assigned"]
      );
      if (status === "delivered") {
        await query(
          `UPDATE order_assignments SET status = 'completed', completed_at = NOW() WHERE order_id = $1 AND delivery_boy_id = $2`,
          [updatedOrder.id, deliveryBoyId]
        );
      }
    }

    broadcastRealtimeEvent("ORDER_UPDATED", updatedOrder);

    if (isStatusChanged) {
      sendCustomerOrderStatusPush(updatedOrder).catch((err) => console.error("FCM Customer Push Error:", err));
    }

    res.json(updatedOrder);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update order status" });
  }
});

// ----------------------------------------------------
// ADMIN DELIVERY BOY MANAGEMENT ENDPOINTS
// ----------------------------------------------------
app.get("/api/admin/delivery-boys", requireAdmin, async (_req, res) => {
  try {
    try {
      await query("DO $$ BEGIN ALTER TYPE app_role ADD VALUE 'delivery_boy'; EXCEPTION WHEN duplicate_object THEN null; WHEN others THEN null; END $$;");
    } catch {}

    const result = await query(
      `SELECT DISTINCT ON (p.id) p.id, p.email, p.full_name, p.phone, p.created_at,
              (SELECT COUNT(*) FROM orders o WHERE (o.delivery_boy_id = p.id OR EXISTS (SELECT 1 FROM order_assignments oa WHERE oa.order_id = o.id AND oa.delivery_boy_id = p.id)) AND o.status = 'delivered') as completed_deliveries,
              (SELECT COUNT(*) FROM orders o WHERE (o.delivery_boy_id = p.id OR EXISTS (SELECT 1 FROM order_assignments oa WHERE oa.order_id = o.id AND oa.delivery_boy_id = p.id)) AND o.status IN ('placed', 'confirmed', 'preparing', 'out_for_delivery')) as active_deliveries
       FROM profiles p 
       JOIN user_roles r ON p.id = r.user_id 
       WHERE r.role::text = 'delivery_boy'
       ORDER BY p.id, p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch delivery boys: " + (err.message || "") });
  }
});

app.post("/api/admin/delivery-boys", requireAdmin, async (req, res) => {
  try {
    try {
      await query("DO $$ BEGIN ALTER TYPE app_role ADD VALUE 'delivery_boy'; EXCEPTION WHEN duplicate_object THEN null; WHEN others THEN null; END $$;");
    } catch {}
    const { email, password, full_name, phone } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "Email, password, and full name are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);

    const existing = await query(`SELECT id FROM profiles WHERE email = $1 OR (phone = $2 AND phone != '')`, [cleanEmail, cleanPhone]);
    const password_hash = await bcrypt.hash(password, 10);

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      await query(
        `UPDATE profiles 
         SET password_hash = $1, full_name = $2, phone = COALESCE(NULLIF($3, ''), phone), updated_at = NOW() 
         WHERE id = $4`,
        [password_hash, full_name, cleanPhone, existingUser.id]
      );
      await query(`DELETE FROM user_roles WHERE user_id = $1`, [existingUser.id]);
      await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'delivery_boy')`, [existingUser.id]);

      return res.json({ id: existingUser.id, email: cleanEmail, full_name, phone: cleanPhone, role: "delivery_boy" });
    }

    const profileRes = await query(
      `INSERT INTO profiles (email, password_hash, full_name, phone) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, full_name, phone, created_at`,
      [cleanEmail, password_hash, full_name, cleanPhone]
    );

    const deliveryUser = profileRes.rows[0];
    await query(`DELETE FROM user_roles WHERE user_id = $1`, [deliveryUser.id]);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'delivery_boy')`, [deliveryUser.id]);

    res.json({ ...deliveryUser, role: "delivery_boy" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create delivery boy account" });
  }
});

app.put("/api/admin/delivery-boys/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: "New password is required" });

    const password_hash = await bcrypt.hash(new_password, 10);
    await query(`UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [password_hash, req.params.id]);

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ----------------------------------------------------
// USER PROFILE & ADDRESSES ROUTES
// ----------------------------------------------------
app.get("/api/user/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query("SELECT id, email, full_name, phone, created_at FROM profiles WHERE id = $1", [req.user!.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Profile not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

app.put("/api/user/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { full_name, phone, email } = req.body;
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
    const cleanEmail = (email || "").trim().toLowerCase();

    if (cleanPhone) {
      const existingPhone = await query(`SELECT id FROM profiles WHERE phone = $1 AND id != $2`, [cleanPhone, req.user!.id]);
      if (existingPhone.rows.length > 0) {
        return res.status(400).json({ error: "An account with this mobile number already belongs to another user." });
      }
    }

    if (cleanEmail && !cleanEmail.endsWith("@customer.jrgchicken.in") && !cleanEmail.endsWith("@placeholder.com")) {
      const existingEmail = await query(`SELECT id FROM profiles WHERE LOWER(email) = $1 AND id != $2`, [cleanEmail, req.user!.id]);
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: "An account with this email address already belongs to another user." });
      }
    }

    const result = await query(
      `UPDATE profiles 
       SET full_name = COALESCE(NULLIF($1, ''), full_name),
           phone = CASE WHEN $2 != '' THEN $2 ELSE phone END,
           email = CASE WHEN $3 != '' AND $3 NOT LIKE '%@customer.jrgchicken.in' AND $3 NOT LIKE '%@placeholder.com' THEN $3 ELSE email END,
           updated_at = NOW() 
       WHERE id = $4 
       RETURNING id, email, full_name, phone, created_at`,
      [full_name, cleanPhone, cleanEmail, req.user!.id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to update profile" });
  }
});

app.get("/api/user/addresses", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (LOWER(TRIM(line1)), LOWER(TRIM(COALESCE(line2, ''))), LOWER(TRIM(city)), TRIM(pincode)) * 
       FROM addresses 
       WHERE user_id = $1 
       ORDER BY LOWER(TRIM(line1)), LOWER(TRIM(COALESCE(line2, ''))), LOWER(TRIM(city)), TRIM(pincode), is_default DESC, created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load addresses" });
  }
});

app.post("/api/user/addresses", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { label, full_name, phone, line1, line2, city, pincode, landmark, is_default } = req.body;
    const cleanLine1 = (line1 || "").trim();
    const cleanLine2 = (line2 || "").trim();
    const cleanCity = (city || "Jangareddygudem").trim();
    const cleanPincode = (pincode || "534447").trim();

    if (!cleanLine1) {
      return res.status(400).json({ error: "Address line 1 is required." });
    }

    // Deduplication check: See if an identical address already exists for this user
    const existing = await query(
      `SELECT * FROM addresses 
       WHERE user_id = $1 
         AND LOWER(TRIM(line1)) = LOWER($2) 
         AND LOWER(TRIM(COALESCE(line2, ''))) = LOWER($3) 
         AND LOWER(TRIM(city)) = LOWER($4) 
         AND TRIM(pincode) = $5`,
      [req.user!.id, cleanLine1, cleanLine2, cleanCity, cleanPincode]
    );

    if (is_default) {
      await query("UPDATE addresses SET is_default = false WHERE user_id = $1", [req.user!.id]);
    }

    if (existing.rows.length > 0) {
      const existingAddr = existing.rows[0];
      const updated = await query(
        `UPDATE addresses 
         SET label = COALESCE(NULLIF($1, ''), label),
             full_name = COALESCE(NULLIF($2, ''), full_name),
             phone = COALESCE(NULLIF($3, ''), phone),
             landmark = COALESCE(NULLIF($4, ''), landmark),
             is_default = CASE WHEN $5::boolean THEN true ELSE is_default END,
             updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [label || null, full_name || null, phone || null, landmark || null, !!is_default, existingAddr.id]
      );
      return res.json(updated.rows[0] || existingAddr);
    }

    const result = await query(
      `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, city, pincode, landmark, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user!.id, label || "Home", full_name, phone, cleanLine1, cleanLine2, cleanCity, cleanPincode, landmark || "", !!is_default]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to add address" });
  }
});

app.delete("/api/user/addresses/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await query("DELETE FROM addresses WHERE id = $1 AND user_id = $2", [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete address" });
  }
});

// ----------------------------------------------------
// ADMIN DASHBOARD & USER MANAGEMENT
// ----------------------------------------------------
app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
  try {
    const totalOrdersRes = await query("SELECT COUNT(*) FROM orders");
    const totalRevenueRes = await query("SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled'");
    const activeProductsRes = await query("SELECT COUNT(*) FROM products WHERE in_stock = true");
    const pendingOrdersRes = await query("SELECT COUNT(*) FROM orders WHERE status IN ('placed', 'confirmed', 'preparing', 'out_for_delivery')");
    const registeredUsersRes = await query("SELECT COUNT(*) FROM profiles");
    const websiteVisitsRes = await query("SELECT COUNT(*) FROM website_visits");

    res.json({
      totalOrders: Number(totalOrdersRes.rows[0].count),
      totalRevenue: Number(totalRevenueRes.rows[0].revenue),
      activeProducts: Number(activeProductsRes.rows[0].count),
      pendingOrders: Number(pendingOrdersRes.rows[0].count),
      registeredUsers: Number(registeredUsersRes.rows[0].count),
      websiteVisits: Number(websiteVisitsRes.rows[0].count),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

app.get("/api/admin/users", requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (p.id) p.id, p.email, p.full_name, p.phone, p.created_at,
              COALESCE(
                (SELECT r.role::text FROM user_roles r WHERE r.user_id = p.id ORDER BY CASE r.role::text WHEN 'admin' THEN 1 WHEN 'delivery_boy' THEN 2 ELSE 3 END LIMIT 1),
                'customer'
              ) as role,
              (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = p.id) as orders_count
       FROM profiles p 
       ORDER BY p.id, p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const { full_name, phone, email, role } = req.body;
    const cleanPhone = (phone || "").replace(/\D/g, "").slice(-10);
    const cleanEmail = (email || "").trim().toLowerCase();

    await query(
      `UPDATE profiles 
       SET full_name = COALESCE(NULLIF($1, ''), full_name),
           phone = CASE WHEN $2 != '' THEN $2 ELSE phone END,
           email = CASE WHEN $3 != '' AND $3 NOT LIKE '%@customer.jrgchicken.in' THEN $3 ELSE email END,
           updated_at = NOW()
       WHERE id = $4`,
      [full_name, cleanPhone, cleanEmail, req.params.id]
    );

    if (role && ["admin", "customer", "delivery_boy"].includes(role)) {
      await query(`DELETE FROM user_roles WHERE user_id = $1`, [req.params.id]);
      await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [req.params.id, role]);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to update user" });
  }
});

app.put("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "customer", "delivery_boy"].includes(role)) {
      return res.status(400).json({ error: "Invalid role specified" });
    }
    // Delete existing role rows for user and insert single role to prevent duplicate role rows
    await query(`DELETE FROM user_roles WHERE user_id = $1`, [req.params.id]);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [req.params.id, role]);
    res.json({ success: true, role });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update user role" });
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    // Retain historical orders by disassociating profile reference
    await query(`UPDATE orders SET user_id = NULL WHERE user_id = $1`, [targetUserId]);
    await query(`DELETE FROM addresses WHERE user_id = $1`, [targetUserId]);
    await query(`DELETE FROM notifications WHERE user_id = $1`, [targetUserId]);
    await query(`DELETE FROM notification_tokens WHERE user_id = $1`, [targetUserId]);
    await query(`DELETE FROM user_roles WHERE user_id = $1`, [targetUserId]);
    await query(`DELETE FROM profiles WHERE id = $1`, [targetUserId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ----------------------------------------------------
// FILE UPLOADS
// ----------------------------------------------------
app.post("/api/admin/uploads", requireAdmin, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// ----------------------------------------------------
// FRONTEND STATIC FILES & SPA FALLBACK FOR PRODUCTION
// ----------------------------------------------------
const distDir = path.join(__dirname, "../dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/ws")) {
      return next();
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
}

// Start Server and Database
server.listen(PORT, "0.0.0.0", async () => {
  console.log(`====================================================`);
  console.log(`JRG Chicken API & Realtime Server running on 0.0.0.0:${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
  await initDatabase();
  initFirebaseAdmin();
});
