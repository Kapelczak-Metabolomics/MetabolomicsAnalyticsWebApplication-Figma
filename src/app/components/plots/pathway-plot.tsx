import { formatTick, linearScale, niceTicks } from "./plot-theme";

interface PathwayPlotProps {
  pathways?: Array<{ name: string; genes: number; negLogP?: number; pValue?: number }>;
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function PathwayPlot({ pathways = [] }: PathwayPlotProps) {
  if (!pathways.length) return <PlotEmpty message="Run pathway enrichment to see results" />;

  const width = 680;
  const height = 460;
  const pad = { left: 88, right: 32, top: 36, bottom: 88 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const points = pathways.map((p) => ({
    name: p.name,
    x: p.genes,
    y: p.negLogP ?? -Math.log10(p.pValue ?? 1),
  }));

  const xMax = Math.max(...points.map((p) => p.x), 1) * 1.15;
  const yMax = Math.max(...points.map((p) => p.y), 1) * 1.1;
  const xScale = linearScale([0, xMax], [0, plotW]);
  const yScale = linearScale([0, yMax], [plotH, 0]);
  const xTicks = niceTicks(0, xMax, 5);
  const yTicks = niceTicks(0, yMax, 5);
  const maxY = Math.max(...points.map((p) => p.y), 0.01);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pathway enrichment dot plot">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <g transform={`translate(${pad.left}, ${pad.top})`}>
        {yTicks.map((t) => (
          <line key={`gy-${t}`} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} className="stroke-border/60" strokeWidth={1} />
        ))}
        {xTicks.map((t) => (
          <line key={`gx-${t}`} x1={xScale(t)} y1={0} x2={xScale(t)} y2={plotH} className="stroke-border/60" strokeWidth={1} />
        ))}

        {points.map((p, i) => {
          const r = 6 + (p.y / maxY) * 10;
          return (
            <g key={p.name}>
              <circle cx={xScale(p.x)} cy={yScale(p.y)} r={r} fill="#7c3aed" opacity={0.25} />
              <circle cx={xScale(p.x)} cy={yScale(p.y)} r={r * 0.55} fill="#7c3aed" stroke="white" strokeWidth={1} opacity={0.85}>
                <title>{`${p.name}\nHits: ${p.x}\n-log10 p: ${p.y.toFixed(3)}`}</title>
              </circle>
              <text x={xScale(p.x) + r + 4} y={yScale(p.y) + 4} fontSize={9} className="fill-foreground">
                {p.name.length > 24 ? `${p.name.slice(0, 22)}…` : p.name}
              </text>
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
        <text x={plotW / 2} y={plotH + 40} fontSize={13} fontWeight={500} textAnchor="middle" className="fill-foreground">Feature count in pathway</text>
        <text
          x={-64}
          y={plotH / 2}
          fontSize={13}
          fontWeight={500}
          textAnchor="middle"
          transform={`rotate(-90, -64, ${plotH / 2})`}
          className="fill-foreground"
        >
          −log₁₀ p-value
        </text>
      </g>
      <text x={pad.left} y={22} fontSize={10} className="fill-muted-foreground">Bubble size reflects significance</text>
    </svg>
  );
}
