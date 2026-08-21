import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db/index.js";

export const JWT_SECRET = process.env.JWT_SECRET || "jrg_chicken_super_secret_jwt_key_2026";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    full_name?: string;
    phone?: string;
  };
}

export function generateToken(payload: { id: string; email: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = (authHeader && authHeader.split(" ")[1]) || (req.query.token as string);

  if (!token) {
    req.user = undefined;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      req.user = undefined;
    } else {
      req.user = user;
    }
    next();
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized access. Please sign in." });
  }
  next();
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized access. Please sign in." });
  }
  if (req.user.role === "admin") {
    return next();
  }
  try {
    const roleRes = await query(
      "SELECT role::text FROM user_roles WHERE user_id = $1 AND role::text = 'admin' LIMIT 1",
      [req.user.id]
    );
    if (roleRes.rows.length > 0) {
      req.user.role = "admin";
      return next();
    }
  } catch (err) {}

  return res.status(403).json({ error: "Access denied. Admin privileges required." });
}

export async function requireDeliveryBoy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized access. Please sign in." });
  }
  if (req.user.role === "delivery_boy" || req.user.role === "admin") {
    return next();
  }
  try {
    const roleRes = await query(
      "SELECT role::text FROM user_roles WHERE user_id = $1 AND role::text IN ('admin', 'delivery_boy') LIMIT 1",
      [req.user.id]
    );
    if (roleRes.rows.length > 0) {
      req.user.role = roleRes.rows[0].role;
      return next();
    }
  } catch (err) {}

  return res.status(403).json({ error: "Access denied. Delivery privileges required." });
}

export function requireDeliveryBoyOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized access. Please sign in." });
  }
  if (req.user.role !== "delivery_boy" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Authorized personnel only." });
  }
  next();
}

