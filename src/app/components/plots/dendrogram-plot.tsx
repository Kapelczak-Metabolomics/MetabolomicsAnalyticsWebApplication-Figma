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
  title?: string;
}

function asIndices(value: number[] | string): number[] {
  if (Array.isArray(value)) return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return [];
}

type TreeNode = {
  leaves: number[];
  height: number;
  left?: TreeNode;
  right?: TreeNode;
  x?: number;
  y?: number;
};

function buildTree(data: DendrogramMerge[], n: number): TreeNode | null {
  const active: TreeNode[] = Array.from({ length: n }, (_, i) => ({ leaves: [i], height: 0 }));

  const sameSet = (a: number[], b: number[]) =>
    a.length === b.length && a.every((v) => b.includes(v));

  for (const merge of data) {
    const leftIdx = asIndices(merge.left);
    const rightIdx = asIndices(merge.right);
    const leftNode = active.find((c) => sameSet(c.leaves, leftIdx));
    const rightNode = active.find((c) => c !== leftNode && sameSet(c.leaves, rightIdx));
    if (!leftNode || !rightNode) continue;

    const parent: TreeNode = {
      leaves: [...leftNode.leaves, ...rightNode.leaves],
      height: Number(merge.height) || 0,
      left: leftNode,
      right: rightNode,
    };
    active.splice(active.indexOf(leftNode), 1);
    active.splice(active.indexOf(rightNode), 1);
    active.push(parent);
  }

  if (!active.length) return null;
  // Prefer the node covering the most leaves as the root.
  return active.reduce((a, b) => (b.leaves.length > a.leaves.length ? b : a));
}

export function DendrogramPlot({ data = [], labels = [], title = "Sample dendrogram" }: DendrogramPlotProps) {
  const plot = useMemo(() => {
    if (!data.length) return null;

    const maxIndex = Math.max(
      ...data.flatMap((d) => [...asIndices(d.left), ...asIndices(d.right)]),
      -1
    );
    const n = Math.max(labels.length, maxIndex + 1);
    if (n < 2) return null;

    const root = buildTree(data, n);
    if (!root) return null;

    // Assign leaf x positions by in-order traversal so branches never cross.
    let leafCursor = 0;
    const leafOrder: number[] = [];
    const assign = (node: TreeNode): void => {
      if (!node.left || !node.right) {
        node.x = (leafCursor + 0.5) / n;
        node.y = 0;
        leafOrder.push(node.leaves[0]);
        leafCursor += 1;
        return;
      }
      assign(node.left);
      assign(node.right);
      node.x = ((node.left.x ?? 0) + (node.right.x ?? 0)) / 2;
      node.y = node.height;
    };
    assign(root);

    const lineX: (number | null)[] = [];
    const lineY: (number | null)[] = [];
    const walk = (node: TreeNode): void => {
      if (!node.left || !node.right) return;
      walk(node.left);
      walk(node.right);
      const top = node.y ?? node.height;
      const lx = node.left.x ?? 0;
      const rx = node.right.x ?? 0;
      const ly = node.left.y ?? 0;
      const ry = node.right.y ?? 0;
      // Each child rises from its own top, then a crossbar joins them.
      lineX.push(lx, lx, null, rx, rx, null, lx, rx, null);
      lineY.push(ly, top, null, ry, top, null, top, top, null);
    };
    walk(root);

    const maxH = Math.max(...data.map((d) => Number(d.height) || 0), 0.01);

    const traces: Data[] = [
      {
        type: "scatter",
        mode: "lines",
        x: lineX,
        y: lineY,
        line: { color: "#6366f1", width: 1.5, shape: "linear" },
        hoverinfo: "skip",
        showlegend: false,
        connectgaps: false,
      },
    ];

    const tickX = leafOrder.map((_, i) => (i + 0.5) / n);
    const tickLabels = leafOrder.map((originalIdx, i) => {
      const label = labels[originalIdx] ?? labels[i] ?? `S${originalIdx + 1}`;
      return label.length > 14 ? `${label.slice(0, 12)}…` : label;
    });

    const layout: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      xaxis: {
        title: { text: "Samples" },
        tickmode: "array",
        tickvals: tickX,
        ticktext: tickLabels,
        tickangle: -45,
        tickfont: { size: 10 },
        range: [0, 1],
        showgrid: false,
        zeroline: false,
      },
      yaxis: {
        title: { text: "Distance" },
        range: [0, maxH * 1.08],
        showgrid: true,
        zeroline: false,
      },
      margin: { l: 56, r: 24, t: 48, b: 96 },
    };

    return { traces, layout };
  }, [data, labels, title]);

  if (!data.length) return <PlotEmpty message="Run clustering to generate dendrogram" />;
  if (!plot) return <PlotEmpty message="Need at least two samples for dendrogram" />;

  return <PlotlyChart data={plot.traces} layout={plot.layout} className="h-full w-full min-h-[260px]" />;
}
