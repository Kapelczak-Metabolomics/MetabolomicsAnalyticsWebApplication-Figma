import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";

interface HeatmapPlotProps {
  matrix?: (number | null)[][];
  sampleLabels?: string[];
  featureLabels?: string[];
}

export function HeatmapPlot({ matrix = [], sampleLabels = [], featureLabels = [] }: HeatmapPlotProps) {
  const plot = useMemo(() => {
    if (!matrix.length || !matrix[0]?.length) return null;

    const z = matrix.map((row) => row.map((v) => (v == null ? null : v)));
    const flat = z.flat().filter((v): v is number => v != null);
    const zmin = flat.length ? Math.min(...flat) : 0;
    const zmax = flat.length ? Math.max(...flat) : 1;

    const traces: Data[] = [
      {
        type: "heatmap",
        z,
        x: featureLabels.length ? featureLabels : matrix[0].map((_, i) => `F${i + 1}`),
        y: sampleLabels.length ? sampleLabels : matrix.map((_, i) => `S${i + 1}`),
        colorscale: [
          [0, "#1e40af"],
          [0.5, "#f1f5f9"],
          [1, "#dc2626"],
        ],
        zmin,
        zmax,
        colorbar: { title: { text: "Expression" }, thickness: 14, len: 0.75 },
        hovertemplate: "Sample: %{y}<br>Feature: %{x}<br>Value: %{z:.3f}<extra></extra>",
      },
    ];

    const height = Math.max(360, matrix.length * 22 + 120);
    const layout: Partial<Layout> = {
      title: { text: "Sample × feature expression", font: { size: 14 } },
      xaxis: { title: { text: "Features" }, tickangle: -45, side: "top" },
      yaxis: { title: { text: "Samples" }, autorange: "reversed" },
      margin: { l: 100, r: 80, t: 80, b: 80 },
      height,
    };

    return { traces, layout };
  }, [matrix, sampleLabels, featureLabels]);

  if (!matrix.length || !matrix[0]?.length) return <PlotEmpty message="Run clustering to view heatmap" />;
  if (!plot) return <PlotEmpty message="Unable to render heatmap" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
}
