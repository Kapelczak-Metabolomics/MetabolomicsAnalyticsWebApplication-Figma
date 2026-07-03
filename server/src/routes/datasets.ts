import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware, logAudit, createNotification } from "../middleware/auth.js";
import { loadDatasetMatrix } from "../utils/dataset.js";
import { computeFeatureStats } from "../services/analysis.js";

const router = Router();

function parseCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
  return { headers, rows };
}

router.post("/import", authMiddleware, async (req: Request, res: Response) => {
  const { projectId, name, type, csv } = req.body as { projectId: number; name: string; type?: string; csv: string };
  if (!projectId || !name?.trim() || !csv?.trim()) {
    res.status(400).json({ error: "projectId, name, and csv are required" });
    return;
  }

  try {
    const { headers, rows } = parseCsv(csv);
    const sampleIdIdx = headers.findIndex((h) => /sample/i.test(h));
    const groupIdx = headers.findIndex((h) => /group|class/i.test(h));
    if (sampleIdIdx < 0 || groupIdx < 0) {
      res.status(400).json({ error: "CSV must include sample ID and group columns" });
      return;
    }

    const featureHeaders = headers.map((h, i) => ({ h, i })).filter(({ i }) => i !== sampleIdIdx && i !== groupIdx);
    let missing = 0;
    let total = 0;

    const ds = await query<{ id: number }>(
      `INSERT INTO datasets (project_id, name, type, samples_count, features_count, status, missing_pct)
       VALUES ($1, $2, $3, $4, $5, 'ready', 0) RETURNING id`,
      [projectId, name.trim(), type ?? "CSV Import", rows.length, featureHeaders.length]
    );
    const datasetId = ds.rows[0].id;

    const sampleRows: { id: number; group: string }[] = [];
    for (const row of rows) {
      const r = await query<{ id: number }>(
        `INSERT INTO samples (dataset_id, sample_id, group_label) VALUES ($1, $2, $3) RETURNING id`,
        [datasetId, row[sampleIdIdx], row[groupIdx]]
      );
      sampleRows.push({ id: r.rows[0].id, group: row[groupIdx] });
    }

    const featureIds: number[] = [];
    for (const { h, i } of featureHeaders) {
      const r = await query<{ id: number }>(
        `INSERT INTO features (dataset_id, feature_id, name) VALUES ($1, $2, $3) RETURNING id`,
        [datasetId, `F${featureIds.length + 1}`.padStart(4, "0"), h]
      );
      featureIds.push(r.rows[0].id);
    }

    for (let si = 0; si < rows.length; si++) {
      for (let fi = 0; fi < featureHeaders.length; fi++) {
        const raw = rows[si][featureHeaders[fi].i];
        total++;
        const val = raw === "" || raw == null ? null : parseFloat(raw);
        if (val == null || isNaN(val)) missing++;
        await query(
          `INSERT INTO feature_values (sample_id, feature_id, value) VALUES ($1, $2, $3)`,
          [sampleRows[si].id, featureIds[fi], val != null && !isNaN(val) ? val : null]
        );
      }
    }

    const missingPct = total ? Number(((missing / total) * 100).toFixed(1)) : 0;
    await query(`UPDATE datasets SET missing_pct = $1 WHERE id = $2`, [missingPct, datasetId]);
    await query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);

    await logAudit(req.user, "DATASET_IMPORT", "data", `Dataset: ${name}`, `Imported ${rows.length} samples, ${featureHeaders.length} features from CSV.`, req);
    await createNotification(req.user!.id, "success", "Dataset Imported", `${name} imported — ${featureHeaders.length} features, ${rows.length} samples ready.`, "/data", "View dataset");

    res.status(201).json({ id: datasetId, samples: rows.length, features: featureHeaders.length, missingPct });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  const result = await query<{
    id: number; name: string; type: string; samples_count: number; features_count: number; status: string; project_id: number; project_name: string;
  }>(
    `SELECT d.id, d.name, d.type, d.samples_count, d.features_count, d.status, d.project_id, p.name AS project_name
     FROM datasets d JOIN projects p ON p.id = d.project_id
     WHERE d.status = 'ready' ORDER BY d.created_at DESC`
  );
  res.json(result.rows);
});

router.get("/:id/features", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = (page - 1) * limit;
  const search = (req.query.search as string) || "";

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM features WHERE dataset_id = $1 AND (name ILIKE $2 OR feature_id ILIKE $2)`,
    [id, `%${search}%`]
  );

  const { samples, features } = await loadDatasetMatrix(id);
  const stats = computeFeatureStats(samples, features);

  const filtered = search
    ? stats.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.featureId.toLowerCase().includes(search.toLowerCase()))
    : stats;

  res.json({
    total: parseInt(countResult.rows[0].count, 10),
    page,
    limit,
    features: filtered.slice(offset, offset + limit),
  });
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const result = await query(
  `SELECT d.*, p.name AS project_name FROM datasets d JOIN projects p ON p.id = d.project_id WHERE d.id = $1`,
    [id]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  res.json(result.rows[0]);
});

export default router;
