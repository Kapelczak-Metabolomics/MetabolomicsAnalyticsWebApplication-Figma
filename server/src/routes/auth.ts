import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query } from "../db/index.js";
import { signToken, authMiddleware, updateLastActive, logAudit } from "../middleware/auth.js";
import { trySendPasswordReset } from "../services/email.js";

const router = Router();

router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const user = await query<{ id: number }>("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
  if (user.rows[0]) {
    const token = crypto.randomBytes(32).toString("hex");
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.rows[0].id, token]
    );
    await trySendPasswordReset(email.toLowerCase().trim(), token);
  }
  res.json({ success: true, message: "If the email exists, a reset link has been sent." });
});

router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) {
    res.status(400).json({ error: "Valid token and password (min 8 chars) required" });
    return;
  }
  const row = await query<{ user_id: number }>(
    `SELECT user_id FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
    [token]
  );
  if (!row.rows[0]) {
    res.status(400).json({ error: "Invalid or expired token" });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, row.rows[0].user_id]);
  await query(`UPDATE password_reset_tokens SET used = TRUE WHERE token = $1`, [token]);
  res.json({ success: true });
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const result = await query<{ id: number; name: string; email: string; role: string; password_hash: string; status: string }>(
    "SELECT id, name, email, role, password_hash, status FROM users WHERE email = $1",
    [email.toLowerCase().trim()]
  );

  const user = result.rows[0];
  if (!user || user.status !== "active") {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await updateLastActive(user.id);
  const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = signToken(authUser);

  await logAudit(authUser, "LOGIN", "auth", "Session", "User signed in", req);

  res.json({ token, user: authUser });
});

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{ id: number; name: string; email: string; role: string }>(
    "SELECT id, name, email, role FROM users WHERE id = $1",
    [req.user!.id]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: result.rows[0] });
});

export default router;
