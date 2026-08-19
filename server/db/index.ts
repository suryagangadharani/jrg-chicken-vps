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
      console.log("Database schema & seed verification completed successfully.");
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

