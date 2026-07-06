import type { ReactNode } from "react";
import { HeatmapPlot } from "./plots/heatmap-plot";
import { VolcanoPlot, type VolcanoPoint } from "./plots/volcano-plot";
import { PCAPlot, type PCAScore } from "./plots/pca-plot";
import { PLSDAPlot } from "./plots/plsda-plot";
import { PathwayPlot } from "./plots/pathway-plot";
import { DendrogramPlot } from "./plots/dendrogram-plot";
import { VIPPlot } from "./plots/vip-plot";
import { PermutationPlot } from "./plots/permutation-plot";

interface ChartPlaceholderProps {
  type: string;
  height?: string;
  exportId?: string;
  pcaScores?: PCAScore[];
  explainedVariance?: number[];
  volcanoFeatures?: VolcanoPoint[];
  plsdaScores?: Array<{ comp1: number; comp2: number; group: string }>;
  pathways?: Array<{ name: string; genes: number; negLogP?: number; pValue?: number }>;
  heatmap?: { matrix: (number | null)[][]; sampleLabels: string[]; featureLabels: string[] };
  dendrogram?: Array<{ left: string; right: string; height: number }>;
  vipFeatures?: Array<{ name: string; vip: number }>;
  permScores?: Array<{ iteration: number; r2: number; q2: number }>;
  silhouette?: number;
}

export function ChartPlaceholder({
  type,
  height = "400px",
  exportId,
  pcaScores,
  explainedVariance,
  volcanoFeatures,
  plsdaScores,
  pathways,
  heatmap,
  dendrogram,
  vipFeatures,
  permScores,
  silhouette,
}: ChartPlaceholderProps) {
  const wrap = (children: ReactNode) => (
    <div id={exportId} data-plot-export={exportId ?? type} className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-white dark:bg-muted/10" style={{ height }}>
      {children}
    </div>
  );

  const lower = type.toLowerCase();

  if (lower.includes("heatmap") && heatmap) {
    return wrap(<HeatmapPlot {...heatmap} />);
  }

  if (lower.includes("volcano")) {
    return wrap(<VolcanoPlot features={volcanoFeatures} />);
  }

  if (lower.includes("pca")) {
    return wrap(<PCAPlot scores={pcaScores} explainedVariance={explainedVariance} />);
  }

  if (lower.includes("pls-da") || lower.includes("plsda")) {
    return wrap(<PLSDAPlot scores={plsdaScores} />);
  }

  if (lower.includes("dot plot") || lower.includes("enrichment") || lower.includes("pathway")) {
    return wrap(<PathwayPlot pathways={pathways} />);
  }

  if (lower.includes("dendrogram") || lower.includes("hierarchical tree")) {
    return wrap(<DendrogramPlot data={dendrogram} height={parseInt(height) || 250} />);
  }

  if (lower.includes("vip") || lower.includes("importance")) {
    return wrap(<VIPPlot features={vipFeatures} />);
  }

  if (lower.includes("permutation") || lower.includes("validation")) {
    return wrap(<PermutationPlot scores={permScores} />);
  }

  if (lower.includes("silhouette") || lower.includes("cluster quality")) {
    return (
      <div id={exportId} data-plot-export={exportId ?? type} className="flex items-center justify-center rounded-md border border-border bg-muted/10" style={{ height }}>
        <div className="text-center">
          <p className="text-3xl font-semibold tabular-nums">{silhouette != null ? silhouette.toFixed(3) : "—"}</p>
          <p className="text-sm text-muted-foreground mt-1">Silhouette Score</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-md border border-border bg-gradient-to-br from-muted/30 via-muted/20 to-muted/30" style={{ height }}>
      <p className="text-sm text-muted-foreground">Run analysis to generate {type}</p>
    </div>
  );
}
