import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { formatRelativeTime } from "../utils/dataset.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{
    id: number; type: string; title: string; message: string; read: boolean; link: string | null; link_label: string | null; created_at: Date;
  }>(
    `SELECT id, type, title, message, "read", link, link_label, created_at
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user!.id]
  );

  res.json(
    result.rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: Boolean(n.read),
      link: n.link,
      linkLabel: n.link_label,
      time: formatRelativeTime(n.created_at),
    }))
  );
});

/** Must be registered before /:id/read so "read-all" is not captured as an id. */
router.patch("/read-all", authMiddleware, async (req: Request, res: Response) => {
  await query(`UPDATE notifications SET "read" = TRUE WHERE user_id = $1 AND "read" = FALSE`, [req.user!.id]);
  res.json({ success: true });
});

router.patch("/:id/read", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }
  const result = await query(
    `UPDATE notifications SET "read" = TRUE WHERE id = $1 AND user_id = $2`,
    [id, req.user!.id]
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json({ success: true });
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!id) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }
  const result = await query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [id, req.user!.id]);
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
