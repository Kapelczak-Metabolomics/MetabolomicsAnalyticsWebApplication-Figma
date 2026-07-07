import { formatTick, linearScale, niceTicks, paddedDomain } from "./plot-theme";

interface BiomarkerPlotProps {
  candidates?: Array<{ name: string; score: number; log2fc: number; pValue: number }>;
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function BiomarkerPlot({ candidates = [] }: BiomarkerPlotProps) {
  const top = candidates.slice(0, 30);
  if (!top.length) return <PlotEmpty message="Run biomarker discovery to rank candidates" />;

  const width = 640;
  const height = 420;
  const pad = { left: 72, right: 24, top: 24, bottom: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xs = top.map((c) => c.log2fc);
  const ys = top.map((c) => c.score);
  const [xMin, xMax] = paddedDomain(xs);
  const [yMin, yMax] = paddedDomain(ys);
  const xScale = linearScale([xMin, xMax], [0, plotW]);
  const yScale = linearScale([yMin, yMax], [plotH, 0]);
  const xTicks = niceTicks(xMin, xMax, 5);
  const yTicks = niceTicks(yMin, yMax, 5);
  const maxScore = Math.max(...ys, 0.01);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biomarker candidate plot">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <g transform={`translate(${pad.left}, ${pad.top})`}>
        {yTicks.map((t) => (
          <line key={`gy-${t}`} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} className="stroke-border/60" strokeWidth={1} />
        ))}

        {top.map((c, i) => {
          const r = 4 + (c.score / maxScore) * 8;
          const sig = c.pValue < 0.05;
          return (
            <circle key={`${c.name}-${i}`} cx={xScale(c.log2fc)} cy={yScale(c.score)} r={r}
              fill={sig ? "#059669" : "#94a3b8"} stroke="white" strokeWidth={1} opacity={0.85}>
              <title>{`${c.name}\nScore: ${c.score.toFixed(3)}\nlog2FC: ${c.log2fc}\np: ${c.pValue}`}</title>
            </circle>
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
        <text x={plotW / 2} y={plotH + 44} fontSize={13} fontWeight={500} textAnchor="middle" className="fill-foreground">log₂ fold change</text>
        <text x={-plotH / 2} y={-44} fontSize={13} fontWeight={500} textAnchor="middle" transform={`rotate(-90, ${-plotH / 2}, -44)`} className="fill-foreground">Composite biomarker score</text>
      </g>
    </svg>
  );
}
