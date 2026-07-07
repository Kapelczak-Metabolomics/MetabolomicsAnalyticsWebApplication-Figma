import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";
import { computeHeatmapLayout, truncateLabel } from "./heatmap-layout";

export type HeatmapOrientation = "samples-y" | "samples-x";

interface HeatmapPlotProps {
  matrix?: (number | null)[][];
  sampleLabels?: string[];
  featureLabels?: string[];
  orientation?: HeatmapOrientation;
}

function transposeMatrix(matrix: (number | null)[][]) {
  if (!matrix.length || !matrix[0]?.length) return matrix;
  const rows = matrix[0].length;
  const cols = matrix.length;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => matrix[j][i] ?? null)
  );
}

export function HeatmapPlot({
  matrix = [],
  sampleLabels = [],
  featureLabels = [],
  orientation = "samples-y",
}: HeatmapPlotProps) {
  const plot = useMemo(() => {
    if (!matrix.length || !matrix[0]?.length) return null;

    const samplesOnY = orientation !== "samples-x";
    const featureNames = featureLabels.length ? featureLabels : matrix[0].map((_, i) => `F${i + 1}`);
    const sampleNames = sampleLabels.length ? sampleLabels : matrix.map((_, i) => `S${i + 1}`);

    const z = samplesOnY
      ? matrix.map((row) => row.map((v) => (v == null ? null : v)))
      : transposeMatrix(matrix);

    const xRaw = samplesOnY ? featureNames : sampleNames;
    const yRaw = samplesOnY ? sampleNames : featureNames;
    const xTitle = samplesOnY ? "Features (compounds)" : "Samples";
    const yTitle = samplesOnY ? "Samples" : "Features (compounds)";
    const plotTitle = samplesOnY ? "Sample × feature expression" : "Feature × sample expression";

    const rowCount = z.length;
    const layoutMetrics = computeHeatmapLayout(xRaw, yRaw, rowCount);

    const xDisplay = xRaw.map((label) => truncateLabel(label, layoutMetrics.tickFontSize > 9 ? 24 : 18));
    const yDisplay = yRaw.map((label) => truncateLabel(label, 16));

    const flat = z.flat().filter((v): v is number => v != null);
    const zmin = flat.length ? Math.min(...flat) : 0;
    const zmax = flat.length ? Math.max(...flat) : 1;

    const traces: Data[] = [
      {
        type: "heatmap",
        z,
        x: xDisplay,
        y: yDisplay,
        customdata: z.map((row, yi) =>
          row.map((_, xi) => {
            const sample = samplesOnY ? sampleNames[yi] : sampleNames[xi];
            const feature = samplesOnY ? featureNames[xi] : featureNames[yi];
            return [sample, feature];
          })
        ),
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
        text: plotTitle,
        font: { size: 13 },
        pad: { t: 8, b: 12 },
        x: 0,
        xanchor: "left",
      },
      xaxis: {
        title: { text: xTitle, standoff: 14, font: { size: 11 } },
        tickangle: layoutMetrics.tickAngle,
        side: "top",
        tickfont: { size: layoutMetrics.tickFontSize },
        automargin: true,
        dtick: layoutMetrics.showEveryNth > 1 ? layoutMetrics.showEveryNth : undefined,
        showgrid: false,
      },
      yaxis: {
        title: { text: yTitle, font: { size: 11 } },
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
  }, [matrix, sampleLabels, featureLabels, orientation]);

  if (!matrix.length || !matrix[0]?.length) return <PlotEmpty message="Run clustering to view heatmap" />;
  if (!plot) return <PlotEmpty message="Unable to render heatmap" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
}
