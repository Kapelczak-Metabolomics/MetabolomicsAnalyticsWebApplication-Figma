import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { loadDatasetMatrix } from "../utils/dataset.js";
import { runPCA, runVolcano, runClustering, runPathway, runBiomarker, runPLSDA } from "../services/analysis.js";

const router = Router();

async function computeResults(type: string, datasetId: number) {
  const { samples, features } = await loadDatasetMatrix(datasetId);
  const groups = [...new Set(samples.map((s) => s.groupLabel))];
  const groupA = groups[0];
  const groupB = groups[1] ?? groups[0];

  switch (type) {
    case "PCA":
      return runPCA(samples, 2);
    case "Volcano":
      return runVolcano(samples, features, groupA, groupB);
    case "Clustering":
      return runClustering(samples);
    case "PLS-DA":
      return runPLSDA(samples, features, groupA, groupB);
    case "Pathway": {
      const volcano = runVolcano(samples, features, groupA, groupB);
      return runPathway(volcano);
    }
    case "Biomarker": {
      const volcano = runVolcano(samples, features, groupA, groupB);
      return runBiomarker(volcano);
    }
    default:
      return { message: "Unknown analysis type" };
  }
}

router.get("/results", authMiddleware, async (req: Request, res: Response) => {
  const datasetId = parseInt(String(req.query.datasetId), 10);
  const type = String(req.query.type || "");

  if (!datasetId || !type) {
    res.status(400).json({ error: "datasetId and type are required" });
    return;
  }

  const existing = await query<{ id: number; results: unknown; status: string; completed_at: Date | null }>(
    `SELECT id, results, status, completed_at FROM experiments
     WHERE dataset_id = $1 AND type = $2 AND status = 'completed' AND results IS NOT NULL
     ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
    [datasetId, type]
  );

  if (existing.rows[0]) {
    res.json({
      experimentId: existing.rows[0].id,
      status: "completed",
      results: existing.rows[0].results,
      source: "experiment",
    });
    return;
  }

  const results = await computeResults(type, datasetId);
  res.json({ experimentId: null, status: "computed", results, source: "live" });
});

router.get("/dataset-matrix", authMiddleware, async (req: Request, res: Response) => {
  const datasetId = parseInt(String(req.query.datasetId), 10);
  if (!datasetId) {
    res.status(400).json({ error: "datasetId is required" });
    return;
  }

  const { samples, features } = await loadDatasetMatrix(datasetId);
  const matrix = samples.slice(0, 30).map((s, si) =>
    features.slice(0, 20).map((f) => {
      const v = f.values[si];
      return v != null ? Number(v.toFixed(3)) : null;
    })
  );

  res.json({
    sampleLabels: samples.slice(0, 30).map((s) => s.sampleId),
    featureLabels: features.slice(0, 20).map((f) => f.name),
    matrix,
    groups: samples.slice(0, 30).map((s) => s.groupLabel),
  });
});

export default router;
