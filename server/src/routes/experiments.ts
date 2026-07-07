import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware, logAudit, createNotification, type AuthUser } from "../middleware/auth.js";
import { loadDatasetMatrix, formatRelativeTime, formatDuration, analysisMaxFeatures } from "../utils/dataset.js";
import { getProcessUsage } from "../utils/metrics.js";
import { computeWithEngine } from "../services/compute-analysis.js";
import { canAccessDataset, canAccessExperiment, canAccessProject, experimentVisibilitySql } from "../utils/access.js";

const router = Router();

/** Datasets at or below this size complete in-process before the HTTP response returns. */
const SYNC_ANALYSIS_MAX_CELLS = 100_000;

async function executeAnalysis(experimentId: number, type: string, datasetId: number, userId: number, config: Record<string, unknown> = {}) {
  await query(`UPDATE experiments SET status = 'running', started_at = NOW() WHERE id = $1`, [experimentId]);

  try {
    const { samples, features } = await loadDatasetMatrix(datasetId, { maxFeatures: analysisMaxFeatures() });
    const results = await computeWithEngine(type, samples, features, config);

    const usage = getProcessUsage();
    await query(
      `UPDATE experiments SET status = 'completed', results = $1, completed_at = NOW(),
       samples_count = $2, features_count = $3, cpu_usage = $4, mem_usage = $5
       WHERE id = $6`,
      [JSON.stringify(results), samples.length, features.length, usage.cpu, usage.mem, experimentId]
    );

    const exp = await query<{ name: string }>("SELECT name FROM experiments WHERE id = $1", [experimentId]);
    await createNotification(userId, "success", "Analysis Complete", `${exp.rows[0].name} finished successfully. ${samples.length} samples processed.`, `/experiments/${experimentId}`, "View results");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await query(`UPDATE experiments SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`, [message, experimentId]);
    const exp = await query<{ name: string }>("SELECT name FROM experiments WHERE id = $1", [experimentId]);
    await createNotification(userId, "error", "Analysis Failed", `${exp.rows[0].name} failed. ${message}`, `/experiments/${experimentId}`, "View error log");
  }
}

function launchAnalysis(
  experimentId: number,
  type: string,
  datasetId: number,
  userId: number,
  config: Record<string, unknown>
) {
  return executeAnalysis(experimentId, type, datasetId, userId, config).catch(async (err) => {
    console.error(`Unhandled analysis error for experiment ${experimentId}:`, err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    await query(
      `UPDATE experiments SET status = 'failed', error_message = $1, completed_at = NOW()
       WHERE id = $2 AND status NOT IN ('completed', 'failed')`,
      [message, experimentId]
    ).catch((dbErr) => console.error(`Failed to mark experiment ${experimentId} as failed:`, dbErr));
  });
}

/** Pathway enrichment queries KEGG live — always run in background. */
const ASYNC_ANALYSIS_TYPES = new Set(["Pathway"]);

async function datasetCellCount(datasetId: number): Promise<number> {
  const result = await query<{ samples_count: number; features_count: number }>(
    "SELECT samples_count, features_count FROM datasets WHERE id = $1",
    [datasetId]
  );
  const row = result.rows[0];
  return (row?.samples_count ?? 0) * (row?.features_count ?? 0);
}

type ExperimentRow = {
  id: number;
  name: string;
  type: string;
  status: string;
  user_id: number | null;
  project_id: number;
  owner_id: number | null;
};

async function getExperimentForAuth(id: number): Promise<ExperimentRow | null> {
  const result = await query<ExperimentRow>(
    `SELECT e.id, e.name, e.type, e.status, e.user_id, e.project_id, p.owner_id
     FROM experiments e
     JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

function canDeleteExperiment(user: AuthUser, exp: ExperimentRow): boolean {
  if (user.role === "Administrator") return true;
  if (exp.user_id === user.id) return true;
  if (exp.owner_id === user.id) return true;
  return false;
}

function isInProgress(status: string): boolean {
  return status === "running" || status === "pending";
}

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const projectId = req.query.projectId;
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (projectId) {
    params.push(projectId);
    conditions.push(`e.project_id = $${params.length}`);
  }
  const visibility = experimentVisibilitySql(req.user!, "e", params.length + 1);
  if (visibility.clause !== "TRUE") {
    conditions.push(visibility.clause);
    params.push(...visibility.params);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT e.id, e.name, e.type, e.status, e.created_at, e.user_id, p.name AS project, p.owner_id
             FROM experiments e JOIN projects p ON p.id = e.project_id${where} ORDER BY e.created_at DESC LIMIT 50`;

  const result = await query<{
    id: number; name: string; type: string; status: string; created_at: Date;
    user_id: number | null; project: string; owner_id: number | null;
  }>(sql, params);

  const user = req.user!;
  res.json(
    result.rows.map((e) => ({
      id: String(e.id),
      name: e.name,
      project: e.project,
      type: e.type,
      created: formatRelativeTime(e.created_at),
      status: e.status,
      userId: e.user_id,
      canDelete: canDeleteExperiment(user, {
        id: e.id,
        name: e.name,
        type: e.type,
        status: e.status,
        user_id: e.user_id,
        project_id: 0,
        owner_id: e.owner_id,
      }) && (user.role === "Administrator" || !isInProgress(e.status)),
    }))
  );
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessExperiment(req.user!, id))) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }
  const result = await query<{
    id: number; name: string; type: string; status: string; config: unknown; results: unknown;
    error_message: string | null; samples_count: number; features_count: number;
    created_at: Date; started_at: Date | null; completed_at: Date | null;
    project_name: string; dataset_name: string | null; dataset_id: number | null;
    user_name: string | null; user_id: number | null; project_id: number;
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
  const user = req.user!;
  const expRow: ExperimentRow = {
    id: e.id,
    name: e.name,
    type: e.type,
    status: e.status,
    user_id: e.user_id,
    project_id: e.project_id,
    owner_id: null,
  };
  const owner = await query<{ owner_id: number | null }>("SELECT owner_id FROM projects WHERE id = $1", [e.project_id]);
  expRow.owner_id = owner.rows[0]?.owner_id ?? null;

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
    datasetId: e.dataset_id,
    userId: e.user_id,
    userName: e.user_name,
    createdAt: e.created_at,
    startedAt: e.started_at,
    completedAt: e.completed_at,
    duration: e.started_at && e.completed_at ? formatDuration(new Date(e.started_at), new Date(e.completed_at)) : null,
    canDelete: canDeleteExperiment(user, expRow) && (user.role === "Administrator" || !isInProgress(e.status)),
  });
});

router.get("/:id/export", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessExperiment(req.user!, id))) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }
  const format = String(req.query.format ?? "json");
  const result = await query<{ name: string; type: string; results: unknown }>(
    `SELECT name, type, results FROM experiments WHERE id = $1`,
    [id]
  );
  if (!result.rows[0]?.results) {
    res.status(404).json({ error: "No results to export" });
    return;
  }
  const data = result.rows[0];
  if (format === "csv" && data.results && typeof data.results === "object") {
    const results = data.results as Record<string, unknown>;
    const arrays: Array<Record<string, unknown>> | undefined =
      (results.features as Array<Record<string, unknown>>) ??
      (results.scores as Array<Record<string, unknown>>) ??
      (results.pathways as Array<Record<string, unknown>>) ??
      (results.candidates as Array<Record<string, unknown>>) ??
      (results.clusters as Array<Record<string, unknown>>) ??
      (results.vipFeatures as Array<Record<string, unknown>>);
    if (arrays?.length) {
      const headers = Object.keys(arrays[0]);
      const csv = [headers.join(","), ...arrays.map((f) => headers.map((h) => JSON.stringify(f[h] ?? "")).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${data.name}.csv"`);
      res.send(csv);
      return;
    }
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${data.name}.json"`);
  res.send(JSON.stringify(data.results, null, 2));
});

router.post("/:id/cancel", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  await query(`UPDATE experiments SET status = 'failed', error_message = 'Cancelled by user', completed_at = NOW() WHERE id = $1 AND status IN ('pending', 'running')`, [id]);
  await logAudit(req.user, "CANCEL_RUN", "analysis", `Experiment #${id}`, "Run cancelled", req);
  res.json({ success: true });
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const exp = await getExperimentForAuth(id);

  if (!exp) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }

  const user = req.user!;
  if (!canDeleteExperiment(user, exp)) {
    res.status(403).json({ error: "You do not have permission to delete this analysis run" });
    return;
  }

  if (isInProgress(exp.status) && user.role !== "Administrator") {
    res.status(400).json({ error: "Cannot delete a run in progress. Cancel it first or wait for it to finish." });
    return;
  }

  await query("DELETE FROM experiments WHERE id = $1", [id]);
  await logAudit(
    user,
    "DELETE_RUN",
    "analysis",
    `Experiment: ${exp.name}`,
    `Deleted ${exp.type} run #${id} (${exp.status})`,
    req
  );
  res.json({ success: true });
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { projectId, datasetId, name, type, config } = req.body;
  if (!projectId || !name || !type) {
    res.status(400).json({ error: "projectId, name, and type are required" });
    return;
  }
  if (!(await canAccessProject(req.user!, projectId))) {
    res.status(403).json({ error: "You do not have access to this project" });
    return;
  }
  if (datasetId && !(await canAccessDataset(req.user!, datasetId))) {
    res.status(403).json({ error: "You do not have access to this dataset" });
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
  if (!(await canAccessExperiment(req.user!, id))) {
    res.status(404).json({ error: "Experiment not found" });
    return;
  }
  const exp = await query<{ dataset_id: number; type: string; user_id: number; config: unknown }>(
    "SELECT dataset_id, type, user_id, config FROM experiments WHERE id = $1",
    [id]
  );

  if (!exp.rows[0]?.dataset_id) {
    res.status(400).json({ error: "Experiment has no dataset" });
    return;
  }

  const config = (exp.rows[0].config as Record<string, unknown>) ?? {};
  const userId = exp.rows[0].user_id ?? req.user!.id;
  await query(`UPDATE experiments SET status = 'running', started_at = NOW() WHERE id = $1`, [id]);
  const job = launchAnalysis(id, exp.rows[0].type, exp.rows[0].dataset_id, userId, config);
  const cells = await datasetCellCount(exp.rows[0].dataset_id);
  if (cells <= SYNC_ANALYSIS_MAX_CELLS && !ASYNC_ANALYSIS_TYPES.has(exp.rows[0].type)) {
    await job;
    const final = await query<{ status: string }>("SELECT status FROM experiments WHERE id = $1", [id]);
    res.json({ status: final.rows[0]?.status ?? "running", id });
    return;
  }
  void job;
  res.json({ status: "running", id });
});

router.post("/run", authMiddleware, async (req: Request, res: Response) => {
  const { projectId, datasetId, name, type, config } = req.body;
  if (!projectId || !datasetId || !name || !type) {
    res.status(400).json({ error: "projectId, datasetId, name, and type are required" });
    return;
  }
  if (!(await canAccessProject(req.user!, projectId))) {
    res.status(403).json({ error: "You do not have access to this project" });
    return;
  }
  if (!(await canAccessDataset(req.user!, datasetId))) {
    res.status(403).json({ error: "You do not have access to this dataset" });
    return;
  }

  const result = await query<{ id: number }>(
    `INSERT INTO experiments (project_id, dataset_id, user_id, name, type, config, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
    [projectId, datasetId, req.user!.id, name, type, JSON.stringify(config ?? {})]
  );

  const experimentId = result.rows[0].id;
  await logAudit(req.user, "RUN_ANALYSIS", "analysis", `Experiment: ${name}`, `Started ${type} analysis`, req);

  // Fail this user's own stuck prior runs for this dataset + type so reruns start clean.
  await query(
    `UPDATE experiments SET status = 'failed', error_message = 'Superseded by new run', completed_at = NOW()
     WHERE dataset_id = $1 AND type = $2 AND user_id = $3 AND status IN ('pending', 'running') AND id <> $4`,
    [datasetId, type, req.user!.id, experimentId]
  );

  await query(`UPDATE experiments SET status = 'running', started_at = NOW() WHERE id = $1`, [experimentId]);

  const job = launchAnalysis(experimentId, type, datasetId, req.user!.id, (config as Record<string, unknown>) ?? {});
  const cells = await datasetCellCount(datasetId);

  if (cells <= SYNC_ANALYSIS_MAX_CELLS && !ASYNC_ANALYSIS_TYPES.has(type)) {
    await job;
    const final = await query<{ status: string }>("SELECT status FROM experiments WHERE id = $1", [experimentId]);
    res.status(201).json({ id: experimentId, status: final.rows[0]?.status ?? "running" });
    return;
  }

  void job;
  res.status(201).json({ id: experimentId, status: "running" });
});

export default router;
