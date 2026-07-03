const GROUP_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

interface PLSDAPlotProps {
  scores?: Array<{ comp1: number; comp2: number; group: string }>;
}

export function PLSDAPlot({ scores = [] }: PLSDAPlotProps) {
  const width = 600;
  const height = 450;
  const padding = { left: 60, right: 120, top: 40, bottom: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (!scores.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Run PLS-DA to generate scores</div>;
  }

  const groups = [...new Set(scores.map((s) => s.group))];
  const xs = scores.map((s) => s.comp1);
  const ys = scores.map((s) => s.comp2);
  const xMin = Math.min(...xs) * 1.1;
  const xMax = Math.max(...xs) * 1.1;
  const yMin = Math.min(...ys) * 1.1;
  const yMax = Math.max(...ys) * 1.1;
  const xScale = (v: number) => ((v - xMin) / (xMax - xMin || 1)) * plotWidth;
  const yScale = (v: number) => plotHeight - ((v - yMin) / (yMax - yMin || 1)) * plotHeight;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {scores.map((d, i) => {
          const gi = groups.indexOf(d.group);
          const color = GROUP_COLORS[gi % GROUP_COLORS.length];
          return <circle key={i} cx={xScale(d.comp1)} cy={yScale(d.comp2)} r="4" fill={color} opacity="0.75" />;
        })}
        <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} className="stroke-foreground" strokeWidth="2" />
        <line x1={0} y1={0} x2={0} y2={plotHeight} className="stroke-foreground" strokeWidth="2" />
        <text x={plotWidth / 2} y={plotHeight + 45} fontSize="13" textAnchor="middle" className="fill-foreground">Component 1</text>
        <text x={-plotHeight / 2} y={-40} fontSize="13" textAnchor="middle" transform={`rotate(-90, ${-plotHeight / 2}, -40)`} className="fill-foreground">Component 2</text>
      </g>
    </svg>
  );
}
