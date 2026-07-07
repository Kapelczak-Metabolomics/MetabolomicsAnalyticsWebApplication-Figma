import { useMemo } from "react";
import type { Data, Layout, Shape } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";

interface PermutationPlotProps {
  scores?: Array<{ iteration: number; r2: number; q2: number }>;
  observedR2?: number;
  observedQ2?: number;
}

export function PermutationPlot({ scores = [], observedR2, observedQ2 }: PermutationPlotProps) {
  const plot = useMemo(() => {
    if (!scores.length) return null;

    const iterations = scores.map((_, i) => i);
    const maxVal = Math.max(...scores.map((s) => Math.max(s.r2, s.q2)), observedR2 ?? 0, observedQ2 ?? 0, 0.1) * 1.1;

    const traces: Data[] = [
      {
        type: "scatter",
        mode: "markers",
        name: "Permuted R²",
        x: iterations,
        y: scores.map((s) => s.r2),
        marker: { color: "#7c3aed", size: 7, opacity: 0.6 },
        hovertemplate: "Iteration %{x}<br>R²: %{y:.3f}<extra></extra>",
      },
      {
        type: "scatter",
        mode: "markers",
        name: "Permuted Q²",
        x: iterations,
        y: scores.map((s) => s.q2),
        marker: { color: "#0891b2", size: 6, opacity: 0.55 },
        hovertemplate: "Iteration %{x}<br>Q²: %{y:.3f}<extra></extra>",
      },
    ];

    const shapes: Partial<Shape>[] = [];
    if (observedR2 != null) {
      shapes.push({ type: "line", x0: 0, x1: iterations.length - 1, y0: observedR2, y1: observedR2, line: { color: "#7c3aed", width: 2, dash: "dash" } });
    }
    if (observedQ2 != null) {
      shapes.push({ type: "line", x0: 0, x1: iterations.length - 1, y0: observedQ2, y1: observedQ2, line: { color: "#0891b2", width: 2, dash: "dash" } });
    }

    const layout: Partial<Layout> = {
      title: { text: "Permutation validation", font: { size: 14 } },
      xaxis: { title: { text: "Permutation iteration" } },
      yaxis: { title: { text: "R² / Q²" }, range: [0, maxVal] },
      shapes,
      annotations: observedR2 != null || observedQ2 != null
        ? [{ x: 0.02, y: 0.98, xref: "paper", yref: "paper", text: "Dashed lines = observed model", showarrow: false, font: { size: 10, color: "#64748b" }, xanchor: "left", yanchor: "top" }]
        : [],
    };

    return { traces, layout };
  }, [scores, observedR2, observedQ2]);

  if (!scores.length) return <PlotEmpty message="Run PLS-DA to generate permutation test" />;
  if (!plot) return <PlotEmpty message="Unable to render permutation plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} className="h-full w-full min-h-[200px]" />;
}
