import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/index.js";
import { signToken, authMiddleware, updateLastActive, logAudit } from "../middleware/auth.js";

const router = Router();

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
