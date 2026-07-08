import { useMemo } from "react";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty, buildGroupedScatterTraces } from "./plotly-utils";

export interface PCAScore {
  sampleId: string;
  group: string;
  PC1: number;
  PC2: number;
}

interface PCAPlotProps {
  scores?: PCAScore[];
  explainedVariance?: number[];
  showGroupEllipses?: boolean;
  title?: string;
}

export function PCAPlot({
  scores = [],
  explainedVariance = [],
  showGroupEllipses = true,
  title = "PCA score plot",
}: PCAPlotProps) {
  const plot = useMemo(() => {
    if (!scores.length) return null;
    const pc1Var = explainedVariance[0] ?? 0;
    const pc2Var = explainedVariance[1] ?? 0;
    return buildGroupedScatterTraces(
      scores.map((s) => ({ x: s.PC1, y: s.PC2, group: s.group, label: s.sampleId })),
      {
        title,
        xLabel: `PC1 (${pc1Var}% variance)`,
        yLabel: `PC2 (${pc2Var}% variance)`,
        showGroupRegions: showGroupEllipses,
      },
    );
  }, [scores, explainedVariance, showGroupEllipses, title]);

  if (!scores.length) return <PlotEmpty message="Run analysis to generate PCA scores from your dataset" />;
  if (!plot) return <PlotEmpty message="Unable to render PCA plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layoutExtras} />;
}
