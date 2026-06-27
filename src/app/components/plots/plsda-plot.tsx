export function PLSDAPlot() {
  const width = 600;
  const height = 450;
  const padding = { left: 60, right: 120, top: 40, bottom: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Generate PLS-DA data with better separation than PCA
  const generateData = () => {
    const points: Array<{ x: number; y: number; group: "AD" | "Control" }> = [];

    // AD group (cluster 1) - more separated
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 12 + 3;
      points.push({
        x: Math.cos(angle) * radius - 30,
        y: Math.sin(angle) * radius + 5,
        group: "AD",
      });
    }

    // Control group (cluster 2) - more separated
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 12 + 3;
      points.push({
        x: Math.cos(angle) * radius + 30,
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

        {/* Decision boundary (diagonal line) */}
        <line
          x1={xScale(-50)}
          y1={yScale(40)}
          x2={xScale(50)}
          y2={yScale(-40)}
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 4"
          className="stroke-amber-500"
          opacity="0.6"
        />

        {/* Confidence regions */}
        <ellipse
          cx={xScale(-30)}
          cy={yScale(5)}
          rx={plotWidth * 0.13}
          ry={plotHeight * 0.13}
          className="fill-emerald-500 stroke-emerald-500"
          opacity="0.1"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <ellipse
          cx={xScale(30)}
          cy={yScale(-5)}
          rx={plotWidth * 0.13}
          ry={plotHeight * 0.13}
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
                ? "fill-emerald-500 stroke-emerald-700 dark:stroke-emerald-300"
                : "fill-cyan-500 stroke-cyan-700 dark:stroke-cyan-300"
            }
            opacity="0.7"
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
          LV1 (R² = 0.58)
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
          LV2 (R² = 0.32)
        </text>
      </g>

      {/* Legend */}
      <g transform={`translate(${width - padding.right - 110}, ${padding.top + 20})`}>
        <rect
          x={-10}
          y={-10}
          width={120}
          height={85}
          className="fill-background stroke-border"
          strokeWidth="1"
          rx="4"
        />
        <circle cx={5} cy={10} r="4" className="fill-emerald-500 stroke-emerald-700 dark:stroke-emerald-300" opacity="0.7" strokeWidth="1" />
        <text x={15} y={13} fontSize="11" className="fill-foreground">
          AD (n=80)
        </text>
        <circle cx={5} cy={35} r="4" className="fill-cyan-500 stroke-cyan-700 dark:stroke-cyan-300" opacity="0.7" strokeWidth="1" />
        <text x={15} y={38} fontSize="11" className="fill-foreground">
          Control (n=80)
        </text>
        <line x1={0} y1={58} x2={25} y2={58} stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" className="stroke-amber-500" />
        <text x={30} y={61} fontSize="10" fill="currentColor" className="fill-foreground">
          Decision boundary
        </text>
      </g>

      {/* Performance metrics */}
      <g transform={`translate(${width - padding.right - 110}, ${padding.top + 120})`}>
        <rect
          x={-10}
          y={-10}
          width={120}
          height={75}
          className="fill-emerald-500/5 stroke-emerald-500/20"
          strokeWidth="1"
          rx="4"
        />
        <text x={0} y={5} fontSize="10" className="fill-muted-foreground font-medium">
          Accuracy: 87.3%
        </text>
        <text x={0} y={23} fontSize="10" className="fill-muted-foreground">
          Q² (CV): 0.658
        </text>
        <text x={0} y={38} fontSize="10" className="fill-muted-foreground">
          AUC: 0.923
        </text>
        <text x={0} y={53} fontSize="10" className="fill-muted-foreground">
          p {"<"} 0.001
        </text>
      </g>
    </svg>
  );
}
