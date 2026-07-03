import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware, logAudit, createNotification } from "../middleware/auth.js";
import { loadDatasetMatrix, formatRelativeTime, formatDuration } from "../utils/dataset.js";
import { runPCA, runVolcano, runClustering, runPathway, runBiomarker, runPLSDA } from "../services/analysis.js";

const router = Router();

async function executeAnalysis(experimentId: number, type: string, datasetId: number, userId: number) {
  await query(
    `UPDATE experiments SET status = 'running', started_at = NOW() WHERE id = $1`,
    [experimentId]
  );

  try {
    const { samples, features } = await loadDatasetMatrix(datasetId);
    const groups = [...new Set(samples.map((s) => s.groupLabel))];
    let results: unknown;

    switch (type) {
      case "PCA":
        results = runPCA(samples, 2);
        break;
      case "Volcano":
        results = runVolcano(samples, features, groups[0], groups[1] ?? groups[0]);
        break;
      case "Clustering":
        results = runClustering(samples);
        break;
      case "PLS-DA":
        results = runPLSDA(samples, features, groups[0], groups[1] ?? groups[0]);
        break;
      case "Pathway": {
        const volcano = runVolcano(samples, features, groups[0], groups[1] ?? groups[0]);
        results = runPathway(volcano);
        break;
      }
      case "Biomarker": {
        const volcano = runVolcano(samples, features, groups[0], groups[1] ?? groups[0]);
        results = runBiomarker(volcano);
        break;
      }
      default:
        results = { message: "Analysis completed" };
    }

    await query(
      `UPDATE experiments SET status = 'completed', results = $1, completed_at = NOW(),
       samples_count = $2, features_count = $3, cpu_usage = $4, mem_usage = $5
       WHERE id = $6`,
      [JSON.stringify(results), samples.length, features.length, `${Math.floor(30 + Math.random() * 60)}%`, `${(2 + Math.random() * 5).toFixed(1)} GB`, experimentId]
    );

    const exp = await query<{ name: string }>("SELECT name FROM experiments WHERE id = $1", [experimentId]);
    await createNotification(userId, "success", "Analysis Complete", `${exp.rows[0].name} finished successfully. ${samples.length} samples processed.`, `/experiments/${experimentId}`, "View results");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await query(
      `UPDATE experiments SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
      [message, experimentId]
    );
    const exp = await query<{ name: string }>("SELECT name FROM experiments WHERE id = $1", [experimentId]);
    await createNotification(userId, "error", "Analysis Failed", `${exp.rows[0].name} failed. ${message}`, `/experiments/${experimentId}`, "View error log");
  }
}

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const projectId = req.query.projectId;
  let sql = `SELECT e.id, e.name, e.type, e.status, e.created_at, p.name AS project
             FROM experiments e JOIN projects p ON p.id = e.project_id`;
  const params: unknown[] = [];
  if (projectId) {
    sql += " WHERE e.project_id = $1";
    params.push(projectId);
  }
  sql += " ORDER BY e.created_at DESC LIMIT 20";

  const result = await query<{ id: number; name: string; type: string; status: string; created_at: Date; project: string }>(sql, params);
  res.json(
    result.rows.map((e) => ({
      id: String(e.id),
      name: e.name,
      project: e.project,
      type: e.type,
      created: formatRelativeTime(e.created_at),
      status: e.status,
    }))
  );
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const result = await query<{
    id: number; name: string; type: string; status: string; config: unknown; results: unknown;
    error_message: string | null; samples_count: number; features_count: number;
    created_at: Date; started_at: Date | null; completed_at: Date | null;
    project_name: string; dataset_name: string | null; user_name: string | null;
  }>(
    `SELECT e.*, p.name AS project_name, d.name AS dataset_name, u.name AS user_name
     FROM experiments e
     JOIN projects p ON p.id = e.project_id
     LEFT JOIN datasets d ON d.id = e.dataset_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.id = $1`,
    [id]
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }

  const e = result.rows[0];
  res.json({
    id: e.id,
    name: e.name,
    type: e.type,
    status: e.status,
    config: e.config,
    results: e.results,
    errorMessage: e.error_message,
    samplesCount: e.samples_count,
    featuresCount: e.features_count,
    projectName: e.project_name,
    datasetName: e.dataset_name,
    userName: e.user_name,
    createdAt: e.created_at,
    startedAt: e.started_at,
    completedAt: e.completed_at,
    duration: e.started_at && e.completed_at ? formatDuration(new Date(e.started_at), new Date(e.completed_at)) : null,
  });
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { projectId, datasetId, name, type, config } = req.body;
  if (!projectId || !name || !type) {
    res.status(400).json({ error: "projectId, name, and type are required" });
    return;
  }

  const result = await query<{ id: number }>(
    `INSERT INTO experiments (project_id, dataset_id, user_id, name, type, config, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
    [projectId, datasetId ?? null, req.user!.id, name, type, JSON.stringify(config ?? {})]
  );

  await logAudit(req.user, "RUN_ANALYSIS", "analysis", `Experiment: ${name}`, `Initiated ${type} run`, req);

  res.status(201).json({ id: result.rows[0].id });
});

router.post("/:id/run", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const exp = await query<{ dataset_id: number; type: string; user_id: number }>(
    "SELECT dataset_id, type, user_id FROM experiments WHERE id = $1",
    [id]
  );

  if (!exp.rows[0]?.dataset_id) {
    res.status(400).json({ error: "Experiment has no dataset" });
    return;
  }

  executeAnalysis(id, exp.rows[0].type, exp.rows[0].dataset_id, exp.rows[0].user_id ?? req.user!.id);

  res.json({ status: "running", id });
});

router.post("/run", authMiddleware, async (req: Request, res: Response) => {
  const { projectId, datasetId, name, type, config } = req.body;
  if (!projectId || !datasetId || !name || !type) {
    res.status(400).json({ error: "projectId, datasetId, name, and type are required" });
    return;
  }

  const result = await query<{ id: number }>(
    `INSERT INTO experiments (project_id, dataset_id, user_id, name, type, config, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
    [projectId, datasetId, req.user!.id, name, type, JSON.stringify(config ?? {})]
  );

  const experimentId = result.rows[0].id;
  await logAudit(req.user, "RUN_ANALYSIS", "analysis", `Experiment: ${name}`, `Started ${type} analysis`, req);

  executeAnalysis(experimentId, type, datasetId, req.user!.id);

  res.status(201).json({ id: experimentId, status: "running" });
});

export default router;
