import { useMemo } from "react";
import type { Data, Layout } from "plotly.js-dist-min";
import { PlotlyChart } from "./plotly-chart";

const TRACE_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#14b8a6",
  "#f97316",
];

export interface XicTrace {
  sampleId: string;
  groupLabel?: string;
  filename?: string;
  rt: number[];
  intensity: number[];
}

interface XicPlotProps {
  metaboliteName: string;
  mz: number;
  mzTolerance?: number;
  traces: XicTrace[];
  className?: string;
}

export function XicPlot({ metaboliteName, mz, mzTolerance, traces, className }: XicPlotProps) {
  const data = useMemo<Data[]>(
    () =>
      traces.map((trace, index) => ({
        type: "scatter",
        mode: "lines",
        name: trace.groupLabel ? `${trace.sampleId} (${trace.groupLabel})` : trace.sampleId,
        x: trace.rt,
        y: trace.intensity,
        line: { width: 2, color: TRACE_COLORS[index % TRACE_COLORS.length] },
        hovertemplate: "RT %{x:.3f} min<br>Intensity %{y:.2g}<extra>%{fullData.name}</extra>",
      })),
    [traces]
  );

  const layout = useMemo<Partial<Layout>>(
    () => ({
      title: {
        text: `${metaboliteName}<br><sup style="font-size:11px;color:#64748b">m/z ${mz}${mzTolerance != null ? ` ± ${mzTolerance}` : ""}</sup>`,
        font: { size: 14 },
      },
      xaxis: { title: { text: "Retention time (min)" } },
      yaxis: { title: { text: "Extracted ion intensity" } },
      legend: { orientation: "h", y: -0.2 },
      margin: { l: 64, r: 24, t: 72, b: 88 },
    }),
    [metaboliteName, mz, mzTolerance]
  );

  if (!traces.length) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground ${className ?? "h-[320px]"}`}>
        No chromatogram data available.
      </div>
    );
  }

  return <PlotlyChart data={data} layout={layout} className={className ?? "h-[360px] w-full"} exportId="xic-plot" />;
}
