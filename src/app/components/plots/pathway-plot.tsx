import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";

interface PathwayPlotProps {
  pathways?: Array<{ name: string; genes: number; negLogP?: number; pValue?: number }>;
}

const MAX_PATHWAYS = 25;
const LABEL_MAX = 72;

function truncateLabel(name: string, max = LABEL_MAX): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function PathwayPlot({ pathways = [] }: PathwayPlotProps) {
  const plot = useMemo(() => {
    if (!pathways.length) return null;

    const ranked = [...pathways]
      .map((p) => ({
        name: p.name,
        genes: p.genes,
        negLogP: p.negLogP ?? -Math.log10(Math.max(p.pValue ?? 1, 1e-16)),
        pValue: p.pValue ?? 1,
      }))
      .sort((a, b) => b.negLogP - a.negLogP || b.genes - a.genes)
      .slice(0, MAX_PATHWAYS);

    // Plotly puts the first y category at the bottom — reverse so top hits appear at the top.
    const display = [...ranked].reverse();

    const labels = display.map((p) => truncateLabel(p.name));
    const maxNegLogP = Math.max(...display.map((p) => p.negLogP), 0.01);

    const traces: Data[] = [
      {
        type: "scatter",
        mode: "markers",
        x: display.map((p) => p.genes),
        y: labels,
        customdata: display.map((p) => [p.name, p.negLogP, p.pValue]),
        hovertemplate: "<b>%{customdata[0]}</b><br>Hits: %{x}<br>−log₁₀ p: %{customdata[1]:.3f}<br>p: %{customdata[2]:.2e}<extra></extra>",
        marker: {
          size: display.map((p) => 11 + (p.negLogP / maxNegLogP) * 16),
          color: display.map((p) => p.negLogP),
          colorscale: [
            [0, "#ddd6fe"],
            [0.45, "#a78bfa"],
            [1, "#6d28d9"],
          ],
          cmin: 0,
          cmax: maxNegLogP,
          line: { color: "#fff", width: 1 },
          colorbar: {
            title: { text: "−log₁₀ p", side: "right" },
            thickness: 12,
            len: 0.7,
          },
        },
        showlegend: false,
      },
    ];

    const layout: Partial<Layout> = {
      title: { text: "Pathway enrichment", font: { size: 14 } },
      xaxis: {
        title: { text: "Feature count in pathway" },
        rangemode: "tozero",
        gridcolor: "#e2e8f040",
      },
      yaxis: {
        automargin: true,
        tickfont: { size: 11 },
        gridcolor: "#e2e8f040",
      },
      margin: { l: 12, r: 72, t: 48, b: 56 },
      height: Math.max(320, display.length * 30 + 120),
      annotations: ranked.length >= MAX_PATHWAYS
        ? [{
            x: 0.98,
            y: 0.02,
            xref: "paper",
            yref: "paper",
            text: `Top ${MAX_PATHWAYS} pathways by significance`,
            showarrow: false,
            font: { size: 10, color: "#64748b" },
            xanchor: "right",
            yanchor: "bottom",
          }]
        : [],
    };

    return { traces, layout };
  }, [pathways]);

  if (!pathways.length) return <PlotEmpty message="Run pathway enrichment to see results" />;
  if (!plot) return <PlotEmpty message="Unable to render pathway plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
}
