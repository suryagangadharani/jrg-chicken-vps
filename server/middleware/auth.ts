import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized access. Please sign in." });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
  next();
}

export function requireDeliveryBoy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized access. Please sign in." });
  }
  if (req.user.role !== "delivery_boy" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Delivery privileges required." });
  }
  next();
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

