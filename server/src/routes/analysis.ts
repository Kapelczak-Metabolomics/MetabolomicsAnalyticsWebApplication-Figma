import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { loadDatasetMatrix } from "../utils/dataset.js";

const router = Router();

type ClusteringResults = {
  sampleOrder?: string[];
  featureLabels?: string[];
  heatmapMatrix?: (number | null)[][];
  dendrogram?: unknown[];
  silhouette?: number;
};

async function latestCompletedExperiment(datasetId: number, type: string) {
  return query<{ id: number; results: unknown; status: string; completed_at: Date | null; config: unknown }>(
    `SELECT id, results, status, completed_at, config FROM experiments
     WHERE dataset_id = $1 AND type = $2 AND status = 'completed' AND results IS NOT NULL
     ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
    [datasetId, type]
  );
}

async function latestInProgressExperiment(datasetId: number, type: string) {
  return query<{ id: number; status: string }>(
    `SELECT id, status FROM experiments
     WHERE dataset_id = $1 AND type = $2 AND status IN ('pending', 'running')
     ORDER BY created_at DESC LIMIT 1`,
    [datasetId, type]
  );
}

router.get("/results", authMiddleware, async (req: Request, res: Response) => {
  const datasetId = parseInt(String(req.query.datasetId), 10);
  const type = String(req.query.type || "");

  if (!datasetId || !type) {
    res.status(400).json({ error: "datasetId and type are required" });
    return;
  }

  const existing = await latestCompletedExperiment(datasetId, type);

  if (existing.rows[0]) {
    res.json({
      experimentId: existing.rows[0].id,
      status: "completed",
      results: existing.rows[0].results,
      config: existing.rows[0].config,
      source: "experiment",
    });
    return;
  }

  const inProgress = await latestInProgressExperiment(datasetId, type);
  if (inProgress.rows[0]) {
    res.json({
      experimentId: inProgress.rows[0].id,
      status: inProgress.rows[0].status,
      results: null,
      source: "experiment",
      message: "Analysis in progress.",
    });
    return;
  }

  res.json({
    experimentId: null,
    status: "pending",
    results: null,
    source: "none",
    message: "No completed analysis found. Run analysis to generate plots.",
  });
});

router.get("/dataset-matrix", authMiddleware, async (req: Request, res: Response) => {
  const datasetId = parseInt(String(req.query.datasetId), 10);
  const useClustered = req.query.clustered === "true";
  if (!datasetId) {
    res.status(400).json({ error: "datasetId is required" });
    return;
  }

  const { samples, features } = await loadDatasetMatrix(datasetId);

  if (useClustered) {
    const cached = await latestCompletedExperiment(datasetId, "Clustering");
    const c = (cached.rows[0]?.results ?? {}) as ClusteringResults;
    if (cached.rows[0]) {
      res.json({
        sampleLabels: c.sampleOrder ?? samples.map((s) => s.sampleId),
        featureLabels: c.featureLabels ?? features.slice(0, 20).map((f) => f.name),
        matrix: c.heatmapMatrix ?? [],
        groups: samples.map((s) => s.groupLabel),
        dendrogram: c.dendrogram ?? [],
        silhouette: c.silhouette ?? 0,
      });
      return;
    }
  }

  const maxSamples = Math.min(samples.length, 50);
  const maxFeatures = Math.min(features.length, 30);
  const matrix = samples.slice(0, maxSamples).map((s, si) =>
    features.slice(0, maxFeatures).map((f) => {
      const v = f.values[si];
      return v != null ? Number(v.toFixed(3)) : null;
    })
  );

  res.json({
    sampleLabels: samples.slice(0, maxSamples).map((s) => s.sampleId),
    featureLabels: features.slice(0, maxFeatures).map((f) => f.name),
    matrix,
    groups: samples.slice(0, maxSamples).map((s) => s.groupLabel),
  });
});

export default router;
