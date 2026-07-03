import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

export interface ActiveDataset {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  samples_count: number;
  features_count: number;
}

export function useAnalysisPage(analysisType: string) {
  const [dataset, setDataset] = useState<ActiveDataset | null>(null);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [experimentId, setExperimentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async (datasetId: number) => {
    const data = await api.getAnalysisResults(datasetId, analysisType);
    setResults(data.results as Record<string, unknown>);
    setExperimentId(data.experimentId);
    return data;
  }, [analysisType]);

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
        const ready = datasets.find((d) => d.status === "ready");
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
        const data = await api.getAnalysisResults(ready.id, analysisType);
        if (!cancelled) {
          setResults(data.results as Record<string, unknown>);
          setExperimentId(data.experimentId);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analysis");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [analysisType, loadResults]);

  const runAnalysis = useCallback(async (name: string) => {
    if (!dataset) throw new Error("No dataset selected");
    const { id } = await api.runAnalysis({
      projectId: dataset.project_id,
      datasetId: dataset.id,
      name,
      type: analysisType,
    });
    setExperimentId(id);
    await new Promise((r) => setTimeout(r, 2500));
    await loadResults(dataset.id);
    return id;
  }, [dataset, analysisType, loadResults]);

  return { dataset, results, experimentId, loading, error, refresh, runAnalysis };
}
