import type { ReactNode } from "react";
import { HeatmapPlot } from "./plots/heatmap-plot";
import { VolcanoPlot, type VolcanoPoint } from "./plots/volcano-plot";
import { PCAPlot, type PCAScore } from "./plots/pca-plot";
import { PLSDAPlot } from "./plots/plsda-plot";
import { PathwayPlot } from "./plots/pathway-plot";
import { DendrogramPlot, type DendrogramMerge } from "./plots/dendrogram-plot";
import { VIPPlot } from "./plots/vip-plot";
import { PermutationPlot } from "./plots/permutation-plot";
import { BiomarkerPlot } from "./plots/biomarker-plot";
import { PLOT_ASPECT } from "./plots/plot-theme";

interface ChartPlaceholderProps {
  type: string;
  height?: string;
  exportId?: string;
  pcaScores?: PCAScore[];
  explainedVariance?: number[];
  volcanoFeatures?: VolcanoPoint[];
  plotTitle?: string;
  pcaConfig?: { showGroupEllipses?: boolean; plotTitle?: string };
  plsdaConfig?: { showGroupEllipses?: boolean; scorePlotTitle?: string; vipPlotTitle?: string; permutationPlotTitle?: string };
  volcanoConfig?: { pThreshold?: number; fcThreshold?: number; showLabels?: boolean; labelTopN?: number; plotTitle?: string };
  plsdaScores?: Array<{ comp1: number; comp2: number; group: string; sampleId?: string }>;
  pathways?: Array<{ name: string; genes: number; negLogP?: number; pValue?: number }>;
  heatmap?: { matrix: (number | null)[][]; sampleLabels: string[]; featureLabels: string[]; sampleGroups?: string[] };
  heatmapOrientation?: "samples-y" | "samples-x";
  heatmapConfig?: {
    sampleLabelPosition?: "top" | "bottom";
    showClusterBars?: boolean;
    clusterBarPosition?: "top" | "left";
    title?: string;
    dendrogramTitle?: string;
  };
  dendrogram?: DendrogramMerge[];
  dendrogramLabels?: string[];
  dendrogramTitle?: string;
  vipFeatures?: Array<{ name: string; vip: number }>;
  permScores?: Array<{ iteration: number; r2: number; q2: number }>;
  observedR2?: number;
  observedQ2?: number;
  biomarkerCandidates?: Array<{ name: string; score: number; log2fc: number; pValue: number }>;
  silhouette?: number;
}

export function ChartPlaceholder({
  type,
  height = "400px",
  exportId,
  pcaScores,
  explainedVariance,
  volcanoFeatures,
  volcanoConfig,
  pcaConfig,
  plsdaConfig,
  plsdaScores,
  pathways,
  heatmap,
  heatmapOrientation,
  heatmapConfig,
  dendrogram,
  dendrogramLabels,
  dendrogramTitle,
  plotTitle,
  vipFeatures,
  permScores,
  observedR2,
  observedQ2,
  biomarkerCandidates,
  silhouette,
}: ChartPlaceholderProps) {
  const lower = type.toLowerCase();
  const isHeatmap = lower.includes("heatmap");
  const isPathway = lower.includes("dot plot") || lower.includes("enrichment") || lower.includes("pathway");
  const isScrollable = isHeatmap || isPathway || lower.includes("vip") || lower.includes("importance");

  const wrap = (children: ReactNode) => (
    <div
      id={exportId}
      data-plot-export={exportId ?? type}
      className={`w-full rounded-xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-3 shadow-sm ${isScrollable ? "overflow-hidden" : "overflow-visible"}`}
      style={{ minHeight: height }}
    >
      <div
        className={`w-full ${isScrollable ? "min-h-[280px] overflow-auto" : ""}`}
        style={
          isScrollable
            ? { minHeight: height, maxHeight: "min(640px, 78vh)" }
            : { aspectRatio: PLOT_ASPECT, minHeight: "320px", maxHeight: "min(600px, 78vh)", width: "100%" }
        }
      >
        {children}
      </div>
    </div>
  );

  if (lower.includes("heatmap") && heatmap) {
    return wrap(
      <HeatmapPlot
        {...heatmap}
        orientation={heatmapOrientation}
        sampleLabelPosition={heatmapConfig?.sampleLabelPosition}
        showClusterBars={heatmapConfig?.showClusterBars}
        clusterBarPosition={heatmapConfig?.clusterBarPosition}
        title={heatmapConfig?.title ?? plotTitle}
      />
    );
  }

  if (lower.includes("volcano")) {
    return wrap(
      <VolcanoPlot
        features={volcanoFeatures}
        pThreshold={volcanoConfig?.pThreshold}
        fcThreshold={volcanoConfig?.fcThreshold}
        showLabels={volcanoConfig?.showLabels}
        labelTopN={volcanoConfig?.labelTopN}
        title={volcanoConfig?.plotTitle ?? plotTitle}
      />
    );
  }

  if (lower.includes("pca")) {
    return wrap(
      <PCAPlot
        scores={pcaScores}
        explainedVariance={explainedVariance}
        showGroupEllipses={pcaConfig?.showGroupEllipses ?? true}
        title={pcaConfig?.plotTitle ?? plotTitle}
      />
    );
  }

  if (lower.includes("pls-da") || lower.includes("plsda")) {
    if (lower.includes("vip") || lower.includes("importance")) {
      return wrap(<VIPPlot features={vipFeatures} title={plsdaConfig?.vipPlotTitle ?? plotTitle} />);
    }
    if (lower.includes("permutation") || lower.includes("validation")) {
      return wrap(
        <PermutationPlot
          scores={permScores}
          observedR2={observedR2}
          observedQ2={observedQ2}
          title={plsdaConfig?.permutationPlotTitle ?? plotTitle}
        />
      );
    }
    return wrap(
      <PLSDAPlot
        scores={plsdaScores}
        explainedVariance={explainedVariance}
        showGroupEllipses={plsdaConfig?.showGroupEllipses ?? pcaConfig?.showGroupEllipses ?? true}
        title={plsdaConfig?.scorePlotTitle ?? plotTitle}
      />
    );
  }

  if (lower.includes("dot plot") || lower.includes("enrichment") || lower.includes("pathway")) {
    return wrap(<PathwayPlot pathways={pathways} title={plotTitle} />);
  }

  if (lower.includes("dendrogram") || lower.includes("hierarchical tree")) {
    return wrap(<DendrogramPlot data={dendrogram} labels={dendrogramLabels} title={dendrogramTitle ?? plotTitle} />);
  }

  if (lower.includes("vip") || lower.includes("importance")) {
    return wrap(<VIPPlot features={vipFeatures} title={plotTitle} />);
  }

  if (lower.includes("permutation") || lower.includes("validation")) {
    return wrap(
      <PermutationPlot scores={permScores} observedR2={observedR2} observedQ2={observedQ2} title={plotTitle} />
    );
  }

  if (lower.includes("biomarker")) {
    return wrap(<BiomarkerPlot candidates={biomarkerCandidates} title={plotTitle} />);
  }

  if (lower.includes("silhouette") || lower.includes("cluster quality")) {
    const quality = silhouette == null ? "—" : silhouette >= 0.7 ? "Strong" : silhouette >= 0.5 ? "Reasonable" : silhouette >= 0.25 ? "Weak" : "Poor";
    return (
      <div
        id={exportId}
        data-plot-export={exportId ?? type}
        className="flex items-center justify-center rounded-lg border border-border bg-card p-6"
        style={{ height, minHeight: height }}
      >
        <div className="text-center space-y-3">
          <p className="text-4xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {silhouette != null ? silhouette.toFixed(3) : "—"}
          </p>
          <p className="text-sm text-muted-foreground">Average silhouette score</p>
          <p className="text-xs font-medium text-foreground">{quality} cluster separation</p>
          <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500"
              style={{ width: `${Math.max(0, Math.min(100, ((silhouette ?? 0) + 1) * 50))}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/20 p-6"
      style={{ height, minHeight: height }}
    >
      <p className="text-sm text-muted-foreground">Run analysis to generate {type}</p>
    </div>
  );
}
