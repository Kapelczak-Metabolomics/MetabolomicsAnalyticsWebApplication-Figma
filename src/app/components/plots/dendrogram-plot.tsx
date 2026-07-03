interface DendrogramPlotProps {
  data?: Array<{ left: string; right: string; height: number }>;
  height?: number;
}

export function DendrogramPlot({ data = [], height = 250 }: DendrogramPlotProps) {
  if (!data.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Run clustering to generate dendrogram</div>;
  }
  const width = 500;
  const maxH = Math.max(...data.map((d) => d.height), 0.01);
  const step = width / (data.length + 1);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((d, i) => {
        const x = (i + 1) * step;
        const h = (d.height / maxH) * (height - 40);
        return (
          <g key={i}>
            <line x1={x - step / 2} y1={height - 20} x2={x - step / 2} y2={height - 20 - h} stroke="#8b5cf6" strokeWidth="2" />
            <line x1={x + step / 2} y1={height - 20} x2={x + step / 2} y2={height - 20 - h} stroke="#06b6d4" strokeWidth="2" />
            <line x1={x - step / 2} y1={height - 20 - h} x2={x + step / 2} y2={height - 20 - h} stroke="#64748b" strokeWidth="1.5" />
          </g>
        );
      })}
    </svg>
  );
}
