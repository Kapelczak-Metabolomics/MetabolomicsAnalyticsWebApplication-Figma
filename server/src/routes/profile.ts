import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
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

router.patch("/password", authMiddleware, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: "Current and new password (min 8 chars) required" });
    return;
  }
  const user = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
  const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user!.id]);
  res.json({ success: true });
});

router.get("/preferences", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{ preferences: unknown }>(
    "SELECT preferences FROM user_preferences WHERE user_id = $1",
    [req.user!.id]
  );
  res.json(result.rows[0]?.preferences ?? {});
});

router.patch("/preferences", authMiddleware, async (req: Request, res: Response) => {
  const preferences = req.body;
  await query(
    `INSERT INTO user_preferences (user_id, preferences, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET preferences = $2, updated_at = NOW()`,
    [req.user!.id, JSON.stringify(preferences)]
  );
  res.json({ success: true });
});

router.get("/storage", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{ bytes: string }>(
    `SELECT COALESCE(SUM(pg_column_size(fv.value)), 0)::text AS bytes
     FROM feature_values fv
     JOIN samples s ON s.id = fv.sample_id
     JOIN datasets d ON d.id = s.dataset_id
     JOIN projects p ON p.id = d.project_id
     WHERE p.owner_id = $1 OR EXISTS (
       SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1
     )`,
    [req.user!.id]
  );
  const usedBytes = parseInt(result.rows[0]?.bytes ?? "0", 10);
  const usedGb = Number((usedBytes / 1024 / 1024 / 1024).toFixed(2));
  res.json({ usedGb, quotaGb: 10 });
});

router.get("/analysis-config/:type", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{ config: unknown }>(
    `SELECT config FROM analysis_configs WHERE user_id = $1 AND analysis_type = $2`,
    [req.user!.id, req.params.type]
  );
  res.json(result.rows[0]?.config ?? {});
});

router.put("/analysis-config/:type", authMiddleware, async (req: Request, res: Response) => {
  const config = req.body;
  await query(
    `INSERT INTO analysis_configs (user_id, analysis_type, config, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, analysis_type) DO UPDATE SET config = $3, updated_at = NOW()`,
    [req.user!.id, req.params.type, JSON.stringify(config)]
  );
  res.json({ success: true });
});

export default router;
