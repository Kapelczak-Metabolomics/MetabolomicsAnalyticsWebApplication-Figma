import { useMemo } from "react";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty, buildGroupedScatterTraces } from "./plotly-utils";

interface PLSDAPlotProps {
  scores?: Array<{ comp1: number; comp2: number; group: string; sampleId?: string }>;
  explainedVariance?: number[];
  showGroupEllipses?: boolean;
}

export function PLSDAPlot({
  scores = [],
  explainedVariance = [],
  showGroupEllipses = true,
}: PLSDAPlotProps) {
  const plot = useMemo(() => {
    if (!scores.length) return null;
    const c1 = explainedVariance[0];
    const c2 = explainedVariance[1];
    return buildGroupedScatterTraces(
      scores.map((s, i) => ({
        x: s.comp1,
        y: s.comp2,
        group: s.group,
        label: s.sampleId ?? `Sample ${i + 1}`,
      })),
      {
        title: "PLS-DA score plot",
        xLabel: `Component 1${c1 != null ? ` (${c1}%)` : ""}`,
        yLabel: `Component 2${c2 != null ? ` (${c2}%)` : ""}`,
        showGroupRegions: showGroupEllipses,
      },
    );
  }, [scores, explainedVariance, showGroupEllipses]);

  if (!scores.length) return <PlotEmpty message="Run PLS-DA to generate scores" />;
  if (!plot) return <PlotEmpty message="Unable to render PLS-DA plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layoutExtras} />;
}
