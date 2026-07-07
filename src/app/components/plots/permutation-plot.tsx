import { formatTick, linearScale, niceTicks } from "./plot-theme";

interface PermutationPlotProps {
  scores?: Array<{ iteration: number; r2: number; q2: number }>;
  observedR2?: number;
  observedQ2?: number;
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function PermutationPlot({ scores = [], observedR2, observedQ2 }: PermutationPlotProps) {
  if (!scores.length) return <PlotEmpty message="Run PLS-DA to generate permutation test" />;

  const width = 520;
  const height = 300;
  const pad = { l: 52, r: 24, t: 28, b: 48 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxVal = Math.max(...scores.map((s) => Math.max(s.r2, s.q2)), observedR2 ?? 0, observedQ2 ?? 0, 0.1) * 1.1;
  const yScale = linearScale([0, maxVal], [plotH, 0]);
  const xScale = linearScale([0, Math.max(scores.length - 1, 1)], [0, plotW]);
  const yTicks = niceTicks(0, maxVal, 5);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Permutation validation plot">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <g transform={`translate(${pad.l}, ${pad.t})`}>
        {yTicks.map((t) => (
          <line key={t} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} className="stroke-border/60" strokeWidth={1} />
        ))}

        {scores.map((s, i) => (
          <g key={i}>
            <circle cx={xScale(i)} cy={yScale(s.r2)} r={3.5} fill="#7c3aed" opacity={0.55} />
            <circle cx={xScale(i)} cy={yScale(s.q2)} r={3} fill="#0891b2" opacity={0.45} />
          </g>
        ))}

        {observedR2 != null && (
          <line x1={0} y1={yScale(observedR2)} x2={plotW} y2={yScale(observedR2)} stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 4" />
        )}
        {observedQ2 != null && (
          <line x1={0} y1={yScale(observedQ2)} x2={plotW} y2={yScale(observedQ2)} stroke="#0891b2" strokeWidth={2} strokeDasharray="6 4" />
        )}

        <line x1={0} y1={plotH} x2={plotW} y2={plotH} className="stroke-foreground/80" strokeWidth={1.5} />
        <line x1={0} y1={0} x2={0} y2={plotH} className="stroke-foreground/80" strokeWidth={1.5} />
        {yTicks.map((t) => (
          <text key={t} x={-8} y={yScale(t) + 4} fontSize={10} textAnchor="end" className="fill-muted-foreground">{formatTick(t)}</text>
        ))}
        <text x={plotW / 2} y={plotH + 34} fontSize={12} textAnchor="middle" className="fill-foreground">Permutation iteration</text>
        <text x={-plotH / 2} y={-34} fontSize={12} textAnchor="middle" transform={`rotate(-90, ${-plotH / 2}, -34)`} className="fill-foreground">R² / Q²</text>
      </g>

      <g transform={`translate(${width - 150}, ${pad.t})`}>
        <rect width={126} height={58} className="fill-card stroke-border" strokeWidth={1} rx={6} />
        <circle cx={12} cy={16} r={4} fill="#7c3aed" />
        <text x={22} y={20} fontSize={10} className="fill-foreground">Permuted R²</text>
        <circle cx={12} cy={34} r={4} fill="#0891b2" />
        <text x={22} y={38} fontSize={10} className="fill-foreground">Permuted Q²</text>
        <text x={10} y={52} fontSize={9} className="fill-muted-foreground">Dashed = observed model</text>
      </g>
    </svg>
  );
}
