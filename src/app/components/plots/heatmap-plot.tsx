import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";
import { computeHeatmapLayout, truncateLabel } from "./heatmap-layout";
import {
  buildGroupColorMap,
  clusterBarLegend,
  discreteColorscale,
  groupIndices,
} from "./heatmap-cluster-bar";

export type HeatmapOrientation = "samples-y" | "samples-x";
export type SampleLabelPosition = "top" | "bottom";
export type ClusterBarPosition = "top" | "left";
export type GroupLegendStyle = "inline" | "side-panel";

interface HeatmapPlotProps {
  matrix?: (number | null)[][];
  sampleLabels?: string[];
  featureLabels?: string[];
  sampleGroups?: string[];
  orientation?: HeatmapOrientation;
  sampleLabelPosition?: SampleLabelPosition;
  showClusterBars?: boolean;
  clusterBarPosition?: ClusterBarPosition;
  groupLegendStyle?: GroupLegendStyle;
  groupLegendLabel?: string;
  title?: string;
}

function transposeMatrix(matrix: (number | null)[][]) {
  if (!matrix.length || !matrix[0]?.length) return matrix;
  const rows = matrix[0].length;
  const cols = matrix.length;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => matrix[j][i] ?? null)
  );
}

function buildSidePanelLegend(
  legend: Array<{ name: string; color: string }>,
  label: string
) {
  const boxTop = 0.17;
  const rowHeight = 0.038;
  const boxHeight = Math.max(0.08, legend.length * rowHeight + 0.045);
  const boxBottom = boxTop - boxHeight;

  const shapes = [
    {
      type: "rect" as const,
      xref: "paper" as const,
      yref: "paper" as const,
      x0: 1.04,
      x1: 1.28,
      y0: boxBottom,
      y1: boxTop,
      line: { color: "#cbd5e1", width: 1 },
      fillcolor: "rgba(255,255,255,0.95)",
    },
    ...legend.map((entry, i) => ({
      type: "rect" as const,
      xref: "paper" as const,
      yref: "paper" as const,
      x0: 1.07,
      x1: 1.095,
      y0: boxTop - 0.028 - i * rowHeight,
      y1: boxTop - 0.008 - i * rowHeight,
      line: { color: entry.color, width: 0 },
      fillcolor: entry.color,
    })),
  ];

  const annotations = [
    {
      x: 1.16,
      y: boxTop - 0.012,
      xref: "paper" as const,
      yref: "paper" as const,
      text: `<b>${label}</b>`,
      showarrow: false,
      font: { size: 10, color: "#334155" },
      xanchor: "center" as const,
    },
    ...legend.map((entry, i) => ({
      x: 1.105,
      y: boxTop - 0.018 - i * rowHeight,
      xref: "paper" as const,
      yref: "paper" as const,
      text: entry.name,
      showarrow: false,
      font: { size: 9, color: "#334155" },
      xanchor: "left" as const,
    })),
  ];

  return { shapes, annotations };
}

export function HeatmapPlot({
  matrix = [],
  sampleLabels = [],
  featureLabels = [],
  sampleGroups = [],
  orientation = "samples-y",
  sampleLabelPosition = "top",
  showClusterBars = true,
  clusterBarPosition = "top",
  groupLegendStyle = "inline",
  groupLegendLabel = "class",
  title,
}: HeatmapPlotProps) {
  const plot = useMemo(() => {
    if (!matrix.length || !matrix[0]?.length) return null;

    const samplesOnY = orientation !== "samples-x";
    const featureNames = featureLabels.length ? featureLabels : matrix[0].map((_, i) => `F${i + 1}`);
    const sampleNames = sampleLabels.length ? sampleLabels : matrix.map((_, i) => `S${i + 1}`);
    const groups =
      sampleGroups.length === sampleNames.length
        ? sampleGroups
        : sampleNames.map((_, i) => sampleGroups[i] ?? `Group ${(i % 3) + 1}`);

    let z = samplesOnY
      ? matrix.map((row) => row.map((v) => (v == null ? null : v)))
      : transposeMatrix(matrix);

    const colorMap = buildGroupColorMap(groups);
    const groupIdx = groupIndices(groups, colorMap);
    const legend = clusterBarLegend(colorMap);
    const useBars = showClusterBars && legend.length > 0;

    let barLabel = "Group";
    let xRaw: string[];
    let yRaw: string[];

    if (samplesOnY) {
      yRaw = sampleNames;
      xRaw = [...featureNames];
      if (useBars && clusterBarPosition === "left") {
        z = z.map((row, i) => [groupIdx[i], ...row]);
        xRaw = [barLabel, ...xRaw];
      } else if (useBars && clusterBarPosition === "top") {
        z = [[...groupIdx.map(() => null), ...Array(featureNames.length).fill(null)], ...z];
        yRaw = ["", ...yRaw];
        // Insert group bar as first row with numeric indices for coloring via overlay trace
      }
    } else {
      xRaw = sampleNames;
      yRaw = [...featureNames];
      if (useBars && clusterBarPosition === "top") {
        z = [[...groupIdx], ...z];
        yRaw = [barLabel, ...yRaw];
      } else if (useBars && clusterBarPosition === "left") {
        z = z.map((row) => [null, ...row]);
        xRaw = [barLabel, ...xRaw];
      }
    }

    const xTitle = samplesOnY ? "Features (compounds)" : "Samples";
    const yTitle = samplesOnY ? "Samples" : "Features (compounds)";
    const plotTitle =
      title?.trim() ||
      (samplesOnY ? "Sample × feature expression" : "Feature × sample expression");

    const rowCount = z.length;
    const layoutMetrics = computeHeatmapLayout(
      samplesOnY ? xRaw.filter((l) => l !== barLabel) : xRaw,
      samplesOnY ? yRaw.filter((l) => l !== "") : yRaw.filter((l) => l !== barLabel),
      rowCount,
      {
        sampleLabelPosition,
        showClusterBars: useBars,
        clusterBarPosition,
        groupLegendStyle,
        samplesOnY,
      }
    );

    const xDisplay = xRaw.map((label) =>
      label === barLabel ? "" : truncateLabel(label, layoutMetrics.tickFontSize > 9 ? 24 : 18)
    );
    const yDisplay = yRaw.map((label) =>
      label === "" || label === barLabel ? "" : truncateLabel(label, 16)
    );

    const flat = z.flat().filter((v): v is number => v != null);
    const zmin = flat.length ? Math.min(...flat) : 0;
    const zmax = flat.length ? Math.max(...flat) : 1;

    const traces: Data[] = [];

    // Group color bar overlay (left column or top row)
    if (useBars) {
      const groupScale = discreteColorscale(colorMap);
      if (samplesOnY && clusterBarPosition === "left") {
        traces.push({
          type: "heatmap",
          z: groupIdx.map((g) => [g]),
          x: [""],
          y: yDisplay,
          colorscale: groupScale,
          zmin: 0,
          zmax: Math.max(1, legend.length - 1),
          showscale: false,
          hovertemplate: "Sample: %{y}<br>Group: %{customdata}<extra></extra>",
          customdata: groups.map((g) => g),
          xgap: 1,
        });
        traces.push({
          type: "heatmap",
          z: z.map((row) => row.slice(1)),
          x: xDisplay.slice(1),
          y: yDisplay,
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
          hovertemplate:
            "Sample: %{customdata[0]}<br>Feature: %{customdata[1]}<br>Group: %{customdata[2]}<br>Value: %{z:.3f}<extra></extra>",
          customdata: z.map((row, yi) =>
            row.slice(1).map((_, xi) => [sampleNames[yi], featureNames[xi], groups[yi]])
          ),
          xgap: 1,
          ygap: 1,
        });
      } else if (!samplesOnY && clusterBarPosition === "top") {
        traces.push({
          type: "heatmap",
          z: [groupIdx],
          x: xDisplay,
          y: [""],
          colorscale: groupScale,
          zmin: 0,
          zmax: Math.max(1, legend.length - 1),
          showscale: false,
          hovertemplate: "Sample: %{x}<br>Group: %{customdata}<extra></extra>",
          customdata: [groups],
          ygap: 1,
        });
        traces.push({
          type: "heatmap",
          z: z.slice(1),
          x: xDisplay,
          y: yDisplay.slice(1),
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
          hovertemplate:
            "Sample: %{customdata[0]}<br>Feature: %{customdata[1]}<br>Group: %{customdata[2]}<br>Value: %{z:.3f}<extra></extra>",
          customdata: z.slice(1).map((row, yi) =>
            row.map((_, xi) => [sampleNames[xi], featureNames[yi], groups[xi]])
          ),
          xgap: 1,
          ygap: 1,
        });
      } else {
        // Fallback: single heatmap without bar split
        traces.push({
          type: "heatmap",
          z,
          x: xDisplay,
          y: yDisplay,
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
          hovertemplate:
            "Sample: %{customdata[0]}<br>Feature: %{customdata[1]}<br>Group: %{customdata[2]}<br>Value: %{z:.3f}<extra></extra>",
          customdata: z.map((row, yi) =>
            row.map((_, xi) => {
              const sample = samplesOnY ? sampleNames[yi] : sampleNames[xi];
              const feature = samplesOnY ? featureNames[xi] : featureNames[yi];
              const group = samplesOnY ? groups[yi] : groups[xi];
              return [sample, feature, group];
            })
          ),
        });
      }
    } else {
      traces.push({
        type: "heatmap",
        z,
        x: xDisplay,
        y: yDisplay,
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
        hovertemplate:
          "Sample: %{customdata[0]}<br>Feature: %{customdata[1]}<br>Group: %{customdata[2]}<br>Value: %{z:.3f}<extra></extra>",
        customdata: z.map((row, yi) =>
          row.map((_, xi) => {
            const sample = samplesOnY ? sampleNames[yi] : sampleNames[xi];
            const feature = samplesOnY ? featureNames[xi] : featureNames[yi];
            const group = samplesOnY ? groups[yi] : groups[xi];
            return [sample, feature, group];
          })
        ),
      });
    }

    const featureAxisSide = samplesOnY ? "top" : sampleLabelPosition;
    const sampleAxisSide = samplesOnY ? undefined : sampleLabelPosition;

    const sideLegend =
      useBars && groupLegendStyle === "side-panel"
        ? buildSidePanelLegend(legend, groupLegendLabel.trim() || "class")
        : null;

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
        side: samplesOnY ? "top" : sampleAxisSide,
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
        side: samplesOnY ? "left" : featureAxisSide === "top" ? "left" : "left",
      },
      margin: {
        l: layoutMetrics.leftMargin,
        r: layoutMetrics.rightMargin,
        t: layoutMetrics.topMargin,
        b: layoutMetrics.bottomMargin,
      },
      height: layoutMetrics.height,
      shapes: sideLegend?.shapes ?? [],
      annotations:
        useBars && groupLegendStyle === "inline"
          ? legend.map((entry, i) => ({
              x: 1.1,
              y: 1 - i * 0.055,
              xref: "paper" as const,
              yref: "paper" as const,
              text: `■ ${entry.name}`,
              showarrow: false,
              font: { size: 10, color: entry.color },
              xanchor: "left" as const,
            }))
          : sideLegend?.annotations ?? [],
    };

    return { traces, layout };
  }, [
    matrix,
    sampleLabels,
    featureLabels,
    sampleGroups,
    orientation,
    sampleLabelPosition,
    showClusterBars,
    clusterBarPosition,
    groupLegendStyle,
    groupLegendLabel,
    title,
  ]);

  if (!matrix.length || !matrix[0]?.length) return <PlotEmpty message="Run clustering to view heatmap" />;
  if (!plot) return <PlotEmpty message="Unable to render heatmap" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
}
