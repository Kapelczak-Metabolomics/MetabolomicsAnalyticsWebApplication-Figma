import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";
import { computeHeatmapLayout, truncateLabel } from "./heatmap-layout";

interface HeatmapPlotProps {
  matrix?: (number | null)[][];
  sampleLabels?: string[];
  featureLabels?: string[];
}

export function HeatmapPlot({ matrix = [], sampleLabels = [], featureLabels = [] }: HeatmapPlotProps) {
  const plot = useMemo(() => {
    if (!matrix.length || !matrix[0]?.length) return null;

    const xRaw = featureLabels.length ? featureLabels : matrix[0].map((_, i) => `F${i + 1}`);
    const yRaw = sampleLabels.length ? sampleLabels : matrix.map((_, i) => `S${i + 1}`);
    const layoutMetrics = computeHeatmapLayout(xRaw, yRaw, matrix.length);

    const xDisplay = xRaw.map((label) => truncateLabel(label, layoutMetrics.tickFontSize > 9 ? 24 : 18));
    const yDisplay = yRaw.map((label) => truncateLabel(label, 16));

    const z = matrix.map((row) => row.map((v) => (v == null ? null : v)));
    const flat = z.flat().filter((v): v is number => v != null);
    const zmin = flat.length ? Math.min(...flat) : 0;
    const zmax = flat.length ? Math.max(...flat) : 1;

    const traces: Data[] = [
      {
        type: "heatmap",
        z,
        x: xDisplay,
        y: yDisplay,
        customdata: z.map((row, yi) => row.map((_, xi) => [yRaw[yi], xRaw[xi]])),
        colorscale: [
          [0, "#1e40af"],
          [0.5, "#f1f5f9"],
          [1, "#dc2626"],
        ],
        zmin,
        zmax,
        colorbar: {
          title: { text: "Expression", font: { size: 11 } },
          thickness: 12,
          len: 0.7,
          x: 1.02,
        },
        hovertemplate: "Sample: %{customdata[0]}<br>Feature: %{customdata[1]}<br>Value: %{z:.3f}<extra></extra>",
      },
    ];

    const layout: Partial<Layout> = {
      title: {
        text: "Sample × feature expression",
        font: { size: 13 },
        pad: { t: 8, b: 12 },
        x: 0,
        xanchor: "left",
      },
      xaxis: {
        title: { text: "Features", standoff: 14, font: { size: 11 } },
        tickangle: layoutMetrics.tickAngle,
        side: "top",
        tickfont: { size: layoutMetrics.tickFontSize },
        automargin: true,
        dtick: layoutMetrics.showEveryNth > 1 ? layoutMetrics.showEveryNth : undefined,
        showgrid: false,
      },
      yaxis: {
        title: { text: "Samples", font: { size: 11 } },
        autorange: "reversed",
        tickfont: { size: Math.max(8, layoutMetrics.tickFontSize) },
        automargin: true,
        showgrid: false,
      },
      margin: {
        l: layoutMetrics.leftMargin,
        r: layoutMetrics.rightMargin,
        t: layoutMetrics.topMargin,
        b: layoutMetrics.bottomMargin,
      },
      height: layoutMetrics.height,
    };

    return { traces, layout };
  }, [matrix, sampleLabels, featureLabels]);

  if (!matrix.length || !matrix[0]?.length) return <PlotEmpty message="Run clustering to view heatmap" />;
  if (!plot) return <PlotEmpty message="Unable to render heatmap" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
};
