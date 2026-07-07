import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAppOptional } from "../contexts/app-context";

export interface ActiveDataset {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  samples_count: number;
  features_count: number;
}

const ANALYSIS_POLL_MAX = 600;
const ANALYSIS_POLL_MS = 500;

function parseLens(lens: string): { groupA?: string; groupB?: string } {
  if (!lens || lens === "All groups") return {};
  const vs = lens.match(/^(.+?)\s+vs\s+(.+)$/i);
  if (vs) return { groupA: vs[1].trim(), groupB: vs[2].trim() };
  return {};
}

export function useAnalysisPage(analysisType: string) {
  const app = useAppOptional();
  const [dataset, setDataset] = useState<ActiveDataset | null>(null);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [experimentId, setExperimentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState(false);

  const loadResults = useCallback(async (datasetId: number) => {
    const groups = parseLens(app?.selectedLens ?? "");
    const data = await api.getAnalysisResults(datasetId, analysisType, groups);
    setResults((data.results as Record<string, unknown> | null) ?? null);
    setExperimentId(data.experimentId);
    setPendingAnalysis(data.status === "pending" || data.status === "running");
    return data;
  }, [analysisType, app?.selectedLens]);

  const refresh = useCallback(async () => {
    if (!dataset) return;
    setLoading(true);
    try {
      await loadResults(dataset.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [dataset, loadResults]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const datasets = await api.getDatasets();
        const selectedId = app?.selectedDatasetId;
        const ready = selectedId
          ? datasets.find((d) => d.id === selectedId && d.status === "ready")
          : datasets.find((d) => d.status === "ready");
        if (!ready) {
          if (!cancelled) setError("No ready dataset found. Import data first.");
          return;
        }
        if (!cancelled) {
          setDataset({
            id: ready.id,
            name: ready.name,
            project_id: ready.project_id,
            project_name: ready.project_name,
            samples_count: ready.samples_count,
            features_count: ready.features_count,
          });
        }
        const data = await api.getAnalysisResults(ready.id, analysisType, parseLens(app?.selectedLens ?? ""));
        if (!cancelled) {
          setResults((data.results as Record<string, unknown> | null) ?? null);
          setExperimentId(data.experimentId);
          setPendingAnalysis(data.status === "pending" || data.status === "running");
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analysis");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [analysisType, app?.selectedDatasetId, app?.selectedLens, loadResults]);

  const runAnalysis = useCallback(async (name: string, config?: Record<string, unknown>) => {
    if (!dataset) throw new Error("No dataset selected");
    const groups = parseLens(app?.selectedLens ?? "");
    const mergedConfig = { ...groups, ...(config ?? app?.getAnalysisConfig(analysisType) ?? {}) };
    const { id, status: initialStatus } = await api.runAnalysis({
      projectId: dataset.project_id,
      datasetId: dataset.id,
      name,
      type: analysisType,
      config: mergedConfig,
    });
    setExperimentId(id);

    if (initialStatus === "completed") {
      await loadResults(dataset.id);
      return id;
    }
    if (initialStatus === "failed") {
      const exp = await api.getExperiment(id);
      throw new Error(String(exp.errorMessage ?? "Analysis failed"));
    }

    let finalStatus = initialStatus ?? "running";
    for (let i = 0; i < ANALYSIS_POLL_MAX; i++) {
      await new Promise((r) => setTimeout(r, ANALYSIS_POLL_MS));
      try {
        const exp = await api.getExperiment(id);
        finalStatus = exp.status;
        if (exp.status === "completed" || exp.status === "failed") break;
      } catch {
        // keep polling on transient errors
      }
    }
    if (finalStatus === "failed") {
      const exp = await api.getExperiment(id);
      throw new Error(String(exp.errorMessage ?? "Analysis failed"));
    }
    if (finalStatus !== "completed") {
      throw new Error("Analysis timed out — check Experiments for status");
    }
    await loadResults(dataset.id);
    return id;
  }, [dataset, analysisType, app, loadResults]);

  return { dataset, results, experimentId, loading, error, pendingAnalysis, refresh, runAnalysis };
}
