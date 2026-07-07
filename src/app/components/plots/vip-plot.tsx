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

  const width = 600;
  const labelW = 168;
  const barStart = labelW + 16;
  const barMaxW = 320;
  const barH = 22;
  const rowGap = 10;
  const chartH = features.length * (barH + rowGap) + 48;
  const height = Math.max(chartH, 200);
  const max = Math.max(...features.map((f) => f.vip), 1.2);
  const thresholdX = barStart + (1 / max) * barMaxW;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="VIP score plot">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <text x={barStart} y={22} fontSize={12} fontWeight={600} className="fill-foreground">Variable Importance in Projection</text>

      {features.map((f, i) => {
        const w = (f.vip / max) * barMaxW;
        const y = 36 + i * (barH + rowGap);
        const significant = f.vip >= 1;
        return (
          <g key={f.name}>
            <text x={labelW} y={y + barH / 2 + 4} fontSize={11} textAnchor="end" className="fill-foreground">
              {f.name.length > 24 ? `${f.name.slice(0, 22)}…` : f.name}
            </text>
            <rect x={barStart} y={y} width={barMaxW} height={barH} className="fill-muted/50" rx={5} />
            <rect x={barStart} y={y} width={w} height={barH} fill={significant ? "#6366f1" : "#94a3b8"} rx={5} opacity={0.92} />
            <text x={barStart + w + 8} y={y + barH / 2 + 4} fontSize={11} className="fill-foreground tabular-nums">{f.vip.toFixed(2)}</text>
          </g>
        );
      })}

      <line x1={thresholdX} y1={32} x2={thresholdX} y2={height - 16} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
      <text x={thresholdX + 4} y={height - 4} fontSize={10} fill="#ef4444">VIP = 1.0</text>
    </svg>
  );
}
