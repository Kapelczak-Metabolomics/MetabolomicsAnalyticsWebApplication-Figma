import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";

interface VIPPlotProps {
  features?: Array<{ name: string; vip: number }>;
  title?: string;
}

export function VIPPlot({ features = [], title = "Variable Importance in Projection" }: VIPPlotProps) {
  const plot = useMemo(() => {
    if (!features.length) return null;

    const sorted = [...features].sort((a, b) => a.vip - b.vip);
    const names = sorted.map((f) => f.name);
    const values = sorted.map((f) => f.vip);
    const colors = values.map((v) => (v >= 1 ? "#6366f1" : "#94a3b8"));

    const traces: Data[] = [
      {
        type: "bar",
        orientation: "h",
        y: names,
        x: values,
        marker: { color: colors, opacity: 0.92 },
        hovertemplate: "%{y}<br>VIP: %{x:.3f}<extra></extra>",
      },
    ];

    const layout: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: { title: { text: "VIP score" }, zeroline: true },
      yaxis: { automargin: true },
      shapes: [
        {
          type: "line",
          x0: 1,
          x1: 1,
          y0: 0,
          y1: 1,
          yref: "paper",
          line: { color: "#ef4444", width: 2, dash: "dash" },
        },
      ],
      annotations: [
        { x: 1, y: 1, xref: "x", yref: "paper", text: "VIP = 1.0", showarrow: false, xanchor: "left", yanchor: "bottom", font: { size: 10, color: "#ef4444" } },
      ],
      margin: { l: 140, r: 40, t: 48, b: 48 },
      height: Math.max(240, names.length * 28 + 80),
    };

    return { traces, layout };
  }, [features, title]);

  if (!features.length) return <PlotEmpty message="Run PLS-DA to generate VIP scores" />;
  if (!plot) return <PlotEmpty message="Unable to render VIP plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} className="h-full w-full min-h-[200px]" />;
}
