export function PathwayPlot() {
  const width = 700;
  const height = 400;
  const padding = { left: 280, right: 80, top: 40, bottom: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const pathways = [
    {
      name: "Aminoacyl-tRNA biosynthesis",
      pValue: 2.3e-6,
      count: 12,
      total: 48,
      foldEnrich: 3.2,
    },
    {
      name: "Valine, leucine, isoleucine biosyn.",
      pValue: 5.6e-5,
      count: 8,
      total: 27,
      foldEnrich: 2.8,
    },
    {
      name: "Nitrogen metabolism",
      pValue: 1.2e-4,
      count: 7,
      total: 32,
      foldEnrich: 2.5,
    },
    {
      name: "Arginine biosynthesis",
      pValue: 2.8e-4,
      count: 9,
      total: 41,
      foldEnrich: 2.3,
    },
    {
      name: "Glutathione metabolism",
      pValue: 4.5e-4,
      count: 6,
      total: 29,
      foldEnrich: 2.1,
    },
    {
      name: "Alanine, aspartate metabolism",
      pValue: 8.9e-4,
      count: 5,
      total: 35,
      foldEnrich: 1.9,
    },
    {
      name: "Glycine, serine, threonine metab.",
      pValue: 1.5e-3,
      count: 7,
      total: 52,
      foldEnrich: 1.7,
    },
    {
      name: "Phenylalanine metabolism",
      pValue: 2.3e-3,
      count: 4,
      total: 28,
      foldEnrich: 1.6,
    },
  ];

  const maxPValue = Math.max(...pathways.map((p) => -Math.log10(p.pValue)));
  const maxCount = Math.max(...pathways.map((p) => p.count));

  const xScale = (value: number) => {
    return (value / maxPValue) * plotWidth;
  };

  const yScale = (index: number) => {
    const spacing = plotHeight / (pathways.length + 1);
    return spacing * (index + 1);
  };

  const sizeScale = (count: number) => {
    return 4 + (count / maxCount) * 12;
  };

  const colorScale = (enrichment: number) => {
    // Color from cyan to violet based on fold enrichment
    const t = (enrichment - 1.5) / 2; // normalize 1.5-3.5 to 0-1
    return t;
  };

  const getColor = (t: number) => {
    // Interpolate from cyan to violet
    const clampedT = Math.max(0, Math.min(1, t));
    if (clampedT < 0.5) {
      return `rgba(34, 211, 238, ${0.6 + clampedT * 0.4})`;
    } else {
      return `rgba(139, 92, 246, ${0.6 + (clampedT - 0.5) * 0.8})`;
    }
  };

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Background */}
      <rect width={width} height={height} fill="transparent" />

      {/* Plot area */}
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {/* Grid lines */}
        <g className="stroke-border" strokeWidth="1" opacity="0.2">
          {[0, 2, 4, 6].map((x) => (
            <line
              key={`vline-${x}`}
              x1={xScale(x)}
              y1={0}
              x2={xScale(x)}
              y2={plotHeight}
            />
          ))}
        </g>

        {/* Pathway dots */}
        {pathways.map((pathway, i) => {
          const x = xScale(-Math.log10(pathway.pValue));
          const y = yScale(i);
          const size = sizeScale(pathway.count);
          const color = getColor(colorScale(pathway.foldEnrich));

          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={size}
                fill={color}
                stroke="currentColor"
                strokeWidth="1.5"
                className={
                  pathway.foldEnrich > 2.5
                    ? "stroke-violet-600 dark:stroke-violet-400"
                    : "stroke-cyan-600 dark:stroke-cyan-400"
                }
              />
            </g>
          );
        })}

        {/* X-axis */}
        <line
          x1={0}
          y1={plotHeight}
          x2={plotWidth}
          y2={plotHeight}
          stroke="currentColor"
          strokeWidth="2"
          className="stroke-foreground"
        />

        {/* X-axis labels */}
        {[0, 2, 4, 6].map((x) => (
          <text
            key={`xlabel-${x}`}
            x={xScale(x)}
            y={plotHeight + 25}
            fontSize="11"
            fill="currentColor"
            textAnchor="middle"
            className="fill-muted-foreground"
          >
            {x}
          </text>
        ))}

        {/* X-axis title */}
        <text
          x={plotWidth / 2}
          y={plotHeight + 50}
          fontSize="13"
          fill="currentColor"
          textAnchor="middle"
          className="fill-foreground"
        >
          -log₁₀ p-value
        </text>

        {/* Pathway labels (left) */}
        {pathways.map((pathway, i) => (
          <text
            key={`label-${i}`}
            x={-10}
            y={yScale(i)}
            fontSize="11"
            fill="currentColor"
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-foreground"
          >
            {pathway.name}
          </text>
        ))}

        {/* Gene count labels (on dots) */}
        {pathways.map((pathway, i) => {
          const x = xScale(-Math.log10(pathway.pValue));
          const y = yScale(i);
          const size = sizeScale(pathway.count);

          return (
            <text
              key={`count-${i}`}
              x={x}
              y={y}
              fontSize="8"
              fontWeight="600"
              fill="white"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {pathway.count}
            </text>
          );
        })}
      </g>

      {/* Legend - Gene Count */}
      <g transform={`translate(${width - padding.right - 70}, ${padding.top + 20})`}>
        <text fontSize="11" fontWeight="500" className="fill-foreground">
          Gene Count
        </text>
        {[4, 8, 12].map((count, i) => (
          <g key={count} transform={`translate(0, ${30 + i * 30})`}>
            <circle
              cx={10}
              cy={0}
              r={sizeScale(count)}
              fill="currentColor"
              className="fill-violet-500"
              opacity="0.7"
            />
            <text x={25} y={3} fontSize="10" className="fill-muted-foreground">
              {count}
            </text>
          </g>
        ))}
      </g>

      {/* Legend - Fold Enrichment */}
      <g transform={`translate(${width - padding.right - 70}, ${padding.top + 160})`}>
        <text fontSize="11" fontWeight="500" className="fill-foreground">
          Fold Enrich.
        </text>
        <defs>
          <linearGradient id="enrichGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(139, 92, 246)" />
            <stop offset="100%" stopColor="rgb(34, 211, 238)" />
          </linearGradient>
        </defs>
        <rect x={5} y={20} width={15} height={80} fill="url(#enrichGradient)" rx="2" />
        <text x={25} y={25} fontSize="9" className="fill-muted-foreground">
          3.5
        </text>
        <text x={25} y={65} fontSize="9" className="fill-muted-foreground">
          2.5
        </text>
        <text x={25} y={105} fontSize="9" className="fill-muted-foreground">
          1.5
        </text>
      </g>
    </svg>
  );
}
