import { HeatmapPlot } from "./plots/heatmap-plot";
import { VolcanoPlot } from "./plots/volcano-plot";
import { PCAPlot } from "./plots/pca-plot";
import { PLSDAPlot } from "./plots/plsda-plot";
import { PathwayPlot } from "./plots/pathway-plot";

interface ChartPlaceholderProps {
  type: string;
  height?: string;
}

export function ChartPlaceholder({
  type,
  height = "400px",
}: ChartPlaceholderProps) {
  // Render actual plot visualizations
  if (type.toLowerCase().includes("heatmap")) {
    return (
      <div
        className="flex items-center justify-center overflow-auto rounded-md border border-border bg-muted/10"
        style={{ height }}
      >
        <HeatmapPlot />
      </div>
    );
  }

  if (type.toLowerCase().includes("volcano")) {
    return (
      <div
        className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted/10"
        style={{ height }}
      >
        <VolcanoPlot />
      </div>
    );
  }

  if (type.toLowerCase().includes("pca")) {
    return (
      <div
        className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted/10"
        style={{ height }}
      >
        <PCAPlot />
      </div>
    );
  }

  if (type.toLowerCase().includes("pls-da")) {
    return (
      <div
        className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted/10"
        style={{ height }}
      >
        <PLSDAPlot />
      </div>
    );
  }

  if (type.toLowerCase().includes("dot plot") || type.toLowerCase().includes("enrichment")) {
    return (
      <div
        className="flex items-center justify-center overflow-auto rounded-md border border-border bg-muted/10"
        style={{ height }}
      >
        <PathwayPlot />
      </div>
    );
  }

  // Fallback placeholder
  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-md border border-border bg-gradient-to-br from-muted/30 via-muted/20 to-muted/30"
      style={{ height }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.05),transparent_50%)]" />
      <div className="text-center relative z-10">
        <div className="mx-auto mb-2 h-12 w-12 rounded-lg bg-gradient-to-br from-violet-500/10 to-cyan-500/10 flex items-center justify-center">
          <div className="h-6 w-6 rounded bg-gradient-to-br from-violet-500/20 to-cyan-500/20" />
        </div>
        <p className="text-sm font-medium text-foreground/70">{type} Visualization</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Chart rendering area
        </p>
      </div>
    </div>
  );
}
