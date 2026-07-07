import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware, logAudit } from "../middleware/auth.js";
import { formatRelativeTime } from "../utils/dataset.js";
import { sendProjectInviteEmail, loadEmailConfig } from "../services/email.js";

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
  const project = await query<{ id: number; name: string; description: string; status: string; color: string; updated_at: Date; study_type: string; visibility: string }>(
    "SELECT id, name, description, status, color, updated_at, study_type, visibility FROM projects WHERE id = $1",
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
    id: number; name: string; type: string; status: string; created_at: Date; user_id: number | null;
  }>(
    `SELECT id, name, type, status, created_at, user_id FROM experiments WHERE project_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [id]
  );

  const p = project.rows[0];
  const members = await query<{
    id: number; email: string; name: string | null; role: string; status: string; invited_at: Date;
  }>(
    `SELECT id, email, name, role, status, invited_at FROM project_members WHERE project_id = $1 ORDER BY invited_at`,
    [id]
  );

  const owner = await query<{ name: string; email: string }>(
    `SELECT u.name, u.email FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = $1`,
    [id]
  );

  res.json({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    color: p.color,
    studyType: p.study_type ?? "metabolomics",
    visibility: p.visibility ?? "team",
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
      userId: e.user_id,
    })),
    members: [
      ...(owner.rows[0] ? [{ id: 0, name: owner.rows[0].name, email: owner.rows[0].email, role: "Owner", status: "active", joined: "Project start" }] : []),
      ...members.rows.map((m) => ({
        id: m.id,
        name: m.name ?? m.email.split("@")[0],
        email: m.email,
        role: m.role,
        status: m.status,
        joined: formatRelativeTime(m.invited_at),
      })),
    ],
  });
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { name, description, type, color, collaborators } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  const colors = ["violet", "cyan", "emerald", "amber", "rose"];
  const projectColor = color && colors.includes(color) ? color : colors[Math.floor(Math.random() * colors.length)];

  const result = await query<{ id: number }>(
    `INSERT INTO projects (name, description, owner_id, color, study_type) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name.trim(), description?.trim() ?? "", req.user!.id, projectColor, type ?? "metabolomics"]
  );

  const projectId = result.rows[0].id;
  if (Array.isArray(collaborators)) {
    for (const email of collaborators) {
      if (typeof email === "string" && email.includes("@")) {
        await query(
          `INSERT INTO project_members (project_id, email, role, status) VALUES ($1, $2, 'viewer', 'pending') ON CONFLICT DO NOTHING`,
          [projectId, email.toLowerCase().trim()]
        );
      }
    }
  }

  await logAudit(req.user, "CREATE_PROJECT", "data", `Project: ${name}`, `Created project "${name}" (${type ?? "metabolomics"})`, req);

  res.status(201).json({ id: projectId, name, color: projectColor });
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const { name, description, status, studyType, visibility } = req.body;
  await query(
    `UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description), status = COALESCE($3, status),
     study_type = COALESCE($4, study_type), visibility = COALESCE($5, visibility), updated_at = NOW() WHERE id = $6`,
    [name, description, status, studyType, visibility, id]
  );
  res.json({ success: true });
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  await query("DELETE FROM projects WHERE id = $1", [id]);
  await logAudit(req.user, "DELETE_PROJECT", "data", `Project #${id}`, "Project deleted", req);
  res.json({ success: true });
});

router.get("/:id/members", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const result = await query<{ id: number; email: string; name: string | null; role: string; status: string; invited_at: Date }>(
    `SELECT id, email, name, role, status, invited_at FROM project_members WHERE project_id = $1`,
    [id]
  );
  res.json(result.rows);
});

router.post("/:id/members", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const { email, role, name } = req.body;
  if (!email?.includes("@")) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  const result = await query<{ id: number }>(
    `INSERT INTO project_members (project_id, email, name, role, status) VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (project_id, email) DO UPDATE SET role = EXCLUDED.role RETURNING id`,
    [id, email.toLowerCase().trim(), name ?? null, role ?? "viewer"]
  );
  const project = await query<{ name: string }>("SELECT name FROM projects WHERE id = $1", [id]);
  try {
    const emailCfg = await loadEmailConfig();
    await sendProjectInviteEmail(
      email.toLowerCase().trim(),
      project.rows[0]?.name ?? `Project #${id}`,
      req.user?.name ?? "A teammate",
      emailCfg
    );
  } catch (err) {
    console.log(`[project-invite] Email not sent to ${email}:`, err instanceof Error ? err.message : err);
  }
  await logAudit(req.user, "INVITE_MEMBER", "data", `Project #${id}`, `Invited ${email}`, req);
  res.status(201).json({ id: result.rows[0].id });
});

router.patch("/:id/members/:memberId", authMiddleware, async (req: Request, res: Response) => {
  const { role, status } = req.body;
  await query(
    `UPDATE project_members SET role = COALESCE($1, role), status = COALESCE($2, status) WHERE id = $3 AND project_id = $4`,
    [role, status, req.params.memberId, req.params.id]
  );
  res.json({ success: true });
});

router.delete("/:id/members/:memberId", authMiddleware, async (req: Request, res: Response) => {
  await query(`DELETE FROM project_members WHERE id = $1 AND project_id = $2`, [req.params.memberId, req.params.id]);
  res.json({ success: true });
});

export default router;
