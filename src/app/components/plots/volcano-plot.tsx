export function VolcanoPlot() {
  const width = 600;
  const height = 450;
  const padding = { left: 60, right: 40, top: 40, bottom: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Generate volcano plot data
  const generateData = () => {
    const points: Array<{ x: number; y: number; significant: boolean; direction: "up" | "down" | "none" }> = [];

    // Generate points
    for (let i = 0; i < 400; i++) {
      const x = (Math.random() - 0.5) * 8; // log2 fold change from -4 to 4
      const y = Math.random() * 8; // -log10 p-value from 0 to 8

      const significant = Math.abs(x) > 1.5 && y > 1.3; // FC > 1.5, p < 0.05
      const direction = significant ? (x > 0 ? "up" : "down") : "none";

      points.push({ x, y, significant, direction });
    }

    return points;
  };

  const data = generateData();

  const xScale = (value: number) => {
    const min = -4;
    const max = 4;
    return ((value - min) / (max - min)) * plotWidth;
  };

  const yScale = (value: number) => {
    const min = 0;
    const max = 8;
    return plotHeight - ((value - min) / (max - min)) * plotHeight;
  };

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Background */}
      <rect width={width} height={height} fill="transparent" />

      {/* Plot area */}
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {/* Grid lines */}
        <g className="stroke-border" strokeWidth="1" opacity="0.2">
          {[-4, -2, 0, 2, 4].map((x) => (
            <line
              key={`vline-${x}`}
              x1={xScale(x)}
              y1={0}
              x2={xScale(x)}
              y2={plotHeight}
            />
          ))}
          {[0, 2, 4, 6, 8].map((y) => (
            <line
              key={`hline-${y}`}
              x1={0}
              y1={yScale(y)}
              x2={plotWidth}
              y2={yScale(y)}
            />
          ))}
        </g>

        {/* Threshold lines */}
        <line
          x1={xScale(-1.5)}
          y1={0}
          x2={xScale(-1.5)}
          y2={plotHeight}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="stroke-blue-500/50"
        />
        <line
          x1={xScale(1.5)}
          y1={0}
          x2={xScale(1.5)}
          y2={plotHeight}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="stroke-red-500/50"
        />
        <line
          x1={0}
          y1={yScale(1.3)}
          x2={plotWidth}
          y2={yScale(1.3)}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="stroke-muted-foreground/50"
        />

        {/* Data points - render non-significant first */}
        {data
          .filter((d) => !d.significant)
          .map((d, i) => (
            <circle
              key={`ns-${i}`}
              cx={xScale(d.x)}
              cy={yScale(d.y)}
              r="2.5"
              fill="currentColor"
              className="fill-muted-foreground"
              opacity="0.4"
            />
          ))}

        {/* Significant points */}
        {data
          .filter((d) => d.significant)
          .map((d, i) => (
            <circle
              key={`sig-${i}`}
              cx={xScale(d.x)}
              cy={yScale(d.y)}
              r="3"
              fill="currentColor"
              className={
                d.direction === "up"
                  ? "fill-rose-500"
                  : "fill-blue-500"
              }
              opacity="0.7"
            />
          ))}

        {/* Axes */}
        <line
          x1={0}
          y1={plotHeight}
          x2={plotWidth}
          y2={plotHeight}
          stroke="currentColor"
          strokeWidth="2"
          className="stroke-foreground"
        />
        <line
          x1={xScale(0)}
          y1={0}
          x2={xScale(0)}
          y2={plotHeight}
          stroke="currentColor"
          strokeWidth="2"
          className="stroke-foreground"
        />

        {/* X-axis labels */}
        {[-4, -2, 0, 2, 4].map((x) => (
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

        {/* Y-axis labels */}
        {[0, 2, 4, 6, 8].map((y) => (
          <text
            key={`ylabel-${y}`}
            x={-10}
            y={yScale(y)}
            fontSize="11"
            fill="currentColor"
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground"
          >
            {y}
          </text>
        ))}

        {/* Axis titles */}
        <text
          x={plotWidth / 2}
          y={plotHeight + 50}
          fontSize="13"
          fill="currentColor"
          textAnchor="middle"
          className="fill-foreground"
        >
          log₂ Fold Change
        </text>
        <text
          x={-plotHeight / 2}
          y={-45}
          fontSize="13"
          fill="currentColor"
          textAnchor="middle"
          transform={`rotate(-90, ${-plotHeight / 2}, -45)`}
          className="fill-foreground"
        >
          -log₁₀ p-value
        </text>
      </g>

      {/* Legend */}
      <g transform={`translate(${width - padding.right - 120}, ${padding.top + 20})`}>
        <rect
          x={-10}
          y={-10}
          width={130}
          height={75}
          className="fill-background stroke-border"
          strokeWidth="1"
          rx="4"
        />
        <circle cx={5} cy={10} r="3.5" fill="currentColor" className="fill-rose-500" />
        <text x={15} y={13} fontSize="10" fill="currentColor" className="fill-foreground">
          Upregulated (87)
        </text>
        <circle cx={5} cy={30} r="3.5" fill="currentColor" className="fill-blue-500" />
        <text x={15} y={33} fontSize="10" fill="currentColor" className="fill-foreground">
          Downregulated (102)
        </text>
        <circle cx={5} cy={50} r="2.5" fill="currentColor" className="fill-muted-foreground" opacity="0.4" />
        <text x={15} y={53} fontSize="10" fill="currentColor" className="fill-foreground">
          Not significant
        </text>
      </g>
    </svg>
  );
}
