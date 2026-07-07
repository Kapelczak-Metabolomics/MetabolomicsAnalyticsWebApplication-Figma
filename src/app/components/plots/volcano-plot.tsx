import { PLOT_PAD, PLOT_SIZE, Y_AXIS_LABEL_X, formatTick, linearScale, niceTicks, symmetricDomain } from "./plot-theme";

export interface VolcanoPoint {
  log2fc: number;
  negLogP: number;
  pValue: number;
  name?: string;
}

interface VolcanoPlotProps {
  features?: VolcanoPoint[];
  pThreshold?: number;
  fcThreshold?: number;
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function VolcanoPlot({ features = [], pThreshold = 0.05, fcThreshold = 0.5 }: VolcanoPlotProps) {
  if (!features.length) return <PlotEmpty message="Run analysis to generate volcano plot from your dataset" />;

  const { width, height } = PLOT_SIZE;
  const pad = { ...PLOT_PAD, right: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const points = features.map((f) => ({
    x: f.log2fc,
    y: f.negLogP,
    name: f.name,
    significant: f.pValue < pThreshold && Math.abs(f.log2fc) > fcThreshold,
    direction: f.pValue < pThreshold ? (f.log2fc > 0 ? "up" as const : "down" as const) : "none" as const,
  }));

  const up = points.filter((p) => p.significant && p.direction === "up").length;
  const down = points.filter((p) => p.significant && p.direction === "down").length;
  const [xMin, xMax] = symmetricDomain(points.map((p) => p.x));
  const yMax = Math.max(...points.map((p) => p.y), -Math.log10(pThreshold), 1) * 1.08;
  const xScale = linearScale([xMin, xMax], [0, plotW]);
  const yScale = linearScale([0, yMax], [plotH, 0]);
  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(0, yMax, 5);
  const pLine = -Math.log10(pThreshold);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Volcano plot">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <g transform={`translate(${pad.left}, ${pad.top})`}>
        <rect x={0} y={0} width={plotW} height={plotH} rx={6} className="fill-muted/15 stroke-border/50" strokeWidth={1} />
        {yTicks.map((t) => (
          <line key={`gy-${t}`} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} className="stroke-border/60" strokeWidth={1} />
        ))}

        <line x1={xScale(-fcThreshold)} y1={0} x2={xScale(-fcThreshold)} y2={plotH} stroke="#0891b2" strokeOpacity={0.35} strokeDasharray="5 4" strokeWidth={1.5} />
        <line x1={xScale(fcThreshold)} y1={0} x2={xScale(fcThreshold)} y2={plotH} stroke="#dc2626" strokeOpacity={0.35} strokeDasharray="5 4" strokeWidth={1.5} />
        <line x1={0} y1={yScale(pLine)} x2={plotW} y2={yScale(pLine)} className="stroke-muted-foreground/50" strokeDasharray="5 4" strokeWidth={1.5} />

        {points.filter((p) => !p.significant).map((d, i) => (
          <circle key={`ns-${i}`} cx={xScale(d.x)} cy={yScale(d.y)} r={3} className="fill-muted-foreground" opacity={0.35}>
            {d.name && <title>{`${d.name}\nlog2FC: ${d.x}\n-log10 p: ${d.y}`}</title>}
          </circle>
        ))}
        {points.filter((p) => p.significant).map((d, i) => (
          <circle key={`sig-${i}`} cx={xScale(d.x)} cy={yScale(d.y)} r={5} fill={d.direction === "up" ? "#ef4444" : "#0ea5e9"} stroke="white" strokeWidth={1.25} opacity={0.9}>
            {d.name && <title>{`${d.name}\nlog2FC: ${d.x}\n-log10 p: ${d.y}`}</title>}
          </circle>
        ))}

        <line x1={0} y1={plotH} x2={plotW} y2={plotH} className="stroke-foreground/80" strokeWidth={1.5} />
        <line x1={xScale(0)} y1={0} x2={xScale(0)} y2={plotH} className="stroke-foreground/80" strokeWidth={1.5} />
        {xTicks.map((t) => (
          <text key={`tx-${t}`} x={xScale(t)} y={plotH + 18} fontSize={11} textAnchor="middle" className="fill-muted-foreground">{formatTick(t)}</text>
        ))}
        {yTicks.map((t) => (
          <text key={`ty-${t}`} x={-10} y={yScale(t) + 4} fontSize={11} textAnchor="end" className="fill-muted-foreground">{formatTick(t)}</text>
        ))}
        <text x={plotW / 2} y={plotH + 40} fontSize={13} fontWeight={500} textAnchor="middle" className="fill-foreground">log₂ fold change</text>
        <text
          x={Y_AXIS_LABEL_X}
          y={plotH / 2}
          fontSize={13}
          fontWeight={500}
          textAnchor="middle"
          transform={`rotate(-90, ${Y_AXIS_LABEL_X}, ${plotH / 2})`}
          className="fill-foreground"
        >
          −log₁₀ p-value
        </text>
      </g>

      <g transform={`translate(${width - 156}, ${pad.top + 8})`}>
        <rect x={0} y={0} width={132} height={88} className="fill-card stroke-border" strokeWidth={1} rx={6} />
        <circle cx={12} cy={18} r={4} fill="#dc2626" />
        <text x={22} y={22} fontSize={10} className="fill-foreground">Upregulated ({up})</text>
        <circle cx={12} cy={38} r={4} fill="#0891b2" />
        <text x={22} y={42} fontSize={10} className="fill-foreground">Downregulated ({down})</text>
        <circle cx={12} cy={58} r={2.5} className="fill-muted-foreground" opacity={0.4} />
        <text x={22} y={62} fontSize={10} className="fill-foreground">Not significant</text>
        <text x={10} y={80} fontSize={9} className="fill-muted-foreground">p &lt; {pThreshold}, |FC| &gt; {fcThreshold}</text>
      </g>
    </svg>
  );
}
