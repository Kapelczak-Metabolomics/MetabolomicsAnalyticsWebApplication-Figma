import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{ id: number; name: string; criteria: unknown; weights: unknown; created_at: Date }>(
    `SELECT id, name, criteria, weights, created_at FROM biomarker_lenses WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.id]
  );
  res.json(result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    criteria: r.criteria,
    weights: r.weights,
    createdAt: r.created_at,
  })));
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { name, criteria, weights } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const result = await query<{ id: number }>(
    `INSERT INTO biomarker_lenses (user_id, name, criteria, weights) VALUES ($1, $2, $3, $4) RETURNING id`,
    [req.user!.id, name.trim(), JSON.stringify(criteria ?? []), JSON.stringify(weights ?? {})]
  );
  res.status(201).json({ id: result.rows[0].id });
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response) => {
  const { name, criteria, weights } = req.body;
  await query(
    `UPDATE biomarker_lenses SET name = COALESCE($1, name), criteria = COALESCE($2, criteria), weights = COALESCE($3, weights)
     WHERE id = $4 AND user_id = $5`,
    [name, criteria ? JSON.stringify(criteria) : null, weights ? JSON.stringify(weights) : null, req.params.id, req.user!.id]
  );
  res.json({ success: true });
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  await query(`DELETE FROM biomarker_lenses WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id]);
  res.json({ success: true });
});

router.get("/watchlist", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{ id: number; feature_name: string; feature_id: string; dataset_id: number }>(
    `SELECT id, feature_name, feature_id, dataset_id FROM feature_watchlist WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.id]
  );
  res.json(result.rows);
});

router.post("/watchlist", authMiddleware, async (req: Request, res: Response) => {
  const { featureName, featureId, datasetId } = req.body;
  await query(
    `INSERT INTO feature_watchlist (user_id, feature_name, feature_id, dataset_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, feature_name, dataset_id) DO NOTHING`,
    [req.user!.id, featureName, featureId ?? null, datasetId ?? null]
  );
  res.status(201).json({ success: true });
});

router.delete("/watchlist/:id", authMiddleware, async (req: Request, res: Response) => {
  await query(`DELETE FROM feature_watchlist WHERE id = $1 AND user_id = $2`, [req.params.id, req.user!.id]);
  res.json({ success: true });
});

export default router;
