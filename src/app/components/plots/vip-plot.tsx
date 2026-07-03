interface VIPPlotProps {
  features?: Array<{ name: string; vip: number }>;
}

export function VIPPlot({ features = [] }: VIPPlotProps) {
  if (!features.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Run PLS-DA to generate VIP scores</div>;
  }
  const max = Math.max(...features.map((f) => f.vip), 1);
  const barH = 22;
  const height = features.length * (barH + 4) + 20;

  return (
    <svg width="100%" height={height} viewBox={`0 0 400 ${height}`}>
      {features.map((f, i) => {
        const w = (f.vip / max) * 280;
        const y = i * (barH + 4) + 10;
        return (
          <g key={f.name}>
            <text x={0} y={y + barH / 2 + 4} fontSize="10" className="fill-muted-foreground">{f.name.slice(0, 14)}</text>
            <rect x={110} y={y} width={w} height={barH} fill={f.vip >= 1 ? "#8b5cf6" : "#94a3b8"} rx="2" />
            <text x={115 + w} y={y + barH / 2 + 4} fontSize="10" className="fill-foreground">{f.vip.toFixed(2)}</text>
          </g>
        );
      })}
      <line x1={110} y1={height - 5} x2={390} y2={height - 5} stroke="#ef4444" strokeDasharray="4" />
      <text x={392} y={height - 2} fontSize="8" fill="#ef4444">1.0</text>
    </svg>
  );
}
