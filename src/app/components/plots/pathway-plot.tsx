interface PathwayPlotProps {
  pathways?: Array<{ name: string; genes: number; negLogP?: number; pValue?: number }>;
}

export function PathwayPlot({ pathways = [] }: PathwayPlotProps) {
  const width = 700;
  const height = Math.max(300, pathways.length * 32 + 80);
  const padding = { left: 280, right: 80, top: 40, bottom: 40 };
  const plotWidth = width - padding.left - padding.right;

  if (!pathways.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Run pathway enrichment to see results</div>;
  }

  const maxVal = Math.max(...pathways.map((p) => p.negLogP ?? -Math.log10(p.pValue ?? 1)), 0.1);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {pathways.map((p, i) => {
        const val = p.negLogP ?? -Math.log10(p.pValue ?? 1);
        const barW = (val / maxVal) * plotWidth;
        const y = padding.top + i * 32;
        return (
          <g key={p.name}>
            <text x={padding.left - 8} y={y + 14} fontSize="11" textAnchor="end" className="fill-foreground">
              {p.name.length > 32 ? `${p.name.slice(0, 30)}…` : p.name}
            </text>
            <rect x={padding.left} y={y} width={barW} height={20} rx="3" className="fill-violet-500/70" />
            <text x={padding.left + barW + 6} y={y + 14} fontSize="10" className="fill-muted-foreground">
              {p.genes} features · -log₁₀p {val.toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
