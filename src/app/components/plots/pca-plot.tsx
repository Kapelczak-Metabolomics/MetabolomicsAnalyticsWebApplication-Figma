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

const GROUP_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

export function PCAPlot({ scores = [], explainedVariance = [] }: PCAPlotProps) {
  const width = 600;
  const height = 450;
  const padding = { left: 60, right: 120, top: 40, bottom: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (!scores.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Run analysis to generate PCA scores from your dataset
      </div>
    );
  }

  const groups = [...new Set(scores.map((s) => s.group))];
  const xs = scores.map((s) => s.PC1);
  const ys = scores.map((s) => s.PC2);
  const xMin = Math.min(...xs) * 1.1;
  const xMax = Math.max(...xs) * 1.1;
  const yMin = Math.min(...ys) * 1.1;
  const yMax = Math.max(...ys) * 1.1;

  const xScale = (v: number) => ((v - xMin) / (xMax - xMin || 1)) * plotWidth;
  const yScale = (v: number) => plotHeight - ((v - yMin) / (yMax - yMin || 1)) * plotHeight;

  const pc1Var = explainedVariance[0] ?? 0;
  const pc2Var = explainedVariance[1] ?? 0;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {scores.map((d, i) => {
          const gi = groups.indexOf(d.group);
          const color = GROUP_COLORS[gi % GROUP_COLORS.length];
          return (
            <circle
              key={i}
              cx={xScale(d.PC1)}
              cy={yScale(d.PC2)}
              r="4"
              fill={color}
              opacity="0.75"
              stroke={color}
              strokeWidth="1"
            />
          );
        })}
        <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} className="stroke-foreground" strokeWidth="2" />
        <line x1={0} y1={0} x2={0} y2={plotHeight} className="stroke-foreground" strokeWidth="2" />
        <text x={plotWidth / 2} y={plotHeight + 45} fontSize="13" textAnchor="middle" className="fill-foreground">
          PC1 ({pc1Var}% variance)
        </text>
        <text x={-plotHeight / 2} y={-40} fontSize="13" textAnchor="middle" transform={`rotate(-90, ${-plotHeight / 2}, -40)`} className="fill-foreground">
          PC2 ({pc2Var}% variance)
        </text>
      </g>
      <g transform={`translate(${width - padding.right - 100}, ${padding.top + 20})`}>
        <rect x={-10} y={-10} width={110} height={20 + groups.length * 22} className="fill-background stroke-border" strokeWidth="1" rx="4" />
        {groups.map((g, i) => (
          <g key={g} transform={`translate(0, ${i * 22})`}>
            <circle cx={5} cy={10} r="4" fill={GROUP_COLORS[i % GROUP_COLORS.length]} />
            <text x={15} y={13} fontSize="11" className="fill-foreground">
              {g} (n={scores.filter((s) => s.group === g).length})
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
