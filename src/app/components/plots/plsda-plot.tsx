import { GROUP_COLORS, PLOT_PAD, PLOT_SIZE, formatTick, groupColor, linearScale, niceTicks, paddedDomain } from "./plot-theme";

interface PLSDAPlotProps {
  scores?: Array<{ comp1: number; comp2: number; group: string; sampleId?: string }>;
  explainedVariance?: number[];
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function PLSDAPlot({ scores = [], explainedVariance = [] }: PLSDAPlotProps) {
  if (!scores.length) return <PlotEmpty message="Run PLS-DA to generate scores" />;

  const { width, height } = PLOT_SIZE;
  const pad = PLOT_PAD;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const groups = [...new Set(scores.map((s) => s.group))];
  const xs = scores.map((s) => s.comp1);
  const ys = scores.map((s) => s.comp2);
  const [xMin, xMax] = paddedDomain(xs);
  const [yMin, yMax] = paddedDomain(ys);
  const xScale = linearScale([xMin, xMax], [0, plotW]);
  const yScale = linearScale([yMin, yMax], [plotH, 0]);
  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(yMin, yMax, 5);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="PLS-DA score plot">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <g transform={`translate(${pad.left}, ${pad.top})`}>
        {yTicks.map((t) => (
          <line key={`gy-${t}`} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} className="stroke-border/60" strokeWidth={1} />
        ))}
        {xTicks.map((t) => (
          <line key={`gx-${t}`} x1={xScale(t)} y1={0} x2={xScale(t)} y2={plotH} className="stroke-border/60" strokeWidth={1} />
        ))}

        {scores.map((d, i) => {
          const gi = groups.indexOf(d.group);
          const color = groupColor(gi);
          return (
            <g key={i}>
              <circle cx={xScale(d.comp1)} cy={yScale(d.comp2)} r={7} fill={color} opacity={0.15} />
              <circle cx={xScale(d.comp1)} cy={yScale(d.comp2)} r={4.5} fill={color} stroke="white" strokeWidth={1.25} opacity={0.9}>
                <title>{`${d.sampleId ?? `Sample ${i + 1}`} (${d.group})`}</title>
              </circle>
            </g>
          );
        })}

        <line x1={0} y1={plotH} x2={plotW} y2={plotH} className="stroke-foreground/80" strokeWidth={1.5} />
        <line x1={0} y1={0} x2={0} y2={plotH} className="stroke-foreground/80" strokeWidth={1.5} />
        {xTicks.map((t) => (
          <text key={`tx-${t}`} x={xScale(t)} y={plotH + 18} fontSize={11} textAnchor="middle" className="fill-muted-foreground">{formatTick(t)}</text>
        ))}
        {yTicks.map((t) => (
          <text key={`ty-${t}`} x={-10} y={yScale(t) + 4} fontSize={11} textAnchor="end" className="fill-muted-foreground">{formatTick(t)}</text>
        ))}
        <text x={plotW / 2} y={plotH + 48} fontSize={13} fontWeight={500} textAnchor="middle" className="fill-foreground">
          Component 1{explainedVariance[0] != null ? ` (${explainedVariance[0]}%)` : ""}
        </text>
        <text x={-plotH / 2} y={-48} fontSize={13} fontWeight={500} textAnchor="middle" transform={`rotate(-90, ${-plotH / 2}, -48)`} className="fill-foreground">
          Component 2{explainedVariance[1] != null ? ` (${explainedVariance[1]}%)` : ""}
        </text>
      </g>

      <g transform={`translate(${width - pad.right + 8}, ${pad.top})`}>
        <rect x={0} y={0} width={120} height={24 + groups.length * 22} className="fill-card stroke-border" strokeWidth={1} rx={6} />
        <text x={10} y={16} fontSize={10} fontWeight={600} className="fill-muted-foreground">Classes</text>
        {groups.map((g, i) => (
          <g key={g} transform={`translate(10, ${20 + i * 22})`}>
            <circle cx={6} cy={8} r={5} fill={GROUP_COLORS[i % GROUP_COLORS.length]} />
            <text x={18} y={12} fontSize={11} className="fill-foreground">{g}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
