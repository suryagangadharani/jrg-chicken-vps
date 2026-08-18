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
  generateToken,
  AuthenticatedRequest,
} from "./middleware/auth.js";

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
      `SELECT p.id, p.email, p.full_name, p.phone, p.created_at, r.role 
       FROM profiles p 
       LEFT JOIN user_roles r ON p.id = r.user_id 
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
      `SELECT p.*, r.role 
       FROM profiles p 
       LEFT JOIN user_roles r ON p.id = r.user_id 
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
      `SELECT p.id, p.email, p.full_name, p.phone, p.created_at, r.role 
       FROM profiles p 
       LEFT JOIN user_roles r ON p.id = r.user_id 
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
           badge = $6,
           in_stock = COALESCE($7, in_stock),
           images = COALESCE($8, images),
           category_id = $9,
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
    const result = await query("SELECT * FROM banners WHERE active = true ORDER BY sort_order ASC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load banners" });
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
// ORDERS & REALTIME NOTIFICATION ROUTES
// ----------------------------------------------------
app.post("/api/orders", async (req: AuthenticatedRequest, res) => {
  try {
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

    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const order_number = `RCC-${dateStr}-${randomHex}`;

    const userId = req.user?.id || null;

    const result = await query(
      `INSERT INTO orders (
        order_number, user_id, customer_name, customer_phone, customer_email,
        address_line1, address_line2, city, pincode, landmark,
        items, subtotal, delivery_fee, discount, total, payment_method, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'placed')
       RETURNING *`,
      [
        order_number,
        userId,
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

    // Broadcast live WebSocket event to Admin Dashboard
    broadcastRealtimeEvent("ORDER_CREATED", createdOrder);

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

app.put("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const result = await query(
      `UPDATE orders 
       SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW() 
       WHERE id::text = $3 OR order_number = $3 
       RETURNING *`,
      [status, admin_notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updatedOrder = result.rows[0];

    // Broadcast WebSocket notification to Admin & Customer tracker
    broadcastRealtimeEvent("ORDER_UPDATED", updatedOrder);

    res.json(updatedOrder);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update order status" });
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
    const { full_name, phone } = req.body;
    const result = await query(
      `UPDATE profiles SET full_name = $1, phone = $2, updated_at = NOW() WHERE id = $3 RETURNING id, email, full_name, phone`,
      [full_name, phone, req.user!.id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

app.get("/api/user/addresses", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query("SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC", [req.user!.id]);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load addresses" });
  }
});

app.post("/api/user/addresses", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { label, full_name, phone, line1, line2, city, pincode, landmark, is_default } = req.body;
    if (is_default) {
      await query("UPDATE addresses SET is_default = false WHERE user_id = $1", [req.user!.id]);
    }
    const result = await query(
      `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, city, pincode, landmark, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user!.id, label || "Home", full_name, phone, line1, line2 || "", city || "Jangareddygudem", pincode, landmark || "", !!is_default]
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
    const pendingOrdersRes = await query("SELECT COUNT(*) FROM orders WHERE status IN ('placed', 'confirmed', 'preparing')");

    res.json({
      totalOrders: Number(totalOrdersRes.rows[0].count),
      totalRevenue: Number(totalRevenueRes.rows[0].revenue),
      activeProducts: Number(activeProductsRes.rows[0].count),
      pendingOrders: Number(pendingOrdersRes.rows[0].count),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

app.get("/api/admin/users", requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.email, p.full_name, p.phone, p.created_at, r.role 
       FROM profiles p 
       LEFT JOIN user_roles r ON p.id = r.user_id 
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.put("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    await query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)
       ON CONFLICT (user_id, role) DO NOTHING`,
      [req.params.id, role]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update user role" });
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM profiles WHERE id = $1", [req.params.id]);
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
});
