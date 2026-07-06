import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { query } from "../db/index.js";
import { authMiddleware, logAudit, createNotification } from "../middleware/auth.js";
import { loadDatasetMatrix } from "../utils/dataset.js";
import { computeFeatureStats } from "../services/analysis.js";
import { bulkLoadMatrix } from "../utils/bulk-import.js";
import { pythonImportMzxml } from "../services/python-client.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const RAW_DIR = process.env.RAW_DATA_DIR || "/data/raw";

function parseCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
  return { headers, rows };
}

async function finalizeDatasetImport(
  datasetId: number,
  projectId: number,
  name: string,
  samplesCount: number,
  featuresCount: number,
  missingPct: number,
  sourceFormat: string,
  userId: number,
  req: Request
) {
  await query(
    `UPDATE datasets SET samples_count = $1, features_count = $2, missing_pct = $3,
     status = 'ready', import_status = 'ready', source_format = $4 WHERE id = $5`,
    [samplesCount, featuresCount, missingPct, sourceFormat, datasetId]
  );
  await query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
  await logAudit(req.user, "DATASET_IMPORT", "data", `Dataset: ${name}`, `Imported ${samplesCount} samples, ${featuresCount} features (${sourceFormat}).`, req);
  await createNotification(userId, "success", "Dataset Imported", `${name} imported — ${featuresCount} features, ${samplesCount} samples ready.`, "/data", "View dataset");
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

    const ds = await query<{ id: number }>(
      `INSERT INTO datasets (project_id, name, type, samples_count, features_count, status, missing_pct, source_format, import_status)
       VALUES ($1, $2, $3, 0, 0, 'processing', 0, 'csv', 'processing') RETURNING id`,
      [projectId, name.trim(), type ?? "CSV Import"]
    );
    const datasetId = ds.rows[0].id;

    const samples = rows.map((row) => ({ sampleId: row[sampleIdIdx], groupLabel: row[groupIdx] }));
    const features = featureHeaders.map(({ h, i: colIdx }, idx) => ({
      featureId: `F${String(idx + 1).padStart(4, "0")}`,
      name: h,
      values: rows.map((row) => {
        const raw = row[colIdx];
        const val = raw === "" || raw == null ? null : parseFloat(raw);
        return val != null && !isNaN(val) ? val : null;
      }),
    }));

    const { samplesCount, featuresCount, missingPct } = await bulkLoadMatrix(datasetId, samples, features);
    await finalizeDatasetImport(datasetId, projectId, name.trim(), samplesCount, featuresCount, missingPct, "csv", req.user!.id, req);

    res.status(201).json({ id: datasetId, samples: samplesCount, features: featuresCount, missingPct, status: "ready" });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

router.post("/import/mzxml", authMiddleware, upload.array("files", 50), async (req: Request, res: Response) => {
  const projectId = parseInt(String(req.body.projectId), 10);
  const name = String(req.body.name || "").trim();
  const groupsRaw = req.body.groups as string | undefined;

  if (!projectId || !name) {
    res.status(400).json({ error: "projectId and name are required" });
    return;
  }

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    res.status(400).json({ error: "At least one mzXML file is required" });
    return;
  }

  let groups: Record<string, string> = {};
  if (groupsRaw) {
    try {
      groups = JSON.parse(groupsRaw);
    } catch {
      res.status(400).json({ error: "Invalid groups JSON" });
      return;
    }
  }

  const ds = await query<{ id: number }>(
    `INSERT INTO datasets (project_id, name, type, samples_count, features_count, status, missing_pct, source_format, import_status)
     VALUES ($1, $2, 'mzXML Import', 0, 0, 'processing', 0, 'mzXML', 'processing') RETURNING id`,
    [projectId, name]
  );
  const datasetId = ds.rows[0].id;
  const userId = req.user!.id;

  res.status(202).json({ id: datasetId, status: "processing", message: "mzXML import started" });

  // Background processing
  (async () => {
    try {
      fs.mkdirSync(RAW_DIR, { recursive: true });
      const datasetDir = path.join(RAW_DIR, String(datasetId));
      fs.mkdirSync(datasetDir, { recursive: true });

      const saved: Array<{ buffer: Buffer; filename: string }> = [];
      for (const f of files) {
        const dest = path.join(datasetDir, f.originalname);
        fs.writeFileSync(dest, f.buffer);
        saved.push({ buffer: f.buffer, filename: f.originalname });
      }

      await query(`UPDATE datasets SET raw_file_path = $1 WHERE id = $2`, [datasetDir, datasetId]);

      const parsed = await pythonImportMzxml(saved, groups);
      const samples = parsed.samples.map((s) => ({ sampleId: s.sampleId, groupLabel: s.groupLabel }));
      const features = parsed.features.map((f) => ({
        featureId: f.featureId,
        name: f.name,
        featureClass: f.featureClass,
        pathway: f.pathway,
        values: f.values,
      }));

      const { samplesCount, featuresCount, missingPct } = await bulkLoadMatrix(datasetId, samples, features);
      await query(
        `UPDATE datasets SET samples_count = $1, features_count = $2, missing_pct = $3,
         status = 'ready', import_status = 'ready' WHERE id = $4`,
        [samplesCount, featuresCount, missingPct, datasetId]
      );
      await query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
      await createNotification(
        userId,
        "success",
        "mzXML Import Complete",
        `${name}: ${featuresCount} m/z features from ${samplesCount} samples.`,
        "/data",
        "View dataset"
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "mzXML import failed";
      await query(
        `UPDATE datasets SET status = 'failed', import_status = 'failed', import_error = $1 WHERE id = $2`,
        [message, datasetId]
      );
      await createNotification(userId, "error", "mzXML Import Failed", message, "/data/import", "Retry import");
    }
  })().catch(console.error);
});

router.get("/:id/import-status", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const result = await query<{
    id: number; status: string; import_status: string; import_error: string | null;
    samples_count: number; features_count: number; missing_pct: number; source_format: string;
  }>(
    `SELECT id, status, import_status, import_error, samples_count, features_count, missing_pct, source_format
     FROM datasets WHERE id = $1`,
    [id]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  const d = result.rows[0];
  res.json({
    id: d.id,
    status: d.import_status || d.status,
    error: d.import_error,
    samples: d.samples_count,
    features: d.features_count,
    missingPct: d.missing_pct,
    sourceFormat: d.source_format,
  });
});

router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  const result = await query<{
    id: number; name: string; type: string; samples_count: number; features_count: number; status: string; project_id: number; project_name: string;
    import_status: string; source_format: string;
  }>(
    `SELECT d.id, d.name, d.type, d.samples_count, d.features_count, d.status, d.project_id, p.name AS project_name,
            d.import_status, d.source_format
     FROM datasets d JOIN projects p ON p.id = d.project_id
     WHERE d.status IN ('ready', 'processing') ORDER BY d.created_at DESC`
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

router.get("/:id/download", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const { samples, features } = await loadDatasetMatrix(id);
  const headers = ["sample_id", "group", ...features.map((f) => f.name)];
  const rows = samples.map((s, si) => [
    s.sampleId,
    s.groupLabel,
    ...features.map((f) => f.values[si] ?? ""),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="dataset-${id}.csv"`);
  res.send(csv);
});

router.get("/:id/groups", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const result = await query<{ group_label: string; count: string }>(
    `SELECT group_label, COUNT(*)::text AS count FROM samples WHERE dataset_id = $1 GROUP BY group_label`,
    [id]
  );
  res.json(result.rows.map((r) => ({ label: r.group_label, count: parseInt(r.count, 10) })));
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  await query("DELETE FROM datasets WHERE id = $1", [id]);
  res.json({ success: true });
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
