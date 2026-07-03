import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.post("/feedback", authMiddleware, async (req: Request, res: Response) => {
  const { articleId, helpful } = req.body;
  await query(
    `INSERT INTO help_feedback (user_id, article_id, helpful) VALUES ($1, $2, $3)`,
    [req.user!.id, articleId ?? null, !!helpful]
  );
  res.json({ success: true });
});

export default router;
