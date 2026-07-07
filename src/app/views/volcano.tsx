import { useMemo, useState, useEffect } from "react";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { Play, Settings2 } from "lucide-react";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { ConfigureDialog } from "../components/configure-dialog";
import { AnalysisExportMenu } from "../components/analysis-export-menu";
import { useAnalysisPage } from "../../hooks/use-analysis-page";
import { useApp } from "../../contexts/app-context";
import { volcanoConfig } from "../../lib/analysis-config";
import type { VolcanoPoint } from "../components/plots/volcano-plot";

const volcanoStages = ["Loading dataset", "Computing fold changes", "Running statistical tests", "Applying FDR correction", "Generating volcano plot"];

export function VolcanoView() {
  const [runOpen, setRunOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { saveAnalysisConfig, getAnalysisConfig } = useApp();
  const { dataset, results, loading, error, refresh, experimentId } = useAnalysisPage("Volcano");

  const config = getAnalysisConfig("Volcano");
  const pThreshold = Number(config.pThreshold ?? 0.05);
  const fcThreshold = Number(config.foldChangeThreshold ?? 0.5);
  const labelTopN = Number(config.labelTopN ?? 15);
  const [showLabels, setShowLabels] = useState(Boolean(config.showLabels));

  useEffect(() => {
    setShowLabels(Boolean(config.showLabels));
  }, [config.showLabels]);
  const features = (results?.features as VolcanoPoint[]) ?? [];
  const stats = useMemo(() => {
    const sig = features.filter((f) => f.pValue < pThreshold && Math.abs(f.log2fc) > fcThreshold);
    return {
      up: sig.filter((f) => f.log2fc > 0).length,
      down: sig.filter((f) => f.log2fc < 0).length,
      ns: features.length - sig.length,
      total: features.length,
    };
  }, [features, pThreshold, fcThreshold]);

  const topFeatures = useMemo(() =>
    [...features].sort((a, b) => a.pValue - b.pValue).slice(0, 15),
  [features]);

  if (loading) return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="flex h-full">
      <RunAnalysisDialog open={runOpen} onClose={() => { setRunOpen(false); refresh(); }} analysisName="Volcano Plot Analysis" analysisType="Volcano" projectId={dataset?.project_id} datasetId={dataset?.id} stages={volcanoStages} onComplete={refresh} />
      <ConfigureDialog open={configOpen} onClose={() => setConfigOpen(false)} title="Configure Volcano Plot" groups={volcanoConfig} initialValues={getAnalysisConfig("Volcano")} onSave={(c) => saveAnalysisConfig("Volcano", c)} />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Volcano Plot Analysis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{dataset ? `${dataset.project_name} · ${dataset.name}` : "No dataset"}</p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfigOpen(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"><Settings2 className="h-3.5 w-3.5" /> Configure</button>
            <button onClick={() => setRunOpen(true)} disabled={!dataset} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Play className="h-3.5 w-3.5" /> Run Analysis</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3"><p className="text-xs text-muted-foreground">Upregulated</p><p className="text-xl font-semibold text-rose-600">{stats.up}</p></div>
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3"><p className="text-xs text-muted-foreground">Downregulated</p><p className="text-xl font-semibold text-blue-600">{stats.down}</p></div>
          <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Not Significant</p><p className="text-xl font-semibold">{stats.ns}</p></div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3"><p className="text-xs text-muted-foreground">Total Features</p><p className="text-xl font-semibold text-violet-600">{stats.total}</p></div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm">Volcano Plot</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Label top features
              </label>
              <AnalysisExportMenu experimentId={experimentId} results={results} analysisType="Volcano" filename="volcano-features" plotContainerId="plot-volcano-main" />
            </div>
          </div>
          <ChartPlaceholder
            type="Volcano Plot"
            height="500px"
            exportId="plot-volcano-main"
            volcanoFeatures={features}
            volcanoConfig={{ pThreshold, fcThreshold, showLabels, labelTopN }}
          />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border"><h3 className="text-sm">Top Significant Features</h3></div>
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/30"><tr><th className="p-2 text-left">Feature</th><th className="p-2 text-right">log2FC</th><th className="p-2 text-right">p-value</th><th className="p-2 text-right">adj. p</th></tr></thead>
            <tbody>
              {topFeatures.map((f) => (
                <tr key={f.name} className="border-b border-border">
                  <td className="p-2">{f.name}</td>
                  <td className="p-2 text-right tabular-nums">{f.log2fc}</td>
                  <td className="p-2 text-right tabular-nums">{f.pValue < 0.001 ? f.pValue.toExponential(1) : f.pValue.toFixed(4)}</td>
                  <td className="p-2 text-right tabular-nums">{(f as { adjP?: number }).adjP?.toExponential?.(1) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
