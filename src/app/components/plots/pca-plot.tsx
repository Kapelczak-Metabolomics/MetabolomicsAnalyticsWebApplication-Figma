import { GROUP_COLORS, PLOT_PAD, PLOT_SIZE, Y_AXIS_LABEL_X, formatTick, groupColor, linearScale, niceTicks, paddedDomain } from "./plot-theme";

export interface PCAScore {
  sampleId: string;
  group: string;
  PC1: number;
  PC2: number;
}

interface PCAPlotProps {
  scores?: PCAScore[];
  explainedVariance?: number[];
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function PCAPlot({ scores = [], explainedVariance = [] }: PCAPlotProps) {
  if (!scores.length) return <PlotEmpty message="Run analysis to generate PCA scores from your dataset" />;

  const { width, height } = PLOT_SIZE;
  const pad = PLOT_PAD;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const groups = [...new Set(scores.map((s) => s.group))];
  const xs = scores.map((s) => s.PC1);
  const ys = scores.map((s) => s.PC2);
  const [xMin, xMax] = paddedDomain(xs);
  const [yMin, yMax] = paddedDomain(ys);
  const xScale = linearScale([xMin, xMax], [0, plotW]);
  const yScale = linearScale([yMin, yMax], [plotH, 0]);
  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(yMin, yMax, 5);

  const pc1Var = explainedVariance[0] ?? 0;
  const pc2Var = explainedVariance[1] ?? 0;
  const zeroX = xScale(0);
  const zeroY = yScale(0);
  const showZeroX = zeroX >= 0 && zeroX <= plotW;
  const showZeroY = zeroY >= 0 && zeroY <= plotH;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="PCA score plot">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <g transform={`translate(${pad.left}, ${pad.top})`}>
        <rect x={0} y={0} width={plotW} height={plotH} rx={6} className="fill-muted/20 stroke-border/50" strokeWidth={1} />
        {yTicks.map((t) => (
          <line key={`gy-${t}`} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} className="stroke-border/60" strokeWidth={1} />
        ))}
        {xTicks.map((t) => (
          <line key={`gx-${t}`} x1={xScale(t)} y1={0} x2={xScale(t)} y2={plotH} className="stroke-border/60" strokeWidth={1} />
        ))}
        {showZeroX && <line x1={zeroX} y1={0} x2={zeroX} y2={plotH} className="stroke-muted-foreground/40" strokeDasharray="4 4" />}
        {showZeroY && <line x1={0} y1={zeroY} x2={plotW} y2={zeroY} className="stroke-muted-foreground/40" strokeDasharray="4 4" />}

        {scores.map((d, i) => {
          const gi = groups.indexOf(d.group);
          const color = groupColor(gi);
          const cx = xScale(d.PC1);
          const cy = yScale(d.PC2);
          return (
            <g key={`${d.sampleId}-${i}`}>
              <circle cx={cx} cy={cy} r={10} fill={color} opacity={0.12} />
              <circle cx={cx} cy={cy} r={5.5} fill={color} stroke="white" strokeWidth={1.5} opacity={0.95}>
                <title>{`${d.sampleId} (${d.group})\nPC1: ${d.PC1}\nPC2: ${d.PC2}`}</title>
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
        <text x={plotW / 2} y={plotH + 40} fontSize={13} fontWeight={500} textAnchor="middle" className="fill-foreground">
          PC1 ({pc1Var}% variance)
        </text>
        <text
          x={Y_AXIS_LABEL_X}
          y={plotH / 2}
          fontSize={13}
          fontWeight={500}
          textAnchor="middle"
          transform={`rotate(-90, ${Y_AXIS_LABEL_X}, ${plotH / 2})`}
          className="fill-foreground"
        >
          PC2 ({pc2Var}% variance)
        </text>
      </g>

      <g transform={`translate(${width - pad.right + 12}, ${pad.top})`}>
        <rect x={0} y={0} width={136} height={28 + groups.length * 24} className="fill-card/95 stroke-border" strokeWidth={1} rx={8} />
        <text x={10} y={16} fontSize={10} fontWeight={600} className="fill-muted-foreground">Groups</text>
        {groups.map((g, i) => (
          <g key={g} transform={`translate(10, ${20 + i * 22})`}>
            <circle cx={6} cy={8} r={5} fill={GROUP_COLORS[i % GROUP_COLORS.length]} />
            <text x={18} y={12} fontSize={11} className="fill-foreground">
              {g} (n={scores.filter((s) => s.group === g).length})
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
