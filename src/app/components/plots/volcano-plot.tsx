import { useMemo } from "react";
import type { Data, Layout, Shape } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";

export interface VolcanoPoint {
  log2fc: number;
  negLogP: number;
  pValue: number;
  name?: string;
}

interface VolcanoPlotProps {
  features?: VolcanoPoint[];
  pThreshold?: number;
  fcThreshold?: number;
  showLabels?: boolean;
  labelTopN?: number;
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function selectLabelIndices(
  features: VolcanoPoint[],
  pThreshold: number,
  fcThreshold: number,
  topN: number,
): Set<number> {
  const significant = features
    .map((f, i) => ({ i, f }))
    .filter(({ f }) => f.pValue < pThreshold && Math.abs(f.log2fc) > fcThreshold)
    .sort((a, b) => a.f.pValue - b.f.pValue)
    .slice(0, topN);
  return new Set(significant.map((s) => s.i));
}

export function VolcanoPlot({
  features = [],
  pThreshold = 0.05,
  fcThreshold = 0.5,
  showLabels = false,
  labelTopN = 15,
}: VolcanoPlotProps) {
  const plot = useMemo(() => {
    if (!features.length) return null;

    const labelSet = showLabels
      ? selectLabelIndices(features, pThreshold, fcThreshold, labelTopN)
      : new Set<number>();

    const ns: VolcanoPoint[] = [];
    const up: VolcanoPoint[] = [];
    const down: VolcanoPoint[] = [];

    features.forEach((f) => {
      const sig = f.pValue < pThreshold && Math.abs(f.log2fc) > fcThreshold;
      if (!sig) ns.push(f);
      else if (f.log2fc > 0) up.push(f);
      else down.push(f);
    });

    const traces: Data[] = [
      {
        type: "scatter",
        mode: "markers",
        name: `Not significant (${ns.length})`,
        x: ns.map((f) => f.log2fc),
        y: ns.map((f) => f.negLogP),
        text: ns.map((f) => f.name ?? ""),
        hovertemplate: "%{text}<br>log₂FC: %{x:.3f}<br>−log₁₀ p: %{y:.3f}<extra></extra>",
        marker: { color: "#94a3b8", size: 6, opacity: 0.45 },
      },
      {
        type: "scatter",
        mode: "markers",
        name: `Upregulated (${up.length})`,
        x: up.map((f) => f.log2fc),
        y: up.map((f) => f.negLogP),
        text: up.map((f) => f.name ?? ""),
        hovertemplate: "%{text}<br>log₂FC: %{x:.3f}<br>−log₁₀ p: %{y:.3f}<extra></extra>",
        marker: { color: "#ef4444", size: 9, opacity: 0.9, line: { color: "#fff", width: 1 } },
      },
      {
        type: "scatter",
        mode: "markers",
        name: `Downregulated (${down.length})`,
        x: down.map((f) => f.log2fc),
        y: down.map((f) => f.negLogP),
        text: down.map((f) => f.name ?? ""),
        hovertemplate: "%{text}<br>log₂FC: %{x:.3f}<br>−log₁₀ p: %{y:.3f}<extra></extra>",
        marker: { color: "#0ea5e9", size: 9, opacity: 0.9, line: { color: "#fff", width: 1 } },
      },
    ];

    if (showLabels && labelSet.size > 0) {
      const labeled = features.filter((_, i) => labelSet.has(i));
      traces.push({
        type: "scatter",
        mode: "text",
        name: "Labels",
        x: labeled.map((f) => f.log2fc),
        y: labeled.map((f) => f.negLogP),
        text: labeled.map((f) => f.name ?? ""),
        textposition: "top center",
        textfont: { size: 10, color: "#334155" },
        hoverinfo: "skip",
        showlegend: false,
      });
    }

    const pLine = -Math.log10(pThreshold);
    const yMax = Math.max(...features.map((f) => f.negLogP), pLine, 1) * 1.08;
    const xMaxAbs = Math.max(...features.map((f) => Math.abs(f.log2fc)), fcThreshold) * 1.12;

    const shapes: Partial<Shape>[] = [
      { type: "line", x0: -fcThreshold, x1: -fcThreshold, y0: 0, y1: yMax, line: { color: "#0891b2", width: 1.5, dash: "dash" } },
      { type: "line", x0: fcThreshold, x1: fcThreshold, y0: 0, y1: yMax, line: { color: "#dc2626", width: 1.5, dash: "dash" } },
      { type: "line", x0: -xMaxAbs, x1: xMaxAbs, y0: pLine, y1: pLine, line: { color: "#64748b", width: 1.5, dash: "dash" } },
      { type: "line", x0: 0, x1: 0, y0: 0, y1: yMax, line: { color: "#cbd5e1", width: 1 } },
    ];

    const layout: Partial<Layout> = {
      title: { text: "Volcano plot", font: { size: 14 } },
      xaxis: { title: { text: "log₂ fold change" }, range: [-xMaxAbs, xMaxAbs], zeroline: true },
      yaxis: { title: { text: "−log₁₀ p-value" }, range: [0, yMax] },
      shapes,
      annotations: [
        {
          x: 0.02,
          y: 0.02,
          xref: "paper",
          yref: "paper",
          text: `p &lt; ${pThreshold}, |FC| &gt; ${fcThreshold}`,
          showarrow: false,
          font: { size: 10, color: "#64748b" },
          xanchor: "left",
          yanchor: "bottom",
        },
      ],
    };

    return { traces, layout };
  }, [features, pThreshold, fcThreshold, showLabels, labelTopN]);

  if (!features.length) return <PlotEmpty message="Run analysis to generate volcano plot from your dataset" />;
  if (!plot) return <PlotEmpty message="Unable to render volcano plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
}
