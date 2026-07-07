import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";

interface PathwayPlotProps {
  pathways?: Array<{ name: string; genes: number; negLogP?: number; pValue?: number }>;
}

export function PathwayPlot({ pathways = [] }: PathwayPlotProps) {
  const plot = useMemo(() => {
    if (!pathways.length) return null;

    const points = pathways.map((p) => ({
      name: p.name,
      x: p.genes,
      y: p.negLogP ?? -Math.log10(p.pValue ?? 1),
    }));
    const maxY = Math.max(...points.map((p) => p.y), 0.01);
    const sizes = points.map((p) => 12 + (p.y / maxY) * 28);

    const traces: Data[] = [
      {
        type: "scatter",
        mode: "markers+text",
        x: points.map((p) => p.x),
        y: points.map((p) => p.y),
        text: points.map((p) => p.name),
        textposition: "middle right",
        textfont: { size: 9 },
        marker: {
          color: "#7c3aed",
          size: sizes,
          opacity: 0.75,
          line: { color: "#fff", width: 1 },
        },
        hovertemplate: "%{text}<br>Hits: %{x}<br>−log₁₀ p: %{y:.3f}<extra></extra>",
        showlegend: false,
      },
    ];

    const layout: Partial<Layout> = {
      title: { text: "Pathway enrichment", font: { size: 14 } },
      xaxis: { title: { text: "Feature count in pathway" }, rangemode: "tozero" },
      yaxis: { title: { text: "−log₁₀ p-value" }, rangemode: "tozero" },
      annotations: [
        { x: 0.02, y: 0.98, xref: "paper", yref: "paper", text: "Bubble size reflects significance", showarrow: false, font: { size: 10, color: "#64748b" }, xanchor: "left", yanchor: "top" },
      ],
    };

    return { traces, layout };
  }, [pathways]);

  if (!pathways.length) return <PlotEmpty message="Run pathway enrichment to see results" />;
  if (!plot) return <PlotEmpty message="Unable to render pathway plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
}
