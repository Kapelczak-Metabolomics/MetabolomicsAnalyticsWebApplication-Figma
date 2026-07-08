import { Router, Request, Response, NextFunction } from "express";
import { query } from "../db/index.js";
import { authMiddleware, logAudit, createNotification } from "../middleware/auth.js";
import { loadDatasetMatrix } from "../utils/dataset.js";
import { computeFeatureStats } from "../services/analysis.js";
import { bulkLoadMatrix, clearDatasetMatrix, recalculateDatasetStats } from "../utils/bulk-import.js";
import { pythonHealth, pythonImportMzxml, pythonPreviewMzxml, pythonExtractXic } from "../services/python-client.js";
import { saveRawDatasetFiles, deleteRawDatasetFiles, listRawDatasetFiles, deleteRawDatasetFile, materializeRawDatasetFiles, cleanupWorkDir } from "../services/storage.js";
import { getActiveMetaboliteTargetsForImport, loadMetaboliteTargetSettings, parseMetaboliteTargetCsv, parseMetaboliteTargetList } from "../services/metabolite-targets.js";
import fs from "fs";
import path from "path";
import {
  addFileToMzxmlSession,
  cleanupMzxmlSession,
  createMzxmlSession,
  getSessionUploadFiles,
  loadMzxmlSession,
  removeFileFromMzxmlSession,
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
import { canAccessDataset, canAccessProject, projectVisibilitySql } from "../utils/access.js";

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

router.get("/import/metabolite-targets", authMiddleware, async (_req: Request, res: Response) => {
  const settings = await loadMetaboliteTargetSettings();
  const active = await getActiveMetaboliteTargetsForImport();
  res.json({
    enabled: settings.enabled,
    active: active.enabled,
    mzTolerance: settings.mzTolerance,
    rtTolerance: settings.rtTolerance,
    targets: settings.targets,
    targetCount: settings.targets.length,
  });
});

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
  if (!(await canAccessProject(req.user!, projectId))) {
    res.status(403).json({ error: "You do not have access to this project" });
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

/**
 * Chunked upload — the client streams the file in small pieces so EasyPanel's
 * proxy never times out or hits a body-size limit on one large request.
 * Each chunk is written at its byte offset, making retries idempotent.
 */
router.post(
  "/import/mzxml/session/:sessionId/chunk",
  authMiddleware,
  (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const session = loadMzxmlSession(sessionId, req.user!.id);
    if (!session) {
      res.status(404).json({ error: "Upload session not found or expired — select files again." });
      return;
    }

    const rawName = String(req.query.filename ?? "");
    const index = Number(req.query.index ?? 0);
    const offset = Number(req.query.offset ?? 0);
    const isLast = String(req.query.last ?? "") === "true";

    if (!rawName || !Number.isFinite(index) || !Number.isFinite(offset) || offset < 0) {
      res.status(400).json({ error: "filename, index and offset are required" });
      return;
    }
    if (offset > MAX_MZXML_UPLOAD_BYTES) {
      res.status(400).json({ error: `File too large — maximum upload size is ${MAX_MZXML_UPLOAD_BYTES / (1024 * 1024)} MB` });
      return;
    }

    const safeName = path.basename(rawName).replace(/[^\w.\-()+ ]/g, "_");
    const dest = path.join(session.dir, safeName);

    try {
      if (index === 0) {
        fs.writeFileSync(dest, Buffer.alloc(0));
      } else if (!fs.existsSync(dest)) {
        res.status(409).json({ error: "Chunk out of order — restart the upload." });
        return;
      }
    } catch {
      res.status(500).json({ error: "Failed to initialize upload file" });
      return;
    }

    let settled = false;
    const ws = fs.createWriteStream(dest, { flags: "r+", start: offset });
    const fail = (status: number, message: string) => {
      if (settled) return;
      settled = true;
      ws.destroy();
      if (!res.headersSent) res.status(status).json({ error: message });
    };

    req.on("aborted", () => fail(400, "Upload aborted"));
    req.on("error", () => fail(400, "Upload stream error"));
    ws.on("error", () => fail(500, "Failed to write chunk"));
    ws.on("finish", () => {
      if (settled) return;
      settled = true;
      try {
        const size = fs.statSync(dest).size;
        if (size > MAX_MZXML_UPLOAD_BYTES) {
          fs.rmSync(dest, { force: true });
          res.status(400).json({ error: `File too large — maximum upload size is ${MAX_MZXML_UPLOAD_BYTES / (1024 * 1024)} MB` });
          return;
        }
        if (isLast) {
          addFileToMzxmlSession(sessionId, req.user!.id, { path: dest, filename: safeName });
        }
        const updated = loadMzxmlSession(sessionId, req.user!.id);
        res.json({
          sessionId,
          filename: safeName,
          index,
          completed: isLast,
          fileCount: updated?.files.length ?? 0,
        });
      } catch {
        if (!res.headersSent) res.status(500).json({ error: "Failed to finalize chunk" });
      }
    });

    req.pipe(ws);
  }
);

router.get("/import/mzxml/session/:sessionId/files", authMiddleware, (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const session = loadMzxmlSession(sessionId, req.user!.id);
  if (!session) {
    res.status(404).json({ error: "Upload session not found or expired" });
    return;
  }
  res.json({
    sessionId,
    files: session.files.map((f) => {
      let sizeBytes = 0;
      try {
        sizeBytes = fs.statSync(f.path).size;
      } catch {
        /* ignore */
      }
      return { filename: f.filename, sizeBytes };
    }),
  });
});

router.delete("/import/mzxml/session/:sessionId/file/:filename", authMiddleware, (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const filename = path.basename(String(req.params.filename));
  const updated = removeFileFromMzxmlSession(sessionId, req.user!.id, filename);
  if (!updated) {
    res.status(404).json({ error: "Upload session not found or expired" });
    return;
  }
  res.json({ sessionId, filename, fileCount: updated.files.length });
});

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
  if (!(await canAccessProject(req.user!, projectId))) {
    res.status(403).json({ error: "You do not have access to this project" });
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
    targetOverrides: parseImportTargetOverrides(req.body),
  }).catch((err) => console.error("mzXML import launcher failed for dataset", datasetId, err));
}

function parseImportTargetOverrides(body: Record<string, unknown> | undefined) {
  if (!body) return undefined;
  if (body.useTargets === false || body.useTargets === "false") {
    return { enabled: false, targets: [] as import("../services/metabolite-targets.js").MetaboliteTarget[] };
  }
  let targetsRaw: unknown = body.targets;
  if (typeof targetsRaw === "string" && targetsRaw.trim()) {
    try {
      targetsRaw = JSON.parse(targetsRaw);
    } catch {
      return undefined;
    }
  }
  const targets = parseMetaboliteTargetList(targetsRaw);
  if (!targets.length && typeof body.targetCsv === "string" && body.targetCsv.trim()) {
    try {
      return { targets: parseMetaboliteTargetCsv(body.targetCsv), enabled: true };
    } catch {
      return undefined;
    }
  }
  if (!targets.length) return undefined;
  return {
    targets,
    enabled: body.useTargets === false || body.useTargets === "false" ? false : true,
    mzTolerance: typeof body.mzTolerance === "number" ? body.mzTolerance : undefined,
    rtTolerance: typeof body.rtTolerance === "number" ? body.rtTolerance : undefined,
  };
}

async function launchMzxmlImport(opts: {
  datasetId: number;
  projectId: number;
  name: string;
  userId: number;
  uploads: MzxmlUploadFile[];
  groups: Record<string, string>;
  sessionId?: string;
  targetOverrides?: {
    targets?: import("../services/metabolite-targets.js").MetaboliteTarget[];
    enabled?: boolean;
    mzTolerance?: number;
    rtTolerance?: number;
  };
}) {
  const { datasetId, projectId, name, userId, uploads, groups, sessionId, targetOverrides } = opts;
  try {
    const storagePath = await saveRawDatasetFiles(
      datasetId,
      uploads.map((f) => ({ filename: f.filename, path: f.path })),
    );
    await query(`UPDATE datasets SET raw_file_path = $1 WHERE id = $2`, [storagePath, datasetId]);

    await reprocessMzxmlDataset(datasetId, projectId, name, userId, uploads, groups, targetOverrides);
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

async function reprocessMzxmlDataset(
  datasetId: number,
  projectId: number,
  name: string,
  userId: number,
  uploads: MzxmlUploadFile[],
  groups: Record<string, string>,
  targetOverrides?: {
    targets?: import("../services/metabolite-targets.js").MetaboliteTarget[];
    enabled?: boolean;
    mzTolerance?: number;
    rtTolerance?: number;
  }
) {
  const targetConfig = await getActiveMetaboliteTargetsForImport(targetOverrides);
  const parsed = await pythonImportMzxml(uploads, groups, {
    targets: targetConfig.targets,
    targeted: targetConfig.enabled,
    mzTolerance: targetConfig.mzTolerance,
    rtTolerance: targetConfig.rtTolerance,
  });
  const samples = parsed.samples.map((s) => ({ sampleId: s.sampleId, groupLabel: s.groupLabel }));
  const features = parsed.features.map((f) => ({
    featureId: f.featureId,
    name: f.name,
    featureClass: f.featureClass,
    pathway: f.pathway,
    metadata: f.metadata ?? null,
    values: f.values,
  }));

  await clearDatasetMatrix(datasetId);
  const { samplesCount, featuresCount, missingPct } = await bulkLoadMatrix(datasetId, samples, features);
  const featureLabel = targetConfig.enabled
    ? `${featuresCount} targeted metabolite(s)`
    : `${featuresCount} m/z features`;
  await query(
    `UPDATE datasets SET samples_count = $1, features_count = $2, missing_pct = $3,
     status = 'ready', import_status = 'ready', import_error = NULL WHERE id = $4`,
    [samplesCount, featuresCount, missingPct, datasetId]
  );
  await query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
  await createNotification(
    userId,
    "success",
    "mzXML Import Complete",
    `${name}: ${featureLabel} from ${samplesCount} sample(s).`,
    "/data",
    "View dataset"
  );
}

async function reprocessStoredMzxmlDataset(datasetId: number, userId: number) {
  const ds = await query<{
    id: number;
    project_id: number;
    name: string;
    raw_file_path: string | null;
    source_format: string;
  }>(
    `SELECT id, project_id, name, raw_file_path, source_format FROM datasets WHERE id = $1`,
    [datasetId]
  );
  const row = ds.rows[0];
  if (!row || row.source_format !== "mzXML" || !row.raw_file_path) {
    throw new Error("Dataset is not an mzXML import");
  }

  if (!(await pythonHealth()).ok) {
    throw new Error("Python analysis service is not running");
  }

  await query(
    `UPDATE datasets SET status = 'processing', import_status = 'processing', import_error = NULL WHERE id = $1`,
    [datasetId]
  );

  const sampleRows = await query<{ sample_id: string; group_label: string }>(
    `SELECT sample_id, group_label FROM samples WHERE dataset_id = $1`,
    [datasetId]
  );
  const remainingFiles = await listRawDatasetFiles(row.raw_file_path);
  const remainingSampleIds = new Set(
    remainingFiles.map((f) => f.filename.replace(/\.(mzxml|mzml|xml)$/i, ""))
  );
  const groups: Record<string, string> = {};
  for (const s of sampleRows.rows) {
    if (remainingSampleIds.has(s.sample_id)) {
      groups[s.sample_id] = s.group_label;
    }
  }

  const { workDir, files } = await materializeRawDatasetFiles(row.raw_file_path);
  const uploads: MzxmlUploadFile[] = files.map((f) => ({
    path: f.path!,
    filename: f.filename,
  }));

  try {
    await reprocessMzxmlDataset(datasetId, row.project_id, row.name, userId, uploads, groups);
  } finally {
    cleanupWorkDir(workDir);
  }
}

function resolveFeatureMz(feature: {
  feature_id: string;
  name: string;
  metadata?: unknown;
}): number | null {
  const meta = feature.metadata as Record<string, unknown> | null | undefined;
  if (meta?.mz != null && Number.isFinite(Number(meta.mz))) return Number(meta.mz);
  const fromName = feature.name.match(/m\/z\s*([\d.]+)/i);
  if (fromName) return Number(fromName[1]);
  const fromId = feature.feature_id.match(/^mz_([\d_]+)$/i);
  if (fromId) return Number(fromId[1].replace(/_/g, "."));
  return null;
}

router.get("/:id/xic/:featureId", authMiddleware, async (req: Request, res: Response) => {
  const datasetId = parseInt(String(req.params.id), 10);
  const featureKey = String(req.params.featureId);
  if (!(await canAccessDataset(req.user!, datasetId))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }

  const dataset = await query<{ raw_file_path: string | null; source_format: string }>(
    `SELECT raw_file_path, source_format FROM datasets WHERE id = $1`,
    [datasetId]
  );
  const ds = dataset.rows[0];
  if (!ds || ds.source_format !== "mzXML" || !ds.raw_file_path) {
    res.status(400).json({ error: "XIC chromatograms are only available for mzXML datasets with stored raw files" });
    return;
  }

  const feature = await query<{ feature_id: string; name: string; metadata: unknown }>(
    `SELECT feature_id, name, metadata FROM features WHERE dataset_id = $1 AND feature_id = $2`,
    [datasetId, featureKey]
  );
  const row = feature.rows[0];
  if (!row) {
    res.status(404).json({ error: "Feature not found" });
    return;
  }

  const mz = resolveFeatureMz(row);
  if (mz == null) {
    res.status(400).json({ error: "Could not determine target m/z for this feature" });
    return;
  }

  if (!(await pythonHealth()).ok) {
    res.status(503).json({ error: "Python analysis service is not running" });
    return;
  }

  const settings = await loadMetaboliteTargetSettings();
  const sampleRows = await query<{ sample_id: string; group_label: string }>(
    `SELECT sample_id, group_label FROM samples WHERE dataset_id = $1`,
    [datasetId]
  );
  const groups: Record<string, string> = {};
  for (const s of sampleRows.rows) groups[s.sample_id] = s.group_label;

  let workDir = "";
  try {
    const materialized = await materializeRawDatasetFiles(ds.raw_file_path);
    workDir = materialized.workDir;
    const uploads: MzxmlUploadFile[] = materialized.files.map((f) => ({
      path: f.path!,
      filename: f.filename,
    }));
    const xic = await pythonExtractXic(uploads, mz, settings.mzTolerance, groups);
    res.json({
      featureId: row.feature_id,
      name: row.name,
      mz: xic.mz,
      mzTolerance: xic.mzTolerance,
      traces: xic.traces,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "XIC extraction failed" });
  } finally {
    if (workDir) cleanupWorkDir(workDir);
  }
});

router.get("/:id/import-status", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
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

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const visibility = projectVisibilitySql(req.user!, "p", 1);
  const result = await query<{
    id: number; name: string; type: string; samples_count: number; features_count: number; status: string; project_id: number; project_name: string;
    import_status: string; source_format: string;
  }>(
    `SELECT d.id, d.name, d.type, d.samples_count, d.features_count, d.status, d.project_id, p.name AS project_name,
            d.import_status, d.source_format
     FROM datasets d JOIN projects p ON p.id = d.project_id
     WHERE d.status IN ('ready', 'processing') AND ${visibility.clause} ORDER BY d.created_at DESC`,
    visibility.params
  );
  res.json(result.rows);
});

router.get("/:id/features", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
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

function rawFileStem(filename: string) {
  return filename.replace(/\.(mzxml|mzml|xml|zip)$/i, "");
}

function findRawFileForSample(
  files: Array<{ filename: string }>,
  sampleId: string
) {
  return files.find((f) => rawFileStem(f.filename) === sampleId)?.filename ?? null;
}

router.get("/:id/samples", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  const result = await query<{ id: number; sample_id: string; group_label: string }>(
    `SELECT id, sample_id, group_label FROM samples WHERE dataset_id = $1 ORDER BY sample_id`,
    [id]
  );
  res.json({
    samples: result.rows.map((r) => ({
      id: r.id,
      sampleId: r.sample_id,
      groupLabel: r.group_label,
    })),
  });
});

router.patch("/:id/samples/:sampleId", authMiddleware, async (req: Request, res: Response) => {
  const datasetId = parseInt(String(req.params.id), 10);
  const sampleDbId = parseInt(String(req.params.sampleId), 10);
  if (!(await canAccessDataset(req.user!, datasetId))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }

  const body = req.body as { sampleId?: string; groupLabel?: string };
  const existing = await query<{ id: number; sample_id: string; group_label: string }>(
    `SELECT id, sample_id, group_label FROM samples WHERE id = $1 AND dataset_id = $2`,
    [sampleDbId, datasetId]
  );
  const row = existing.rows[0];
  if (!row) {
    res.status(404).json({ error: "Sample not found" });
    return;
  }

  const dataset = await query<{ source_format: string; project_id: number; name: string }>(
    `SELECT source_format, project_id, name FROM datasets WHERE id = $1`,
    [datasetId]
  );
  const ds = dataset.rows[0];
  if (!ds) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }

  const nextSampleId = body.sampleId?.trim() || row.sample_id;
  const nextGroup = body.groupLabel?.trim() || row.group_label;
  if (!nextSampleId || !nextGroup) {
    res.status(400).json({ error: "sampleId and groupLabel cannot be empty" });
    return;
  }
  if (ds.source_format === "mzXML" && nextSampleId !== row.sample_id) {
    res.status(400).json({ error: "mzXML sample IDs are tied to filenames and cannot be renamed" });
    return;
  }

  if (nextSampleId !== row.sample_id) {
    const dup = await query<{ id: number }>(
      `SELECT id FROM samples WHERE dataset_id = $1 AND sample_id = $2 AND id <> $3`,
      [datasetId, nextSampleId, sampleDbId]
    );
    if (dup.rows[0]) {
      res.status(400).json({ error: "Another sample already uses that ID" });
      return;
    }
  }

  await query(
    `UPDATE samples SET sample_id = $1, group_label = $2 WHERE id = $3`,
    [nextSampleId, nextGroup, sampleDbId]
  );
  await query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [ds.project_id]);
  await logAudit(
    req.user,
    "DATASET_SAMPLE_UPDATE",
    "data",
    `Dataset: ${ds.name}`,
    `Updated sample ${row.sample_id} → group "${nextGroup}"${nextSampleId !== row.sample_id ? `, renamed to ${nextSampleId}` : ""}.`,
    req
  );

  res.json({ id: sampleDbId, sampleId: nextSampleId, groupLabel: nextGroup });
});

router.delete("/:id/samples/:sampleId", authMiddleware, async (req: Request, res: Response) => {
  const datasetId = parseInt(String(req.params.id), 10);
  const sampleDbId = parseInt(String(req.params.sampleId), 10);
  if (!(await canAccessDataset(req.user!, datasetId))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }

  const existing = await query<{ id: number; sample_id: string }>(
    `SELECT id, sample_id FROM samples WHERE id = $1 AND dataset_id = $2`,
    [sampleDbId, datasetId]
  );
  const row = existing.rows[0];
  if (!row) {
    res.status(404).json({ error: "Sample not found" });
    return;
  }

  const dataset = await query<{
    raw_file_path: string | null;
    source_format: string;
    name: string;
    project_id: number;
  }>(
    `SELECT raw_file_path, source_format, name, project_id FROM datasets WHERE id = $1`,
    [datasetId]
  );
  const ds = dataset.rows[0];
  if (!ds) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }

  const totalSamples = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM samples WHERE dataset_id = $1`,
    [datasetId]
  );
  if (parseInt(totalSamples.rows[0]?.count ?? "0", 10) <= 1) {
    res.status(400).json({ error: "Cannot remove the last sample from a dataset" });
    return;
  }

  if (ds.source_format === "mzXML" && ds.raw_file_path) {
    const files = await listRawDatasetFiles(ds.raw_file_path);
    const filename = findRawFileForSample(files, row.sample_id);
    if (filename) {
      try {
        await deleteRawDatasetFile(ds.raw_file_path, filename);
        const remaining = await listRawDatasetFiles(ds.raw_file_path);
        if (!remaining.length) {
          await query(
            `UPDATE datasets SET status = 'failed', import_status = 'failed', import_error = $1 WHERE id = $2`,
            ["All mzXML files were removed from this dataset", datasetId]
          );
          await clearDatasetMatrix(datasetId);
          await recalculateDatasetStats(datasetId);
          res.json({ success: true, reprocessed: false, removedSampleId: row.sample_id });
          return;
        }
        res.status(202).json({
          success: true,
          reprocessed: true,
          removedSampleId: row.sample_id,
          status: "processing",
        });
        reprocessStoredMzxmlDataset(datasetId, req.user!.id).catch(async (err) => {
          const message = err instanceof Error ? err.message : "Failed to reprocess mzXML dataset";
          await query(
            `UPDATE datasets SET status = 'failed', import_status = 'failed', import_error = $1 WHERE id = $2`,
            [message, datasetId]
          );
          await createNotification(req.user!.id, "error", "mzXML Reprocess Failed", `${ds.name}: ${message}`, "/data", "View dataset");
        });
        return;
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Failed to remove mzXML file" });
        return;
      }
    }
  }

  await query(`DELETE FROM samples WHERE id = $1`, [sampleDbId]);
  const stats = await recalculateDatasetStats(datasetId);
  await query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [ds.project_id]);
  await logAudit(
    req.user,
    "DATASET_SAMPLE_DELETE",
    "data",
    `Dataset: ${ds.name}`,
    `Removed sample ${row.sample_id}.`,
    req
  );
  res.json({ success: true, reprocessed: false, removedSampleId: row.sample_id, ...stats });
});

router.get("/:id/features-list", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  const result = await query<{ id: number; feature_id: string; name: string; feature_class: string | null; pathway: string | null }>(
    `SELECT id, feature_id, name, feature_class, pathway FROM features WHERE dataset_id = $1 ORDER BY name`,
    [id]
  );
  res.json({
    features: result.rows.map((r) => ({
      id: r.id,
      featureId: r.feature_id,
      name: r.name,
      featureClass: r.feature_class,
      pathway: r.pathway,
    })),
  });
});

router.delete("/:id/features/:featureId", authMiddleware, async (req: Request, res: Response) => {
  const datasetId = parseInt(String(req.params.id), 10);
  const featureKey = String(req.params.featureId);
  if (!(await canAccessDataset(req.user!, datasetId))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }

  const existing = await query<{ id: number; name: string }>(
    `SELECT id, name FROM features WHERE dataset_id = $1 AND feature_id = $2`,
    [datasetId, featureKey]
  );
  const row = existing.rows[0];
  if (!row) {
    res.status(404).json({ error: "Feature not found" });
    return;
  }

  const totalFeatures = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM features WHERE dataset_id = $1`,
    [datasetId]
  );
  if (parseInt(totalFeatures.rows[0]?.count ?? "0", 10) <= 1) {
    res.status(400).json({ error: "Cannot remove the last feature from a dataset" });
    return;
  }

  const ds = await query<{ name: string; project_id: number; source_format: string }>(
    `SELECT name, project_id, source_format FROM datasets WHERE id = $1`,
    [datasetId]
  );
  if (!ds.rows[0]) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  if (ds.rows[0].source_format === "mzXML") {
    res.status(400).json({
      error: "mzXML features are derived from spectra — remove samples (raw files) instead, or re-import with different targets",
    });
    return;
  }

  await query(`DELETE FROM features WHERE id = $1`, [row.id]);
  const stats = await recalculateDatasetStats(datasetId);
  await query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [ds.rows[0].project_id]);
  await logAudit(
    req.user,
    "DATASET_FEATURE_DELETE",
    "data",
    `Dataset: ${ds.rows[0].name}`,
    `Removed feature ${row.name}.`,
    req
  );
  res.json({ success: true, removedFeatureId: featureKey, ...stats });
});

router.get("/:id/groups", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  const result = await query<{ group_label: string; count: string }>(
    `SELECT group_label, COUNT(*)::text AS count FROM samples WHERE dataset_id = $1 GROUP BY group_label`,
    [id]
  );
  res.json(result.rows.map((r) => ({ label: r.group_label, count: parseInt(r.count, 10) })));
});

router.get("/:id/raw-files", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  const result = await query<{ raw_file_path: string | null; source_format: string }>(
    `SELECT raw_file_path, source_format FROM datasets WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  if (!row || row.source_format !== "mzXML") {
    res.status(400).json({ error: "Dataset does not contain mzXML raw files" });
    return;
  }
  const files = await listRawDatasetFiles(row.raw_file_path);
  res.json({ files });
});

router.delete("/:id/raw-files/:filename", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  const filename = path.basename(String(req.params.filename));
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }

  const result = await query<{ raw_file_path: string | null; source_format: string; name: string }>(
    `SELECT raw_file_path, source_format, name FROM datasets WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  if (!row || row.source_format !== "mzXML" || !row.raw_file_path) {
    res.status(400).json({ error: "Dataset does not contain mzXML raw files" });
    return;
  }

  const before = await listRawDatasetFiles(row.raw_file_path);
  if (!before.some((f) => f.filename === filename)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  try {
    await deleteRawDatasetFile(row.raw_file_path, filename);
    const remaining = await listRawDatasetFiles(row.raw_file_path);
    if (!remaining.length) {
      await query(
        `UPDATE datasets SET status = 'failed', import_status = 'failed', import_error = $1 WHERE id = $2`,
        ["All mzXML files were removed from this dataset", id]
      );
      res.json({ success: true, reprocessed: false, files: [] });
      return;
    }

    res.status(202).json({ success: true, reprocessed: true, files: remaining, status: "processing" });
    reprocessStoredMzxmlDataset(id, req.user!.id).catch(async (err) => {
      const message = err instanceof Error ? err.message : "Failed to reprocess mzXML dataset";
      await query(
        `UPDATE datasets SET status = 'failed', import_status = 'failed', import_error = $1 WHERE id = $2`,
        [message, id]
      );
      await createNotification(req.user!.id, "error", "mzXML Reprocess Failed", `${row.name}: ${message}`, "/data", "View dataset");
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete file" });
  }
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
  const existing = await query<{ raw_file_path: string | null }>("SELECT raw_file_path FROM datasets WHERE id = $1", [id]);
  await query("DELETE FROM datasets WHERE id = $1", [id]);
  await deleteRawDatasetFiles(existing.rows[0]?.raw_file_path);
  res.json({ success: true });
});

router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (!(await canAccessDataset(req.user!, id))) {
    res.status(404).json({ error: "Dataset not found" });
    return;
  }
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
