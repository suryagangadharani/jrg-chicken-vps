import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";

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

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "production") {
      // console.log(`Executed query (${duration}ms):`, { text: text.slice(0, 80), rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error("Database Query Error:", error);
    throw error;
  }
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

    // Clean up old default admin if present so the first real user signup becomes admin
    await pool.query("DELETE FROM profiles WHERE email = $1", ["admin@jrgchicken.in"]);
  } catch (err) {
    console.error("Failed to initialize PostgreSQL database:", err);
    console.warn("Continuing server startup; please check your DATABASE_URL configuration.");
  }
}
