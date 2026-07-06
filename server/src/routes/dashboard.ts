import { Router, Request, Response } from "express";
import { query } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { loadDatasetMatrix, formatRelativeTime } from "../utils/dataset.js";
import { computeResults } from "../services/compute-analysis.js";

const router = Router();

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : null;
  const datasetIdParam = req.query.datasetId ? parseInt(req.query.datasetId as string, 10) : null;

  let datasetQuery;
  if (datasetIdParam) {
    datasetQuery = await query<{ id: number; name: string; samples_count: number; features_count: number; project_name: string }>(
      `SELECT d.id, d.name, d.samples_count, d.features_count, p.name AS project_name
       FROM datasets d JOIN projects p ON p.id = d.project_id WHERE d.id = $1`,
      [datasetIdParam]
    );
  } else if (projectId) {
    datasetQuery = await query<{ id: number; name: string; samples_count: number; features_count: number; project_name: string }>(
      `SELECT d.id, d.name, d.samples_count, d.features_count, p.name AS project_name
       FROM datasets d JOIN projects p ON p.id = d.project_id
       WHERE d.project_id = $1 AND d.status = 'ready' ORDER BY d.created_at DESC LIMIT 1`,
      [projectId]
    );
  } else {
    datasetQuery = await query<{ id: number; name: string; samples_count: number; features_count: number; project_name: string }>(
      `SELECT d.id, d.name, d.samples_count, d.features_count, p.name AS project_name
       FROM datasets d JOIN projects p ON p.id = d.project_id
       WHERE d.status = 'ready' ORDER BY d.created_at DESC LIMIT 1`
    );
  }

  const dataset = datasetQuery.rows[0];

  const experiments = await query<{ type: string; completed_at: Date | null; created_at: Date; results: unknown }>(
    `SELECT type, completed_at, created_at, results FROM experiments WHERE status = 'completed' ORDER BY completed_at DESC NULLS LAST LIMIT 20`
  );

  let significantFeatures = 0;
  let modelAccuracy = 0;

  const volcanoExp = experiments.rows.find((e) => e.type === "Volcano");
  if (volcanoExp?.results && typeof volcanoExp.results === "object") {
    const r = volcanoExp.results as { significantCount?: number };
    significantFeatures = r.significantCount ?? 0;
  } else if (dataset?.id) {
    try {
      const volcano = await computeResults("Volcano", dataset.id, {});
      significantFeatures = (volcano as { significantCount?: number }).significantCount ?? 0;
    } catch {
      significantFeatures = 0;
    }
  }

  const plsdaExp = experiments.rows.find((e) => e.type === "PLS-DA");
  if (plsdaExp?.results && typeof plsdaExp.results === "object") {
    const r = plsdaExp.results as { accuracy?: number };
    modelAccuracy = r.accuracy ?? 0;
  }

  const analysisTypes = ["PCA", "PLS-DA", "Volcano", "Clustering", "Pathway", "Biomarker"];
  const analysisHrefs: Record<string, string> = {
    PCA: "/pca", "PLS-DA": "/plsda", Volcano: "/volcano", Clustering: "/clustering", Pathway: "/pathway", Biomarker: "/biomarker",
  };

  const recentAnalyses = analysisTypes.map((type) => {
    const exp = experiments.rows.find((e) => e.type === type);
    return {
      title: type === "PCA" ? "Principal Component Analysis" :
        type === "PLS-DA" ? "Partial Least Squares - DA" :
        type === "Volcano" ? "Volcano Plot Analysis" :
        type === "Clustering" ? "Hierarchical Clustering" :
        type === "Pathway" ? "Pathway Enrichment" : "Biomarker Lenses",
      type,
      href: analysisHrefs[type],
      lastRun: exp ? formatRelativeTime(exp.completed_at ?? exp.created_at) : "Never",
    };
  });

  res.json({
    projectName: dataset?.project_name ?? "No project",
    datasetName: dataset?.name ?? "No dataset",
    datasetId: dataset?.id ?? null,
    kpis: {
      totalMetabolites: dataset?.features_count ?? 0,
      samplesAnalyzed: dataset?.samples_count ?? 0,
      significantFeatures,
      modelAccuracy,
    },
    recentAnalyses,
    status: dataset ? "ready" : "no_data",
  });
});

export default router;
