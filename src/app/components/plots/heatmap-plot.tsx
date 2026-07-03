interface HeatmapPlotProps {
  matrix?: (number | null)[][];
  sampleLabels?: string[];
  featureLabels?: string[];
}

function interpolateColor(c1: string, c2: string, t: number) {
  const parse = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const a = parse(c1), b = parse(c2);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function HeatmapPlot({ matrix = [], sampleLabels = [], featureLabels = [] }: HeatmapPlotProps) {
  if (!matrix.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Run clustering to view heatmap</div>;
  }

  const flat = matrix.flat().filter((v): v is number => v != null);
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const cellSize = 14;
  const padding = { left: 100, top: 80 };
  const width = padding.left + matrix[0].length * cellSize + 20;
  const height = padding.top + matrix.length * cellSize + 20;

  const color = (v: number | null) => {
    if (v == null) return "#e5e7eb";
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return interpolateColor("#3b82f6", "#ef4444", t);
  };

  return (
    <svg width={width} height={height}>
      {featureLabels.map((label, j) => (
        <text key={label} x={padding.left + j * cellSize + cellSize / 2} y={padding.top - 8} fontSize="8" textAnchor="middle" transform={`rotate(-45, ${padding.left + j * cellSize + cellSize / 2}, ${padding.top - 8})`} className="fill-muted-foreground">
          {label.slice(0, 8)}
        </text>
      ))}
      {matrix.map((row, i) => (
        <g key={i}>
          <text x={padding.left - 6} y={padding.top + i * cellSize + cellSize / 2 + 3} fontSize="9" textAnchor="end" className="fill-muted-foreground">
            {sampleLabels[i]?.slice(0, 10) ?? `S${i}`}
          </text>
          {row.map((v, j) => (
            <rect key={j} x={padding.left + j * cellSize} y={padding.top + i * cellSize} width={cellSize - 1} height={cellSize - 1} fill={color(v)} />
          ))}
        </g>
      ))}
    </svg>
  );
}
