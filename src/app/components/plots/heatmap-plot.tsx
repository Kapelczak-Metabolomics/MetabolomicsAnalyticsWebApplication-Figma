import { formatTick, heatColor } from "./plot-theme";

interface HeatmapPlotProps {
  matrix?: (number | null)[][];
  sampleLabels?: string[];
  featureLabels?: string[];
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function HeatmapPlot({ matrix = [], sampleLabels = [], featureLabels = [] }: HeatmapPlotProps) {
  if (!matrix.length || !matrix[0]?.length) return <PlotEmpty message="Run clustering to view heatmap" />;

  const flat = matrix.flat().filter((v): v is number => v != null);
  const min = flat.length ? Math.min(...flat) : 0;
  const max = flat.length ? Math.max(...flat) : 1;
  const rows = matrix.length;
  const cols = matrix[0].length;
  const cell = 18;
  const pad = { left: 108, top: 72, right: 88, bottom: 24 };
  const width = pad.left + cols * cell + pad.right;
  const height = pad.top + rows * cell + pad.bottom;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Clustered heatmap">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />

      {featureLabels.map((label, j) => (
        <text
          key={`f-${label}-${j}`}
          x={pad.left + j * cell + cell / 2}
          y={pad.top - 10}
          fontSize={9}
          textAnchor="end"
          transform={`rotate(-50, ${pad.left + j * cell + cell / 2}, ${pad.top - 10})`}
          className="fill-muted-foreground"
        >
          {label.length > 14 ? `${label.slice(0, 12)}…` : label}
        </text>
      ))}

      {matrix.map((row, i) => (
        <g key={i}>
          <text x={pad.left - 8} y={pad.top + i * cell + cell / 2 + 4} fontSize={10} textAnchor="end" className="fill-foreground">
            {(sampleLabels[i] ?? `S${i + 1}`).slice(0, 14)}
          </text>
          {row.map((v, j) => (
            <rect
              key={j}
              x={pad.left + j * cell}
              y={pad.top + i * cell}
              width={cell - 1}
              height={cell - 1}
              rx={2}
              fill={v == null ? "#e2e8f0" : heatColor(v, min, max)}
            >
              {v != null && <title>{`${sampleLabels[i] ?? `S${i + 1}`} · ${featureLabels[j] ?? `F${j + 1}`}: ${v}`}</title>}
            </rect>
          ))}
        </g>
      ))}

      <g transform={`translate(${width - 72}, ${pad.top})`}>
        <text x={0} y={-8} fontSize={10} fontWeight={600} className="fill-muted-foreground">Expression</text>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <rect key={i} x={0} y={i * 22} width={16} height={20} fill={heatColor(min + (max - min) * t, min, max)} rx={2} />
        ))}
        <text x={22} y={12} fontSize={9} className="fill-muted-foreground">{formatTick(max)}</text>
        <text x={22} y={56} fontSize={9} className="fill-muted-foreground">{formatTick((max + min) / 2)}</text>
        <text x={22} y={100} fontSize={9} className="fill-muted-foreground">{formatTick(min)}</text>
      </g>
    </svg>
  );
}
