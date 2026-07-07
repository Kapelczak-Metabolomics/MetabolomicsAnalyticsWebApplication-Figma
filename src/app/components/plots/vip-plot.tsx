interface VIPPlotProps {
  features?: Array<{ name: string; vip: number }>;
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function VIPPlot({ features = [] }: VIPPlotProps) {
  if (!features.length) return <PlotEmpty message="Run PLS-DA to generate VIP scores" />;

  const width = 560;
  const labelW = 160;
  const barStart = labelW + 12;
  const barMaxW = 300;
  const barH = 20;
  const rowGap = 8;
  const height = features.length * (barH + rowGap) + 56;
  const max = Math.max(...features.map((f) => f.vip), 1.2);
  const thresholdX = barStart + (1 / max) * barMaxW;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="VIP score plot">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <text x={barStart} y={18} fontSize={11} fontWeight={600} className="fill-muted-foreground">Variable Importance in Projection</text>

      {features.map((f, i) => {
        const w = (f.vip / max) * barMaxW;
        const y = 28 + i * (barH + rowGap);
        const significant = f.vip >= 1;
        return (
          <g key={f.name}>
            <text x={labelW} y={y + barH / 2 + 4} fontSize={11} textAnchor="end" className="fill-foreground">
              {f.name.length > 22 ? `${f.name.slice(0, 20)}…` : f.name}
            </text>
            <rect x={barStart} y={y} width={barMaxW} height={barH} className="fill-muted/40" rx={4} />
            <rect x={barStart} y={y} width={w} height={barH} fill={significant ? "#7c3aed" : "#94a3b8"} rx={4} opacity={0.9} />
            <text x={barStart + w + 8} y={y + barH / 2 + 4} fontSize={11} className="fill-foreground">{f.vip.toFixed(2)}</text>
          </g>
        );
      })}

      <line x1={thresholdX} y1={24} x2={thresholdX} y2={height - 20} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} />
      <text x={thresholdX + 4} y={height - 6} fontSize={10} fill="#dc2626">VIP = 1.0</text>
    </svg>
  );
}
