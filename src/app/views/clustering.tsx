import { useEffect, useState } from "react";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { Play, Download, Settings2, ChevronDown } from "lucide-react";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { ConfigureDialog } from "../components/configure-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { useAnalysisPage } from "../../hooks/use-analysis-page";
import { api } from "../../lib/api";

const clusteringStages = [
  "Loading & scaling dataset",
  "Computing distance matrix",
  "Running hierarchical clustering",
  "Optimizing cluster cutoff",
  "Generating heatmap & dendrograms",
];

const clusteringConfig = [
  {
    title: "Clustering Method",
    fields: [
      { label: "Algorithm", type: "select" as const, value: "Hierarchical", options: ["Hierarchical", "K-means", "DBSCAN", "Spectral"] },
      { label: "Distance Metric", type: "select" as const, value: "Euclidean", options: ["Euclidean", "Pearson", "Spearman", "Manhattan", "Cosine"] },
      { label: "Linkage Method", type: "select" as const, value: "Ward", options: ["Ward", "Average", "Complete", "Single"] },
    ],
  },
  {
    title: "Normalization",
    fields: [
      { label: "Row scaling", type: "select" as const, value: "Z-score", options: ["Z-score", "Min-Max", "None"] },
      { label: "Log transform", type: "checkbox" as const, value: true },
      { label: "Impute missing values", type: "checkbox" as const, value: true },
    ],
  },
  {
    title: "Visualization",
    fields: [
      { label: "Color palette", type: "select" as const, value: "RdBu", options: ["RdBu", "Viridis", "Plasma", "Coolwarm", "YlOrRd"] },
      { label: "Show row dendrogram", type: "checkbox" as const, value: true },
      { label: "Show col dendrogram", type: "checkbox" as const, value: true },
    ],
  },
];

function ExportMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" />
          Export
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
          sideOffset={4}
          align="end"
        >
          {["PNG (high-res)", "SVG (vector)", "PDF", "CSV (data)"].map((fmt) => (
            <DropdownMenu.Item
              key={fmt}
              className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
              onSelect={() => toast.success(`Exported as ${fmt.split(" ")[0]}`)}
            >
              {fmt}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ClusteringView() {
  const [runOpen, setRunOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { dataset, results, loading, error, refresh } = useAnalysisPage("Clustering");
  const [heatmap, setHeatmap] = useState<{ matrix: (number | null)[][]; sampleLabels: string[]; featureLabels: string[] } | null>(null);

  const clusters = (results?.clusters as Array<{ name: string; count: number; color: string }>) ?? [];
  const samplesProcessed = (results?.samplesProcessed as number) ?? dataset?.samples_count ?? 0;

  useEffect(() => {
    if (!dataset) return;
    api.getDatasetMatrix(dataset.id)
      .then((data) => setHeatmap({ matrix: data.matrix, sampleLabels: data.sampleLabels, featureLabels: data.featureLabels }))
      .catch(() => setHeatmap(null));
  }, [dataset?.id]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="flex h-full">
      <RunAnalysisDialog
        open={runOpen}
        onClose={() => { setRunOpen(false); refresh(); }}
        analysisName="Hierarchical Clustering"
        analysisType="Clustering"
        projectId={dataset?.project_id}
        datasetId={dataset?.id}
        stages={clusteringStages}
        onComplete={refresh}
      />
      <ConfigureDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Configure Clustering"
        groups={clusteringConfig}
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Hierarchical Clustering</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dataset ? `${dataset.project_name} · ${dataset.name}` : "No dataset"}
            </p>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configure
            </button>
            <button
              onClick={() => setRunOpen(true)}
              disabled={!dataset}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Run Analysis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Sample Groups</p>
            <p className="mt-1 text-xl tabular-nums">{clusters.length || "—"}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Samples Processed</p>
            <p className="mt-1 text-xl tabular-nums">{samplesProcessed}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Features in Heatmap</p>
            <p className="mt-1 text-xl tabular-nums">{heatmap?.featureLabels.length ?? dataset?.features_count ?? "—"}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Linkage</p>
            <p className="mt-1 text-base">Ward</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Heatmap with Dendrograms</h3>
            <ExportMenu />
          </div>
          <ChartPlaceholder type="Clustered Heatmap" height="550px" heatmap={heatmap ?? undefined} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm">Sample Dendrogram</h3>
              <ExportMenu />
            </div>
            <ChartPlaceholder type="Hierarchical Tree" height="250px" />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm">Silhouette Analysis</h3>
              <ExportMenu />
            </div>
            <ChartPlaceholder type="Cluster Quality" height="250px" />
          </div>
        </div>
      </div>

      <div className="w-64 border-l border-border bg-muted/30 p-4 space-y-4 overflow-auto">
        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Clustering Parameters</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span>Hierarchical</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Distance</span>
              <span>Euclidean</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Linkage</span>
              <span>Ward</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Normalization</span>
              <span>Z-score</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Cluster Summary</h3>
          <div className="space-y-1.5">
            {clusters.length === 0 ? (
              <p className="text-xs text-muted-foreground">Run clustering to see group assignments</p>
            ) : clusters.map((cluster, i) => (
              <div
                key={cluster.name}
                className="rounded-md bg-card p-2 text-xs hover:bg-accent cursor-pointer"
                onClick={() => toast.info(`${cluster.name} · n=${cluster.count} samples`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cluster.color }} />
                    <span>{cluster.name}</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">n={cluster.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <button
            onClick={() => setRunOpen(true)}
            disabled={!dataset}
            className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            Re-run Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
