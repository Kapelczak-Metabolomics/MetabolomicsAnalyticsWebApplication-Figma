import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import type { Config, Data, Layout } from "plotly.js-dist-min";

const Plot = createPlotlyComponent(Plotly);

export const PLOTLY_COLORS = {
  card: "#ffffff",
  foreground: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  grid: "#e2e8f080",
  up: "#ef4444",
  down: "#0ea5e9",
  ns: "#94a3b8",
};

export function basePlotlyLayout(overrides: Partial<Layout> = {}): Partial<Layout> {
  return {
    paper_bgcolor: PLOTLY_COLORS.card,
    plot_bgcolor: "#f8fafc",
    font: { family: "Inter, system-ui, sans-serif", size: 12, color: PLOTLY_COLORS.foreground },
    margin: { l: 64, r: 24, t: 32, b: 64 },
    hovermode: "closest",
    showlegend: true,
    legend: {
      bgcolor: "rgba(255,255,255,0.92)",
      bordercolor: PLOTLY_COLORS.border,
      borderwidth: 1,
      font: { size: 11 },
    },
    xaxis: {
      zerolinecolor: PLOTLY_COLORS.border,
      gridcolor: PLOTLY_COLORS.grid,
      linecolor: PLOTLY_COLORS.border,
      tickfont: { size: 11, color: PLOTLY_COLORS.muted },
      title: { font: { size: 13, color: PLOTLY_COLORS.foreground } },
    },
    yaxis: {
      zerolinecolor: PLOTLY_COLORS.border,
      gridcolor: PLOTLY_COLORS.grid,
      linecolor: PLOTLY_COLORS.border,
      tickfont: { size: 11, color: PLOTLY_COLORS.muted },
      title: { font: { size: 13, color: PLOTLY_COLORS.foreground } },
    },
    ...overrides,
  };
}

export const plotlyConfig: Partial<Config> = {
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
  responsive: true,
  toImageButtonOptions: { format: "png", scale: 2 },
};

interface PlotlyChartProps {
  data: Data[];
  layout: Partial<Layout>;
  className?: string;
  exportId?: string;
}

export function PlotlyChart({ data, layout, className, exportId }: PlotlyChartProps) {
  const mergedLayout = useMemo(() => basePlotlyLayout(layout), [layout]);

  return (
    <div className={className ?? "h-full w-full min-h-[280px]"} data-plotly-export={exportId}>
      <Plot
        data={data}
        layout={mergedLayout}
        config={plotlyConfig}
        useResizeHandler
        style={{ width: "100%", height: "100%", minHeight: 280 }}
      />
    </div>
  );
}

export { Plotly };
