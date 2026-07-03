import { useState } from "react";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { Play, Download, Settings2, ChevronDown } from "lucide-react";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { ConfigureDialog } from "../components/configure-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { useAnalysisPage } from "../../hooks/use-analysis-page";
import type { PCAScore } from "../components/plots/pca-plot";

const pcaStages = [
  "Loading dataset into memory",
  "Applying Pareto scaling",
  "Computing covariance matrix",
  "Running SVD decomposition",
  "Generating score & loading plots",
];

const pcaConfig = [
  {
    title: "Preprocessing",
    fields: [
      { label: "Scaling Method", type: "select" as const, value: "Pareto", options: ["Pareto", "Auto", "Range", "Vast", "None"] },
      { label: "Missing Value Imputation", type: "select" as const, value: "KNN", options: ["KNN", "Half-minimum", "Median", "BPCA", "PPCA"] },
      { label: "Log Transformation", type: "checkbox" as const, value: true },
    ],
  },
];

function ExportMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
          {["PNG", "SVG", "CSV"].map((fmt) => (
            <DropdownMenu.Item key={fmt} className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent" onSelect={() => toast.success(`Exported as ${fmt}`)}>
              {fmt}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function PCAView() {
  const [runOpen, setRunOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { dataset, results, loading, error, refresh } = useAnalysisPage("PCA");

  const scores = (results?.scores as PCAScore[]) ?? [];
  const explainedVariance = (results?.explainedVariance as number[]) ?? [];
  const groupCounts = scores.reduce((acc, s) => {
    acc[s.group] = (acc[s.group] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="flex h-full">
      <RunAnalysisDialog
        open={runOpen}
        onClose={() => { setRunOpen(false); refresh(); }}
        analysisName="Principal Component Analysis"
        analysisType="PCA"
        projectId={dataset?.project_id}
        datasetId={dataset?.id}
        stages={pcaStages}
        onComplete={refresh}
      />
      <ConfigureDialog open={configOpen} onClose={() => setConfigOpen(false)} title="Configure PCA" groups={pcaConfig} />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Principal Component Analysis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dataset ? `${dataset.project_name} · ${dataset.name}` : "No dataset"}
            </p>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setConfigOpen(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Settings2 className="h-3.5 w-3.5" /> Configure
            </button>
            <button onClick={() => setRunOpen(true)} disabled={!dataset} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Play className="h-3.5 w-3.5" /> Run Analysis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-violet-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">PC1 Variance</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">{explainedVariance[0] ?? 0}%</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-cyan-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">PC2 Variance</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">{explainedVariance[1] ?? 0}%</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Samples</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{scores.length || dataset?.samples_count || 0}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Score Plot (PC1 vs PC2)</h3>
            <ExportMenu />
          </div>
          <ChartPlaceholder type="PCA Score Plot" height="450px" pcaScores={scores} explainedVariance={explainedVariance} />
        </div>
      </div>

      <div className="w-64 border-l border-border bg-muted/30 p-4 space-y-4 overflow-auto">
        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Sample Groups</h3>
          <div className="space-y-1.5">
            {Object.entries(groupCounts).map(([group, count], i) => (
              <div key={group} className="flex items-center gap-2 text-xs">
                <div className={`h-2.5 w-2.5 rounded-full bg-chart-${(i % 5) + 1}`} />
                <span>{group} (n={count})</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => setRunOpen(true)} disabled={!dataset} className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50">
          <Play className="h-3.5 w-3.5" /> Re-run Analysis
        </button>
      </div>
    </div>
  );
}
