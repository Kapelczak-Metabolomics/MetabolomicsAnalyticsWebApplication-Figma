import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { ANALYSIS_TYPES } from "../lib/analysis-config";

interface AppContextValue {
  projects: Array<{ id: number; name: string }>;
  datasets: Array<{ id: number; name: string; samples_count: number; project_id: number }>;
  selectedProjectId: number | null;
  selectedDatasetId: number | null;
  selectedLens: string;
  groupLenses: string[];
  setSelectedProjectId: (id: number) => void;
  setSelectedDatasetId: (id: number) => void;
  setSelectedLens: (lens: string) => void;
  analysisConfigs: Record<string, Record<string, unknown>>;
  saveAnalysisConfig: (type: string, config: Record<string, unknown>) => Promise<void>;
  getAnalysisConfig: (type: string) => Record<string, unknown>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<AppContextValue["projects"]>([]);
  const [datasets, setDatasets] = useState<AppContextValue["datasets"]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [selectedLens, setSelectedLens] = useState("All groups");
  const [groupLenses, setGroupLenses] = useState<string[]>(["All groups"]);
  const [analysisConfigs, setAnalysisConfigs] = useState<Record<string, Record<string, unknown>>>({});

  const refresh = useCallback(async () => {
    const [p, d] = await Promise.all([api.getProjects(), api.getDatasets()]);
    setProjects(p.map((x) => ({ id: x.id, name: x.name })));
    setDatasets(d);
    if (!selectedProjectId && p[0]) setSelectedProjectId(p[0].id);
    const projectDatasets = d.filter((ds) => ds.project_id === (selectedProjectId ?? p[0]?.id));
    if (!selectedDatasetId && (projectDatasets[0] ?? d[0])) setSelectedDatasetId((projectDatasets[0] ?? d[0]).id);
  }, [selectedProjectId, selectedDatasetId]);

  useEffect(() => {
    refresh().catch(console.error);
    Promise.all(ANALYSIS_TYPES.map((type) => api.getAnalysisConfig(type).catch(() => ({}))))
      .then((configs) => {
        const merged: Record<string, Record<string, unknown>> = {};
        ANALYSIS_TYPES.forEach((type, i) => { merged[type] = configs[i] as Record<string, unknown>; });
        setAnalysisConfigs(merged);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) return;
    api.getDatasetGroups(selectedDatasetId)
      .then((groups) => {
        const lenses = ["All groups"];
        if (groups.length >= 2) lenses.push(`${groups[0].label} vs ${groups[1].label}`);
        groups.forEach((g) => lenses.push(g.label));
        setGroupLenses([...new Set(lenses)]);
        if (!lenses.includes(selectedLens)) setSelectedLens(lenses[0]);
      })
      .catch(() => setGroupLenses(["All groups"]));
  }, [selectedDatasetId]);

  const saveAnalysisConfig = useCallback(async (type: string, config: Record<string, unknown>) => {
    await api.saveAnalysisConfig(type, config);
    setAnalysisConfigs((prev) => ({ ...prev, [type]: config }));
  }, []);

  const getAnalysisConfig = useCallback((type: string) => analysisConfigs[type] ?? {}, [analysisConfigs]);

  return (
    <AppContext.Provider value={{
      projects, datasets, selectedProjectId, selectedDatasetId, selectedLens, groupLenses,
      setSelectedProjectId, setSelectedDatasetId, setSelectedLens, analysisConfigs,
      saveAnalysisConfig, getAnalysisConfig, refresh,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function useAppOptional() {
  return useContext(AppContext);
}
