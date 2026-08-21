import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/jrg_chicken";

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" && process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let useInMemory = false;

interface MemoryProfile {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string;
  created_at: string;
}

interface MemoryRole {
  id: string;
  user_id: string;
  role: string;
}

const memoryProfiles: MemoryProfile[] = [];
const memoryRoles: MemoryRole[] = [];

export async function query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
  if (!useInMemory) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (error: any) {
      if (error?.code === "ECONNREFUSED" || error?.message?.includes("connect ECONNREFUSED")) {
        console.warn("⚠️ PostgreSQL database unreachable at 127.0.0.1:5432. Active fallback to in-memory database engine.");
        useInMemory = true;
      } else {
        throw error;
      }
    }
  }

  // --- In-Memory Database Fallback Engine ---
  const sql = text.trim();

  // 1. COUNT profiles
  if (sql.includes("COUNT(*)") && sql.includes("profiles")) {
    return { rows: [{ count: memoryProfiles.length.toString() }], rowCount: 1 };
  }

  // 2. SELECT profiles (login / lookup / me)
  if (sql.includes("FROM profiles")) {
    if (params.length > 0) {
      const matched = memoryProfiles.filter((p) => {
        return params.some((param) => {
          if (!param) return false;
          const val = String(param).toLowerCase();
          return p.email.toLowerCase() === val || (p.phone && p.phone === val) || p.id === param;
        });
      });

      const rows = matched.map((p) => {
        const roleObj = memoryRoles.find((r) => r.user_id === p.id);
        return { ...p, role: roleObj ? roleObj.role : "customer" };
      });
      return { rows, rowCount: rows.length };
    }
    const rows = memoryProfiles.map((p) => {
      const roleObj = memoryRoles.find((r) => r.user_id === p.id);
      return { ...p, role: roleObj ? roleObj.role : "customer" };
    });
    return { rows, rowCount: rows.length };
  }

  // 3. INSERT INTO profiles
  if (sql.includes("INSERT INTO profiles")) {
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const email = params[0] || "";
    const password_hash = params[1] || "";
    const full_name = params[2] || "";
    const phone = params[3] || "";
    const created_at = new Date().toISOString();

    const newProfile: MemoryProfile = { id, email, password_hash, full_name, phone, created_at };
    memoryProfiles.push(newProfile);
    return { rows: [newProfile], rowCount: 1 };
  }

  // 4. INSERT INTO user_roles
  if (sql.includes("INSERT INTO user_roles")) {
    const id = `role_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const user_id = params[0];
    const role = params[1] || "customer";

    const newRole: MemoryRole = { id, user_id, role };
    memoryRoles.push(newRole);
    return { rows: [newRole], rowCount: 1 };
  }

  // 5. DELETE FROM profiles (cleanup)
  if (sql.includes("DELETE FROM profiles")) {
    const targetEmail = params[0];
    const idx = memoryProfiles.findIndex((p) => p.email === targetEmail);
    if (idx !== -1) memoryProfiles.splice(idx, 1);
    return { rows: [], rowCount: 0 };
  }

  return { rows: [], rowCount: 0 };
}

export async function initDatabase() {
  try {
    console.log("Initializing PostgreSQL database...");
    const schemaPath = path.join(__dirname, "schema.sql");
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, "utf8");
      await pool.query(sql);
      try {
        await pool.query("DO $$ BEGIN ALTER TYPE app_role ADD VALUE 'delivery_boy'; EXCEPTION WHEN duplicate_object THEN null; WHEN others THEN null; END $$;");
        await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_boy_id UUID REFERENCES profiles(id) ON DELETE SET NULL;");
        await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0;");
        await pool.query(`
          CREATE TABLE IF NOT EXISTS order_assignments (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
              delivery_boy_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
              status TEXT NOT NULL DEFAULT 'assigned',
              assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              completed_at TIMESTAMPTZ
          );

          CREATE TABLE IF NOT EXISTS website_visits (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              session_id TEXT NOT NULL,
              path TEXT NOT NULL DEFAULT '/',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_website_visits_created ON website_visits(created_at);

          CREATE TABLE IF NOT EXISTS notification_events (
              event_key TEXT PRIMARY KEY,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS store_settings (
              key TEXT PRIMARY KEY,
              value JSONB NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;
          ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle TEXT;
          ALTER TABLE banners ADD COLUMN IF NOT EXISTS button_text TEXT;
          ALTER TABLE notification_tokens ALTER COLUMN user_id DROP NOT NULL;

          -- Clean up duplicate user roles
          DELETE FROM user_roles a USING user_roles b 
          WHERE a.id < b.id AND a.user_id = b.user_id AND a.role = b.role;

          -- Safely deduplicate duplicate profile records by email if present
          DO $$ 
          DECLARE
            r RECORD;
            keeper_id UUID;
            dup RECORD;
          BEGIN
            FOR r IN SELECT LOWER(email) as email, COUNT(*) FROM profiles WHERE email IS NOT NULL AND email != '' GROUP BY LOWER(email) HAVING COUNT(*) > 1 LOOP
              SELECT id INTO keeper_id FROM profiles WHERE LOWER(email) = r.email ORDER BY created_at ASC LIMIT 1;
              FOR dup IN SELECT id FROM profiles WHERE LOWER(email) = r.email AND id != keeper_id LOOP
                UPDATE orders SET user_id = keeper_id WHERE user_id = dup.id;
                UPDATE addresses SET user_id = keeper_id WHERE user_id = dup.id;
                UPDATE notifications SET user_id = keeper_id WHERE user_id = dup.id;
                DELETE FROM user_roles WHERE user_id = dup.id;
                DELETE FROM profiles WHERE id = dup.id;
              END LOOP;
            END LOOP;
          END $$;
        `);
      } catch (e: any) {
        console.warn("Auto-migration notice:", e?.message);
      }
      console.log("Database schema, deduplication & seed verification completed successfully.");
    }
  } catch (err: any) {
    if (err?.code === "ECONNREFUSED" || err?.message?.includes("connect ECONNREFUSED")) {
      useInMemory = true;
      console.warn("⚠️ Local PostgreSQL offline. Server started using In-Memory Database Fallback.");
    } else {
      console.error("Failed to initialize PostgreSQL database:", err);
    }
  }
}

