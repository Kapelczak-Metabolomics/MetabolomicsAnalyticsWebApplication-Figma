import { Router, Request, Response, NextFunction } from "express";
import { query } from "../db/index.js";
import { authMiddleware, logAudit, createNotification } from "../middleware/auth.js";
import { loadDatasetMatrix } from "../utils/dataset.js";
import { computeFeatureStats } from "../services/analysis.js";
import { bulkLoadMatrix } from "../utils/bulk-import.js";
import { pythonHealth, pythonImportMzxml, pythonPreviewMzxml } from "../services/python-client.js";
import { saveRawDatasetFiles, deleteRawDatasetFiles } from "../services/storage.js";
import fs from "fs";
import path from "path";
import {
  addFileToMzxmlSession,
  cleanupMzxmlSession,
  createMzxmlSession,
  getSessionUploadFiles,
  loadMzxmlSession,
} from "../utils/mzxml-session.js";
import {
  cleanupUploadFiles,
  MAX_MZXML_UPLOAD_BYTES,
  mzxmlUpload,
  uploadsFromRequest,
  type MzxmlUploadFile,
} from "../utils/mzxml-upload.js";
import {
  type ColumnMapping,
  parseDelimitedTable,
  buildSamplesFromMapping,
  buildFeaturesFromMapping,
  autoSampleGroups,
  guessColumnRoles,
} from "../utils/csv-parse.js";

const router = Router();

function handleUpload(
  req: Request,
  res: Response,
  next: NextFunction
) {
  mzxmlUpload.array("files", 50)(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err && typeof err === "object" && "code" in err) {
      const code = String((err as { code: string }).code);
      const message =
        code === "LIMIT_FILE_SIZE"
          ? `File too large — maximum upload size is ${MAX_MZXML_UPLOAD_BYTES / (1024 * 1024)} MB`
          : code === "LIMIT_FILE_COUNT"
            ? "Too many files — maximum is 50 per upload"
            : err instanceof Error
              ? err.message
              : "Upload failed";
      res.status(400).json({ error: message });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
  });
}

function normalizeMapping(body: Record<string, unknown>): ColumnMapping | null {
  const sampleColumn = typeof body.sampleColumn === "string" ? body.sampleColumn : null;
  if (!sampleColumn) return null;
  const mapping: ColumnMapping = { sampleColumn };
  if (typeof body.groupColumn === "string" && body.groupColumn) {
    mapping.groupColumn = body.groupColumn;
  } else if (body.groupColumn === null) {
    mapping.groupColumn = null;
  }
  if (Array.isArray(body.featureColumns)) {
    mapping.featureColumns = body.featureColumns.filter((c): c is string => typeof c === "string");
  }
  if (body.sampleGroups && typeof body.sampleGroups === "object" && !Array.isArray(body.sampleGroups)) {
    mapping.sampleGroups = Object.fromEntries(
      Object.entries(body.sampleGroups as Record<string, unknown>).map(([k, v]) => [k, String(v)])
    );
  }
  return mapping;
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
  const body = req.body as {
    projectId: number;
    name: string;
    type?: string;
    csv: string;
    sampleColumn?: string;
    groupColumn?: string | null;
    featureColumns?: string[];
    sampleGroups?: Record<string, string>;
  };
  const { projectId, name, type, csv } = body;
  if (!projectId || !name?.trim() || !csv?.trim()) {
    res.status(400).json({ error: "projectId, name, and csv are required" });
    return;
  }

  try {
    const table = parseDelimitedTable(csv);
    if (!table.headers.length || !table.rows.length) {
      res.status(400).json({ error: "CSV must have a header row and at least one data row" });
      return;
    }

    let mapping = normalizeMapping(body);
    if (!mapping) {
      const roles = guessColumnRoles(table);
      const sampleColumn = Object.entries(roles).find(([, role]) => role === "sample")?.[0];
      const groupColumn = Object.entries(roles).find(([, role]) => role === "group")?.[0];
      if (!sampleColumn) {
        res.status(400).json({ error: "CSV must include a sample ID column (or provide sampleColumn mapping)" });
        return;
      }
      mapping = { sampleColumn };
      if (groupColumn) mapping.groupColumn = groupColumn;
      mapping.featureColumns = Object.entries(roles)
        .filter(([, role]) => role === "feature")
        .map(([header]) => header);
    }

    if (!mapping.groupColumn) {
      if (!mapping.sampleGroups || !Object.keys(mapping.sampleGroups).length) {
        mapping.sampleGroups = autoSampleGroups(table, mapping.sampleColumn);
      }
    }

    const samples = buildSamplesFromMapping(table, mapping);
    const features = buildFeaturesFromMapping(table, mapping);
    if (!features.length) {
      res.status(400).json({ error: "No feature columns found in CSV" });
      return;
    }

    const ds = await query<{ id: number }>(
      `INSERT INTO datasets (project_id, name, type, samples_count, features_count, status, missing_pct, source_format, import_status)
       VALUES ($1, $2, $3, 0, 0, 'processing', 0, 'csv', 'processing') RETURNING id`,
      [projectId, name.trim(), type ?? "CSV Import"]
    );
    const datasetId = ds.rows[0].id;

    const { samplesCount, featuresCount, missingPct } = await bulkLoadMatrix(datasetId, samples, features);
    await finalizeDatasetImport(datasetId, projectId, name.trim(), samplesCount, featuresCount, missingPct, "csv", req.user!.id, req);

    res.status(201).json({ id: datasetId, samples: samplesCount, features: featuresCount, missingPct, status: "ready" });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

function handleSingleUpload(req: Request, res: Response, next: NextFunction) {
  mzxmlUpload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err && typeof err === "object" && "code" in err) {
      const code = String((err as { code: string }).code);
      const message =
        code === "LIMIT_FILE_SIZE"
          ? `File too large — maximum upload size is ${MAX_MZXML_UPLOAD_BYTES / (1024 * 1024)} MB`
          : err instanceof Error
            ? err.message
            : "Upload failed";
      res.status(400).json({ error: message });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
  });
}

async function previewMzxmlUploads(uploads: MzxmlUploadFile[], res: Response, cleanup = true) {
  const filenameSamples = uploads.map((f) => ({
    filename: f.filename,
    sampleId: f.filename.replace(/\.(mzxml|mzml|xml|zip)$/i, ""),
  }));

  let samples = filenameSamples;
  let warning: string | undefined;

  try {
    if (!(await pythonHealth()).ok) {
      warning = "Python analysis service is offline — sample names are from filenames only.";
    } else {
      try {
        const preview = await pythonPreviewMzxml(uploads);
        if (preview.samples?.length) samples = preview.samples;
      } catch (err) {
        warning =
          err instanceof Error
            ? err.message
            : "Could not parse mzXML spectra — sample names are from filenames only.";
      }
    }
    res.json({ samples, warning });
  } finally {
    if (cleanup) await cleanupUploadFiles(uploads);
  }
}

router.post("/import/mzxml/session", authMiddleware, (req: Request, res: Response) => {
  const session = createMzxmlSession(req.user!.id);
  res.json({ sessionId: session.id });
});

router.post(
  "/import/mzxml/session/:sessionId/file",
  authMiddleware,
  handleSingleUpload,
  async (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const session = loadMzxmlSession(sessionId, req.user!.id);
    if (!session) {
      res.status(404).json({ error: "Upload session not found or expired — select files again." });
      return;
    }

    const uploaded = req.file;
    if (!uploaded) {
      res.status(400).json({ error: "No file received" });
      return;
    }

    const filename = uploaded.originalname || path.basename(uploaded.path);
    const dest = path.join(session.dir, path.basename(filename));
    try {
      if (uploaded.path !== dest) {
        fs.renameSync(uploaded.path, dest);
      }
      addFileToMzxmlSession(sessionId, req.user!.id, { path: dest, filename: path.basename(filename) });
      const updated = loadMzxmlSession(sessionId, req.user!.id);
      res.json({
        sessionId,
        filename: path.basename(filename),
        fileCount: updated?.files.length ?? 0,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to store uploaded file" });
    }
  }
);

router.post("/import/mzxml/preview-session", authMiddleware, async (req: Request, res: Response) => {
  const sessionId = String(req.body?.sessionId ?? "");
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  const uploads = getSessionUploadFiles(sessionId, req.user!.id);
  if (!uploads.length) {
    res.status(400).json({ error: "No files in upload session" });
    return;
  }
  await previewMzxmlUploads(uploads, res, false);
});

router.post("/import/mzxml/preview", authMiddleware, handleUpload, async (req: Request, res: Response) => {
  const uploads = uploadsFromRequest(req.files as Express.Multer.File[] | undefined);
  if (!uploads.length) {
    res.status(400).json({ error: "At least one mzXML file is required" });
    return;
  }
  await previewMzxmlUploads(uploads, res, true);
});

router.post("/import/mzxml", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  if (req.is("multipart/form-data")) {
    handleUpload(req, res, () => processMzxmlImport(req, res));
    return;
  }
  if (req.body?.sessionId) {
    await processMzxmlImport(req, res);
    return;
  }
  res.status(400).json({ error: "Provide multipart files or a sessionId from staged uploads" });
});

async function processMzxmlImport(req: Request, res: Response) {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const projectId = parseInt(String(req.body.projectId), 10);
  const name = String(req.body.name || "").trim();
  const groupsRaw = req.body.groups as string | Record<string, string> | undefined;

  if (!projectId || Number.isNaN(projectId) || !name) {
    res.status(400).json({ error: "projectId and name are required" });
    return;
  }

  let uploads: MzxmlUploadFile[];
  if (sessionId) {
    uploads = getSessionUploadFiles(sessionId, req.user!.id);
  } else {
    uploads = uploadsFromRequest(req.files as Express.Multer.File[] | undefined);
  }
  if (!uploads.length) {
    res.status(400).json({ error: "At least one mzXML file is required" });
    return;
  }

  if (!(await pythonHealth()).ok) {
    if (!sessionId) await cleanupUploadFiles(uploads);
    res.status(503).json({
      error: "Python analysis service is not running. mzXML import requires the Python service to be healthy before upload.",
    });
    return;
  }

  let groups: Record<string, string> = {};
  if (groupsRaw) {
    try {
      groups = typeof groupsRaw === "string" ? JSON.parse(groupsRaw) : (groupsRaw as Record<string, string>);
    } catch {
      if (!sessionId) await cleanupUploadFiles(uploads);
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

  launchMzxmlImport({
    datasetId,
    projectId,
    name,
    userId,
    uploads,
    groups,
    sessionId: sessionId || undefined,
  }).catch((err) => console.error("mzXML import launcher failed for dataset", datasetId, err));
}

async function launchMzxmlImport(opts: {
  datasetId: number;
  projectId: number;
  name: string;
  userId: number;
  uploads: MzxmlUploadFile[];
  groups: Record<string, string>;
  sessionId?: string;
}) {
  const { datasetId, projectId, name, userId, uploads, groups, sessionId } = opts;
  try {
    const storagePath = await saveRawDatasetFiles(
      datasetId,
      uploads.map((f) => ({ filename: f.filename, path: f.path })),
    );
    await query(`UPDATE datasets SET raw_file_path = $1 WHERE id = $2`, [storagePath, datasetId]);

    const parsed = await pythonImportMzxml(uploads, groups);
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
    const message = err instanceof Error && err.message.trim()
      ? err.message
      : err != null
        ? String(err)
        : "mzXML import failed";
    console.error("mzXML import failed for dataset", datasetId, err);
    await query(
      `UPDATE datasets SET status = 'failed', import_status = 'failed', import_error = $1 WHERE id = $2`,
      [message, datasetId]
    );
    await createNotification(userId, "error", "mzXML Import Failed", message, "/data/import", "Retry import");
  } finally {
    if (sessionId) {
      await cleanupMzxmlSession(sessionId);
    } else {
      await cleanupUploadFiles(uploads);
    }
  }
}

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
  const existing = await query<{ raw_file_path: string | null }>("SELECT raw_file_path FROM datasets WHERE id = $1", [id]);
  await query("DELETE FROM datasets WHERE id = $1", [id]);
  await deleteRawDatasetFiles(existing.rows[0]?.raw_file_path);
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
