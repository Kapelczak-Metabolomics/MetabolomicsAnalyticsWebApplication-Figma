interface PermutationPlotProps {
  scores?: Array<{ iteration: number; r2: number; q2: number }>;
}

export function PermutationPlot({ scores = [] }: PermutationPlotProps) {
  if (!scores.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Run PLS-DA to generate permutation test</div>;
  }
  const width = 400;
  const height = 250;
  const pad = { l: 40, r: 20, t: 20, b: 40 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxR2 = Math.max(...scores.map((s) => s.r2), 0.1);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <g transform={`translate(${pad.l}, ${pad.t})`}>
        {scores.map((s, i) => (
          <circle key={i} cx={(i / Math.max(scores.length - 1, 1)) * plotW} cy={plotH - (s.r2 / maxR2) * plotH} r="3" fill="#8b5cf6" opacity="0.6" />
        ))}
        <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="currentColor" />
        <line x1={0} y1={0} x2={0} y2={plotH} stroke="currentColor" />
        <text x={plotW / 2} y={plotH + 30} fontSize="11" textAnchor="middle">Permutation</text>
        <text x={-plotH / 2} y={-25} fontSize="11" textAnchor="middle" transform={`rotate(-90, ${-plotH / 2}, -25)`}>R²</text>
      </g>
    </svg>
  );
}
