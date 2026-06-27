export function PCAPlot() {
  const width = 600;
  const height = 450;
  const padding = { left: 60, right: 120, top: 40, bottom: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Generate PCA data with two clusters
  const generateData = () => {
    const points: Array<{ x: number; y: number; group: "AD" | "Control" }> = [];

    // AD group (cluster 1)
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 15 + 5;
      points.push({
        x: Math.cos(angle) * radius - 20,
        y: Math.sin(angle) * radius + 10,
        group: "AD",
      });
    }

    // Control group (cluster 2)
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 15 + 5;
      points.push({
        x: Math.cos(angle) * radius + 25,
        y: Math.sin(angle) * radius - 5,
        group: "Control",
      });
    }

    return points;
  };

  const data = generateData();

  const xScale = (value: number) => {
    const min = -50;
    const max = 50;
    return ((value - min) / (max - min)) * plotWidth;
  };

  const yScale = (value: number) => {
    const min = -40;
    const max = 40;
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
          {[-40, -20, 0, 20, 40].map((x) => (
            <line
              key={`vline-${x}`}
              x1={xScale(x)}
              y1={0}
              x2={xScale(x)}
              y2={plotHeight}
            />
          ))}
          {[-30, -15, 0, 15, 30].map((y) => (
            <line
              key={`hline-${y}`}
              x1={0}
              y1={yScale(y)}
              x2={plotWidth}
              y2={yScale(y)}
            />
          ))}
        </g>

        {/* Confidence ellipses */}
        <ellipse
          cx={xScale(-20)}
          cy={yScale(10)}
          rx={plotWidth * 0.15}
          ry={plotHeight * 0.15}
          className="fill-violet-500 stroke-violet-500"
          opacity="0.1"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <ellipse
          cx={xScale(25)}
          cy={yScale(-5)}
          rx={plotWidth * 0.15}
          ry={plotHeight * 0.15}
          className="fill-cyan-500 stroke-cyan-500"
          opacity="0.1"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* Data points */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(d.x)}
            cy={yScale(d.y)}
            r="4"
            className={
              d.group === "AD"
                ? "fill-violet-500 stroke-violet-700 dark:stroke-violet-300"
                : "fill-cyan-500 stroke-cyan-700 dark:stroke-cyan-300"
            }
            opacity="0.6"
            strokeWidth="1"
          />
        ))}

        {/* Axes */}
        <line
          x1={0}
          y1={yScale(0)}
          x2={plotWidth}
          y2={yScale(0)}
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
        {[-40, -20, 0, 20, 40].map((x) => (
          <text
            key={`xlabel-${x}`}
            x={xScale(x)}
            y={yScale(0) + 20}
            fontSize="11"
            fill="currentColor"
            textAnchor="middle"
            className="fill-muted-foreground"
          >
            {x}
          </text>
        ))}

        {/* Y-axis labels */}
        {[-30, -15, 0, 15, 30].map((y) => (
          <text
            key={`ylabel-${y}`}
            x={xScale(0) - 15}
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
          PC1 (42.3% variance)
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
          PC2 (23.7% variance)
        </text>
      </g>

      {/* Legend */}
      <g transform={`translate(${width - padding.right - 100}, ${padding.top + 20})`}>
        <rect
          x={-10}
          y={-10}
          width={110}
          height={65}
          className="fill-background stroke-border"
          strokeWidth="1"
          rx="4"
        />
        <circle cx={5} cy={10} r="4" className="fill-violet-500 stroke-violet-700 dark:stroke-violet-300" opacity="0.6" strokeWidth="1" />
        <text x={15} y={13} fontSize="11" className="fill-foreground">
          AD (n=80)
        </text>
        <circle cx={5} cy={35} r="4" className="fill-cyan-500 stroke-cyan-700 dark:stroke-cyan-300" opacity="0.6" strokeWidth="1" />
        <text x={15} y={38} fontSize="11" className="fill-foreground">
          Control (n=80)
        </text>
      </g>
    </svg>
  );
}
