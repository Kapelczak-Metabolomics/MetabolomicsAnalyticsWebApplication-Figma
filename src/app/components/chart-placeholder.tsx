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
  const lower = type.toLowerCase();

  if (lower.includes("heatmap") && heatmap) {
    return (
      <div className="flex items-center justify-center overflow-auto rounded-md border border-border bg-muted/10" style={{ height }}>
        <HeatmapPlot {...heatmap} />
      </div>
    );
  }

  if (lower.includes("volcano")) {
    return (
      <div className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted/10" style={{ height }}>
        <VolcanoPlot features={volcanoFeatures} />
      </div>
    );
  }

  if (lower.includes("pca")) {
    return (
      <div className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted/10" style={{ height }}>
        <PCAPlot scores={pcaScores} explainedVariance={explainedVariance} />
      </div>
    );
  }

  if (lower.includes("pls-da") || lower.includes("plsda")) {
    return (
      <div className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted/10" style={{ height }}>
        <PLSDAPlot scores={plsdaScores} />
      </div>
    );
  }

  if (lower.includes("dot plot") || lower.includes("enrichment") || lower.includes("pathway")) {
    return (
      <div className="flex items-center justify-center overflow-auto rounded-md border border-border bg-muted/10" style={{ height }}>
        <PathwayPlot pathways={pathways} />
      </div>
    );
  }

  if (lower.includes("dendrogram") || lower.includes("hierarchical tree")) {
    return (
      <div className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted/10" style={{ height }}>
        <DendrogramPlot data={dendrogram} height={parseInt(height) || 250} />
      </div>
    );
  }

  if (lower.includes("vip") || lower.includes("importance")) {
    return (
      <div className="flex items-center justify-center overflow-auto rounded-md border border-border bg-muted/10" style={{ height }}>
        <VIPPlot features={vipFeatures} />
      </div>
    );
  }

  if (lower.includes("permutation") || lower.includes("validation")) {
    return (
      <div className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted/10" style={{ height }}>
        <PermutationPlot scores={permScores} />
      </div>
    );
  }

  if (lower.includes("silhouette") || lower.includes("cluster quality")) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-muted/10" style={{ height }}>
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
