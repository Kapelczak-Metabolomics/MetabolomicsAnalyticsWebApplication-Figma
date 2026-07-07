import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";
import { PlotEmpty } from "./plotly-utils";

export interface DendrogramMerge {
  left: number[] | string;
  right: number[] | string;
  height: number;
}

interface DendrogramPlotProps {
  data?: DendrogramMerge[];
  labels?: string[];
  height?: number;
}

function asIndices(value: number[] | string): number[] {
  if (Array.isArray(value)) return value;
  return [];
}

export function DendrogramPlot({ data = [], labels = [], height = 280 }: DendrogramPlotProps) {
  const plot = useMemo(() => {
    if (!data.length) return null;

    const n = labels.length || Math.max(...data.flatMap((d) => [...asIndices(d.left), ...asIndices(d.right)]), -1) + 1;
    if (n < 2) return null;

    const plotH = height - 72;
    const maxH = Math.max(...data.map((d) => d.height), 0.01);

    type Cluster = { indices: number[]; x: number; top: number };
    let clusters: Cluster[] = Array.from({ length: n }, (_, i) => ({
      indices: [i],
      x: (i + 0.5) / n,
      top: 0,
    }));

    const lineX: number[] = [];
    const lineY: number[] = [];

    for (const merge of data) {
      const leftIdx = asIndices(merge.left);
      const rightIdx = asIndices(merge.right);
      const leftCluster = clusters.find((c) => c.indices.length === leftIdx.length && leftIdx.every((v) => c.indices.includes(v)));
      const rightCluster = clusters.find((c) => c !== leftCluster && c.indices.length === rightIdx.length && rightIdx.every((v) => c.indices.includes(v)));
      if (!leftCluster || !rightCluster) continue;

      const lx = leftCluster.x;
      const rx = rightCluster.x;
      const y0 = Math.max(leftCluster.top, rightCluster.top);
      const y1 = merge.height;

      lineX.push(lx, lx, null, rx, rx, null, lx, rx, null);
      lineY.push(y0, y1, null, y0, y1, null, y1, y1, null);

      clusters = clusters.filter((c) => c !== leftCluster && c !== rightCluster);
      clusters.push({
        indices: [...leftCluster.indices, ...rightCluster.indices],
        x: (leftCluster.x + rightCluster.x) / 2,
        top: merge.height,
      });
    }

    const traces: Data[] = [
      {
        type: "scatter",
        mode: "lines",
        x: lineX,
        y: lineY,
        line: { color: "#64748b", width: 1.5 },
        hoverinfo: "skip",
        showlegend: false,
      },
    ];

    const tickLabels = Array.from({ length: n }, (_, i) => labels[i] ?? `S${i + 1}`);
    const tickX = Array.from({ length: n }, (_, i) => (i + 0.5) / n);

    const layout: Partial<Layout> = {
      title: { text: "Sample dendrogram", font: { size: 14 } },
      xaxis: {
        title: { text: "Samples" },
        tickmode: "array",
        tickvals: tickX,
        ticktext: tickLabels.map((l) => (l.length > 14 ? `${l.slice(0, 12)}…` : l)),
        tickangle: -45,
        range: [0, 1],
        showgrid: false,
      },
      yaxis: {
        title: { text: "Distance" },
        range: [0, maxH * 1.05],
        showgrid: true,
      },
      height,
      margin: { l: 56, r: 24, t: 48, b: 100 },
    };

    return { traces, layout };
  }, [data, labels, height]);

  if (!data.length) return <PlotEmpty message="Run clustering to generate dendrogram" />;
  if (!plot) return <PlotEmpty message="Need at least two samples for dendrogram" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} className="h-full w-full min-h-[200px]" />;
}
