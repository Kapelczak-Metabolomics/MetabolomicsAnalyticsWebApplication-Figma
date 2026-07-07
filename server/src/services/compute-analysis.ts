import { loadDatasetMatrix, analysisMaxFeatures } from "../utils/dataset.js";
import { runPCA, runVolcano, runClustering, runPathway, runBiomarker, runPLSDA } from "./analysis.js";
import { pythonRunAnalysis, usePythonAnalysis } from "./python-client.js";

type Matrix = Awaited<ReturnType<typeof loadDatasetMatrix>>;

export async function computeWithEngine(
  type: string,
  samples: Matrix["samples"],
  features: Matrix["features"],
  config: Record<string, unknown> = {}
) {
  const groups = [...new Set(samples.map((s) => s.groupLabel))];
  const groupA = String(config.groupA ?? groups[0]);
  const groupB = String(config.groupB ?? groups[1] ?? groups[0]);
  const mergedConfig = { ...config, groupA, groupB };

  if (usePythonAnalysis()) {
    try {
      const pySamples = samples.map((s) => ({ sampleId: s.sampleId, groupLabel: s.groupLabel, values: s.values }));
      const pyFeatures = features.map((f) => ({
        featureId: f.featureId, name: f.name, featureClass: f.featureClass, pathway: f.pathway, values: f.values,
      }));
      return await pythonRunAnalysis(type, pySamples, pyFeatures, mergedConfig);
    } catch (err) {
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
      return runPathway(volcano, config);
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
