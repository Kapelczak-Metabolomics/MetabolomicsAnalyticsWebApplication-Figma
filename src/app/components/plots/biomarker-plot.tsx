import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";

interface BiomarkerPlotProps {
  candidates?: Array<{ name: string; score: number; log2fc: number; pValue: number }>;
}

export function BiomarkerPlot({ candidates = [] }: BiomarkerPlotProps) {
  const top = useMemo(() => candidates.slice(0, 30), [candidates]);

  const plot = useMemo(() => {
    if (!top.length) return null;

    const maxScore = Math.max(...top.map((c) => c.score), 0.01);
    const sizes = top.map((c) => 8 + (c.score / maxScore) * 16);
    const colors = top.map((c) => (c.pValue < 0.05 ? "#059669" : "#94a3b8"));

    const traces: Data[] = [
      {
        type: "scatter",
        mode: "markers",
        x: top.map((c) => c.log2fc),
        y: top.map((c) => c.score),
        text: top.map((c) => c.name),
        marker: { color: colors, size: sizes, opacity: 0.85, line: { color: "#fff", width: 1 } },
        hovertemplate: "%{text}<br>Score: %{y:.3f}<br>log₂FC: %{x:.3f}<extra></extra>",
        showlegend: false,
      },
    ];

    const layout: Partial<Layout> = {
      title: { text: "Biomarker candidates", font: { size: 14 } },
      xaxis: { title: { text: "log₂ fold change" }, zeroline: true },
      yaxis: { title: { text: "Composite biomarker score" } },
    };

    return { traces, layout };
  }, [top]);

  if (!top.length) return <PlotEmpty message="Run biomarker discovery to rank candidates" />;
  if (!plot) return <PlotEmpty message="Unable to render biomarker plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
}
