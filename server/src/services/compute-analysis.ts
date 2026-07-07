import { loadDatasetMatrix, analysisMaxFeatures } from "../utils/dataset.js";
import { runPCA, runVolcano, runClustering, runBiomarker, runPLSDA } from "./analysis.js";
import { invalidatePythonHealthCache, isPythonAnalysisAvailable, pythonRunAnalysis, usePythonAnalysis } from "./python-client.js";

type Matrix = Awaited<ReturnType<typeof loadDatasetMatrix>>;

/** Small matrices run faster in-process than over HTTP to Python. */
const PYTHON_MIN_CELLS = 5000;

export type ComputeOptions = {
  preferTypeScript?: boolean;
};

export async function computeWithEngine(
  type: string,
  samples: Matrix["samples"],
  features: Matrix["features"],
  config: Record<string, unknown> = {},
  options: ComputeOptions = {}
) {
  const groups = [...new Set(samples.map((s) => s.groupLabel))];
  const groupA = String(config.groupA ?? groups[0]);
  const groupB = String(config.groupB ?? groups[1] ?? groups[0]);
  const mergedConfig = { ...config, groupA, groupB };

  const cellCount = samples.length * features.length;
  const tryPython =
    type !== "Pathway" &&
    usePythonAnalysis() &&
    !options.preferTypeScript &&
    cellCount > PYTHON_MIN_CELLS &&
    (await isPythonAnalysisAvailable());

  if (tryPython) {
    try {
      const pySamples = samples.map((s) => ({ sampleId: s.sampleId, groupLabel: s.groupLabel, values: s.values }));
      const pyFeatures = features.map((f) => ({
        featureId: f.featureId, name: f.name, featureClass: f.featureClass, pathway: f.pathway, values: f.values,
      }));
      return await pythonRunAnalysis(type, pySamples, pyFeatures, mergedConfig);
    } catch (err) {
      invalidatePythonHealthCache();
      console.warn(`Python analysis failed for ${type}, falling back to TypeScript:`, err);
    }
  }

  switch (type) {
    case "PCA":
      return runPCA(samples, Number(config.components ?? 2), config);
    case "Volcano":
      return runVolcano(samples, features, groupA, groupB, config);
    case "Clustering":
      return runClustering(samples, features, config);
    case "PLS-DA":
      return runPLSDA(samples, features, groupA, groupB, config);
    case "Pathway": {
      const volcano = runVolcano(samples, features, groupA, groupB, config);
      const { runLivePathwayEnrichment } = await import("./pathway-enrichment.js");
      return runLivePathwayEnrichment(volcano, config);
    }
    case "Biomarker": {
      const volcano = runVolcano(samples, features, groupA, groupB, config);
      return runBiomarker(volcano, config);
    }
    default:
      return { message: "Unknown analysis type" };
  }
}

export async function computeResults(type: string, datasetId: number, config: Record<string, unknown> = {}) {
  const { samples, features } = await loadDatasetMatrix(datasetId, { maxFeatures: analysisMaxFeatures() });
  return computeWithEngine(type, samples, features, config);
}
