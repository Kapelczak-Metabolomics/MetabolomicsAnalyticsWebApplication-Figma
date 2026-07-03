import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware, logAudit } from "../middleware/auth.js";
import { formatRelativeTime } from "../utils/dataset.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const result = await query<{
    id: number;
    name: string;
    description: string;
    status: string;
    color: string;
    updated_at: Date;
    datasets: string;
    samples: string;
  }>(
    `SELECT p.id, p.name, p.description, p.status, p.color, p.updated_at,
            COUNT(DISTINCT d.id)::text AS datasets,
            COALESCE(SUM(d.samples_count), 0)::text AS samples
     FROM projects p
     LEFT JOIN datasets d ON d.project_id = p.id
     GROUP BY p.id
     ORDER BY p.updated_at DESC`
  );

  res.json(
    result.rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      color: p.color,
      datasets: parseInt(p.datasets, 10),
      samples: parseInt(p.samples, 10),
      lastModified: formatRelativeTime(p.updated_at),
    }))
  );
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const project = await query<{ id: number; name: string; description: string; status: string; color: string; updated_at: Date }>(
    "SELECT id, name, description, status, color, updated_at FROM projects WHERE id = $1",
    [id]
  );
  if (!project.rows[0]) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const datasets = await query<{
    id: number; name: string; type: string; samples_count: number; features_count: number; status: string; created_at: Date;
  }>(
    `SELECT id, name, type, samples_count, features_count, status, created_at
     FROM datasets WHERE project_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  const experiments = await query<{
    id: number; name: string; type: string; status: string; created_at: Date;
  }>(
    `SELECT id, name, type, status, created_at FROM experiments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [id]
  );

  const p = project.rows[0];
  res.json({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    color: p.color,
    datasets: datasets.rows.map((d) => ({
      id: String(d.id),
      name: d.name,
      type: d.type,
      samples: d.samples_count,
      features: d.features_count,
      created: new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: d.status,
    })),
    experiments: experiments.rows.map((e) => ({
      id: String(e.id),
      name: e.name,
      type: e.type,
      status: e.status,
      created: formatRelativeTime(e.created_at),
    })),
  });
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { name, description, type } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  const colors = ["violet", "cyan", "emerald", "amber", "rose"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const result = await query<{ id: number }>(
    `INSERT INTO projects (name, description, owner_id, color) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name.trim(), description?.trim() ?? "", req.user!.id, color]
  );

  await logAudit(req.user, "CREATE_PROJECT", "data", `Project: ${name}`, `Created project "${name}" (${type ?? "metabolomics"})`, req);

  res.status(201).json({ id: result.rows[0].id, name, color });
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const { name, description, status } = req.body;
  await query(
    `UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = NOW() WHERE id = $4`,
    [name, description, status, id]
  );
  res.json({ success: true });
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  await query("DELETE FROM projects WHERE id = $1", [id]);
  await logAudit(req.user, "DELETE_PROJECT", "data", `Project #${id}`, "Project deleted", req);
  res.json({ success: true });
});

export default router;
