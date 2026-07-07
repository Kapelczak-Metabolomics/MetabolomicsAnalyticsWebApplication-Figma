import type { Data } from "plotly.js-dist-min";
import { GROUP_COLORS } from "./plot-theme";
import { confidenceEllipse, type Point2D } from "./plot-ellipses";

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

function circlePoints(cx: number, cy: number, radius: number, segments = 72): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    pts.push({ x: cx + radius * Math.cos(t), y: cy + radius * Math.sin(t) });
  }
  return pts;
}

function minRadiusForPoints(points: Point2D[], fallback: number): number {
  if (points.length < 2) return fallback;
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  const maxDist = Math.max(...points.map((p) => Math.hypot(p.x - mx, p.y - my)), fallback * 0.25);
  return Math.max(maxDist * 1.15, fallback * 0.08);
}

function groupRegionPoints(points: Point2D[], plotSpan: number): Point2D[] | null {
  if (!points.length) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;

  if (points.length === 1) {
    return circlePoints(mx, my, plotSpan * 0.06);
  }

  const ellipse = confidenceEllipse(points, 0.95, 120);
  if (!ellipse) return null;

  const minR = minRadiusForPoints(points, plotSpan);
  const cx = ellipse.reduce((s, p) => s + p.x, 0) / ellipse.length;
  const cy = ellipse.reduce((s, p) => s + p.y, 0) / ellipse.length;

  const scaled = ellipse.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < minR && dist > 1e-9) {
      const scale = minR / dist;
      return { x: cx + dx * scale, y: cy + dy * scale };
    }
    if (dist < 1e-9) {
      const angle = Math.atan2(dy || 1, dx || 1);
      return { x: cx + minR * Math.cos(angle), y: cy + minR * Math.sin(angle) };
    }
    return p;
  });

  return scaled;
}

export function buildGroupRegionTrace(
  group: string,
  color: string,
  points: Point2D[],
  plotSpan: number,
): Data | null {
  const region = groupRegionPoints(points, plotSpan);
  if (!region) return null;

  return {
    type: "scatter",
    mode: "lines",
    name: `${group} (95% region)`,
    x: region.map((p) => p.x),
    y: region.map((p) => p.y),
    line: { color, width: 2, shape: "spline", smoothing: 1.3 },
    fill: "toself",
    fillcolor: hexToRgba(color, 0.18),
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
): { traces: Data[]; layoutExtras: Record<string, unknown> } {
  const groups = [...new Set(items.map((i) => i.group))];
  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  const xSpan = Math.max(...xs) - Math.min(...xs) || 1;
  const ySpan = Math.max(...ys) - Math.min(...ys) || 1;
  const plotSpan = Math.max(xSpan, ySpan);

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
      xaxis: { title: { text: options.xLabel }, zeroline: true, zerolinecolor: "#cbd5e1" },
      yaxis: { title: { text: options.yLabel }, zeroline: true, zerolinecolor: "#cbd5e1" },
      legend: { orientation: "v", x: 1.02, y: 1 },
    },
  };
}
