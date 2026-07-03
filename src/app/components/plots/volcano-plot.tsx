export interface VolcanoPoint {
  log2fc: number;
  negLogP: number;
  pValue: number;
  name?: string;
}

interface VolcanoPlotProps {
  features?: VolcanoPoint[];
}

export function VolcanoPlot({ features = [] }: VolcanoPlotProps) {
  const width = 600;
  const height = 450;
  const padding = { left: 60, right: 40, top: 40, bottom: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (!features.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Run analysis to generate volcano plot from your dataset
      </div>
    );
  }

  const points = features.map((f) => ({
    x: f.log2fc,
    y: f.negLogP,
    significant: f.pValue < 0.05 && Math.abs(f.log2fc) > 0.5,
    direction: f.pValue < 0.05 ? (f.log2fc > 0 ? "up" as const : "down" as const) : "none" as const,
  }));

  const up = points.filter((p) => p.significant && p.direction === "up").length;
  const down = points.filter((p) => p.significant && p.direction === "down").length;

  const xs = points.map((p) => p.x);
  const xPad = Math.max(0.5, (Math.max(...xs.map(Math.abs)) || 1) * 0.1);
  const xMin = Math.min(...xs, -xPad) - xPad;
  const xMax = Math.max(...xs, xPad) + xPad;
  const yMax = Math.max(...points.map((p) => p.y), 1) * 1.1;

  const xScale = (v: number) => ((v - xMin) / (xMax - xMin || 1)) * plotWidth;
  const yScale = (v: number) => plotHeight - (v / yMax) * plotHeight;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        <line x1={xScale(-0.5)} y1={0} x2={xScale(-0.5)} y2={plotHeight} strokeDasharray="4 4" className="stroke-blue-500/50" strokeWidth="1.5" />
        <line x1={xScale(0.5)} y1={0} x2={xScale(0.5)} y2={plotHeight} strokeDasharray="4 4" className="stroke-rose-500/50" strokeWidth="1.5" />
        <line x1={0} y1={yScale(-Math.log10(0.05))} x2={plotWidth} y2={yScale(-Math.log10(0.05))} strokeDasharray="4 4" className="stroke-muted-foreground/50" strokeWidth="1.5" />
        {points.filter((p) => !p.significant).map((d, i) => (
          <circle key={`ns-${i}`} cx={xScale(d.x)} cy={yScale(d.y)} r="2.5" className="fill-muted-foreground" opacity="0.4" />
        ))}
        {points.filter((p) => p.significant).map((d, i) => (
          <circle key={`sig-${i}`} cx={xScale(d.x)} cy={yScale(d.y)} r="3" className={d.direction === "up" ? "fill-rose-500" : "fill-blue-500"} opacity="0.75" />
        ))}
        <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} className="stroke-foreground" strokeWidth="2" />
        <line x1={xScale(0)} y1={0} x2={xScale(0)} y2={plotHeight} className="stroke-foreground" strokeWidth="2" />
        <text x={plotWidth / 2} y={plotHeight + 45} fontSize="13" textAnchor="middle" className="fill-foreground">log₂ Fold Change</text>
        <text x={-plotHeight / 2} y={-40} fontSize="13" textAnchor="middle" transform={`rotate(-90, ${-plotHeight / 2}, -40)`} className="fill-foreground">-log₁₀ p-value</text>
      </g>
      <g transform={`translate(${width - padding.right - 120}, ${padding.top + 20})`}>
        <rect x={-10} y={-10} width={130} height={75} className="fill-background stroke-border" strokeWidth="1" rx="4" />
        <circle cx={5} cy={10} r="3.5" className="fill-rose-500" />
        <text x={15} y={13} fontSize="10" className="fill-foreground">Upregulated ({up})</text>
        <circle cx={5} cy={30} r="3.5" className="fill-blue-500" />
        <text x={15} y={33} fontSize="10" className="fill-foreground">Downregulated ({down})</text>
        <circle cx={5} cy={50} r="2.5" className="fill-muted-foreground" opacity="0.4" />
        <text x={15} y={53} fontSize="10" className="fill-foreground">Not significant</text>
      </g>
    </svg>
  );
}
