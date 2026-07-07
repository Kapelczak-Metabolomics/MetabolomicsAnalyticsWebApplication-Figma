import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { GROUP_COLORS } from "./plot-theme";
import { confidenceEllipse } from "./plot-ellipses";
import { PlotlyChart } from "./plotly-chart";

export interface PCAScore {
  sampleId: string;
  group: string;
  PC1: number;
  PC2: number;
}

interface PCAPlotProps {
  scores?: PCAScore[];
  explainedVariance?: number[];
  showGroupEllipses?: boolean;
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function PCAPlot({
  scores = [],
  explainedVariance = [],
  showGroupEllipses = true,
}: PCAPlotProps) {
  const plot = useMemo(() => {
    if (!scores.length) return null;

    const groups = [...new Set(scores.map((s) => s.group))];
    const pc1Var = explainedVariance[0] ?? 0;
    const pc2Var = explainedVariance[1] ?? 0;
    const traces: Data[] = [];

    groups.forEach((group, gi) => {
      const color = GROUP_COLORS[gi % GROUP_COLORS.length];
      const groupScores = scores.filter((s) => s.group === group);

      if (showGroupEllipses && groupScores.length >= 2) {
        const ellipse = confidenceEllipse(
          groupScores.map((s) => ({ x: s.PC1, y: s.PC2 })),
          0.95,
        );
        if (ellipse) {
          traces.push({
            type: "scatter",
            mode: "lines",
            name: `${group} (95% CI)`,
            x: ellipse.map((p) => p.x),
            y: ellipse.map((p) => p.y),
            line: { color, width: 2 },
            fill: "toself",
            fillcolor: `${color}22`,
            hoverinfo: "skip",
            showlegend: false,
          });
        }
      }

      traces.push({
        type: "scatter",
        mode: "markers",
        name: `${group} (n=${groupScores.length})`,
        x: groupScores.map((s) => s.PC1),
        y: groupScores.map((s) => s.PC2),
        text: groupScores.map((s) => s.sampleId),
        hovertemplate: "%{text}<br>Group: " + group + "<br>PC1: %{x:.3f}<br>PC2: %{y:.3f}<extra></extra>",
        marker: {
          color,
          size: 11,
          opacity: 0.92,
          line: { color: "#fff", width: 1.5 },
        },
      });
    });

    const layout: Partial<Layout> = {
      title: { text: "PCA score plot", font: { size: 14 } },
      xaxis: {
        title: { text: `PC1 (${pc1Var}% variance)` },
        zeroline: true,
        zerolinecolor: "#cbd5e1",
      },
      yaxis: {
        title: { text: `PC2 (${pc2Var}% variance)` },
        zeroline: true,
        zerolinecolor: "#cbd5e1",
      },
      legend: { orientation: "v", x: 1.02, y: 1 },
    };

    return { traces, layout };
  }, [scores, explainedVariance, showGroupEllipses]);

  if (!scores.length) return <PlotEmpty message="Run analysis to generate PCA scores from your dataset" />;
  if (!plot) return <PlotEmpty message="Unable to render PCA plot" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} />;
}
