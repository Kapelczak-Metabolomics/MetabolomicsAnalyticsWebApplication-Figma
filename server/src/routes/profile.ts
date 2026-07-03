import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{ id: number; name: string; email: string; role: string }>(
    "SELECT id, name, email, role FROM users WHERE id = $1",
    [req.user!.id]
  );
  res.json(result.rows[0]);
});

router.patch("/", authMiddleware, async (req: Request, res: Response) => {
  const { name, email } = req.body;
  await query(
    `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3`,
    [name, email?.toLowerCase(), req.user!.id]
  );
  res.json({ success: true });
});

export default router;
