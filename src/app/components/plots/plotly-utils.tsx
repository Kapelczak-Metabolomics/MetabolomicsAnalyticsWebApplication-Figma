import type { Data, Layout } from "plotly.js-dist-min";
import { GROUP_COLORS } from "./plot-theme";
import { groupConfidenceCircle, type Point2D } from "./plot-ellipses";

export function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function buildGroupRegionTrace(
  group: string,
  color: string,
  points: Point2D[],
  plotSpan: number,
): Data | null {
  const region = groupConfidenceCircle(points, plotSpan);
  if (!region) return null;

  return {
    type: "scatter",
    mode: "lines",
    name: `${group} (95% region)`,
    x: region.map((p) => p.x),
    y: region.map((p) => p.y),
    line: { color, width: 2, shape: "linear" },
    fill: "toself",
    fillcolor: hexToRgba(color, 0.2),
    hoverinfo: "skip",
    showlegend: false,
  };
}

export function buildGroupedScatterTraces(
  items: Array<{ x: number; y: number; group: string; label: string }>,
  options: {
    xLabel: string;
    yLabel: string;
    showGroupRegions?: boolean;
    title?: string;
  },
): { traces: Data[]; layoutExtras: Partial<Layout> } {
  const groups = [...new Set(items.map((i) => i.group))];
  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  const xSpan = Math.max(...xs) - Math.min(...xs) || 1;
  const ySpan = Math.max(...ys) - Math.min(...ys) || 1;
  const plotSpan = Math.max(xSpan, ySpan, 0.01);

  const traces: Data[] = [];

  groups.forEach((group, gi) => {
    const color = GROUP_COLORS[gi % GROUP_COLORS.length];
    const groupItems = items.filter((i) => i.group === group);
    const pts = groupItems.map((i) => ({ x: i.x, y: i.y }));

    if (options.showGroupRegions !== false && groupItems.length >= 1) {
      const region = buildGroupRegionTrace(group, color, pts, plotSpan);
      if (region) traces.push(region);
    }

    traces.push({
      type: "scatter",
      mode: "markers",
      name: `${group} (n=${groupItems.length})`,
      x: groupItems.map((i) => i.x),
      y: groupItems.map((i) => i.y),
      text: groupItems.map((i) => i.label),
      hovertemplate: "%{text}<br>" + group + "<br>" + options.xLabel + ": %{x:.3f}<br>" + options.yLabel + ": %{y:.3f}<extra></extra>",
      marker: { color, size: 11, opacity: 0.92, line: { color: "#fff", width: 1.5 } },
    });
  });

  return {
    traces,
    layoutExtras: {
      title: options.title ? { text: options.title, font: { size: 14 } } : undefined,
      xaxis: { title: { text: options.xLabel }, zeroline: true, zerolinecolor: "#cbd5e1", scaleanchor: "y", scaleratio: 1 },
      yaxis: { title: { text: options.yLabel }, zeroline: true, zerolinecolor: "#cbd5e1" },
      legend: { orientation: "v", x: 1.02, y: 1 },
    },
  };
}
