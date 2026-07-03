import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "metaboanalytics-dev-secret-change-in-production";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "Administrator") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
}

export async function updateLastActive(userId: number) {
  await query("UPDATE users SET last_active_at = NOW() WHERE id = $1", [userId]);
}

export async function logAudit(
  user: AuthUser | undefined,
  action: string,
  category: string,
  resource: string,
  details: string,
  req: Request,
  severity = "info"
) {
  await query(
    `INSERT INTO audit_logs (user_id, user_name, user_email, action, category, severity, resource, details, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      user?.id ?? null,
      user?.name ?? "System",
      user?.email ?? null,
      action,
      category,
      severity,
      resource,
      details,
      req.ip,
      req.headers["user-agent"] ?? null,
    ]
  );
}

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  link?: string,
  linkLabel?: string
) {
  await query(
    `INSERT INTO notifications (user_id, type, title, message, link, link_label) VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, link ?? null, linkLabel ?? null]
  );
}

export { JWT_SECRET };
