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
  const cell = 22;
  const pad = { left: 112, top: 80, right: 96, bottom: 28 };
  const width = pad.left + cols * cell + pad.right;
  const height = pad.top + rows * cell + pad.bottom;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Clustered heatmap">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />

      <text x={width / 2} y={24} fontSize={13} fontWeight={600} textAnchor="middle" className="fill-foreground">
        Sample × feature expression
      </text>

      {featureLabels.map((label, j) => (
        <text
          key={`f-${label}-${j}`}
          x={pad.left + j * cell + cell / 2}
          y={pad.top - 12}
          fontSize={9}
          textAnchor="end"
          transform={`rotate(-45, ${pad.left + j * cell + cell / 2}, ${pad.top - 12})`}
          className="fill-muted-foreground"
        >
          {label.length > 16 ? `${label.slice(0, 14)}…` : label}
        </text>
      ))}

      {matrix.map((row, i) => (
        <g key={i}>
          <text x={pad.left - 10} y={pad.top + i * cell + cell / 2 + 4} fontSize={10} textAnchor="end" className="fill-foreground">
            {(sampleLabels[i] ?? `S${i + 1}`).slice(0, 16)}
          </text>
          {row.map((v, j) => (
            <rect
              key={j}
              x={pad.left + j * cell}
              y={pad.top + i * cell}
              width={cell - 2}
              height={cell - 2}
              rx={3}
              fill={v == null ? "transparent" : heatColor(v, min, max)}
              className={v == null ? "fill-muted/40 stroke-border/30" : ""}
              stroke={v == null ? undefined : "white"}
              strokeWidth={v == null ? 1 : 0.5}
            >
              {v != null && <title>{`${sampleLabels[i] ?? `S${i + 1}`} · ${featureLabels[j] ?? `F${j + 1}`}: ${v}`}</title>}
            </rect>
          ))}
        </g>
      ))}

      <g transform={`translate(${width - 80}, ${pad.top})`}>
        <text x={0} y={-8} fontSize={10} fontWeight={600} className="fill-muted-foreground">Scale</text>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <rect key={i} x={0} y={i * 24} width={18} height={22} fill={heatColor(min + (max - min) * t, min, max)} rx={3} />
        ))}
        <text x={24} y={14} fontSize={9} className="fill-muted-foreground">{formatTick(max)}</text>
        <text x={24} y={62} fontSize={9} className="fill-muted-foreground">{formatTick((max + min) / 2)}</text>
        <text x={24} y={110} fontSize={9} className="fill-muted-foreground">{formatTick(min)}</text>
      </g>
    </svg>
  );
}
