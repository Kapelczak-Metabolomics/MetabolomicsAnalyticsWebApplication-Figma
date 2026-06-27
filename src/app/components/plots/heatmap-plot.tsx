export function HeatmapPlot() {
  const rows = 40;
  const cols = 25;
  const cellSize = 12;
  const padding = { left: 80, right: 120, top: 40, bottom: 60 };

  // Generate heatmap data with some clustering patterns
  const generateHeatmapData = () => {
    const data: number[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        // Create clustered patterns
        const cluster1 = i < rows / 2 && j < cols / 2;
        const cluster2 = i >= rows / 2 && j >= cols / 2;
        const base = cluster1 || cluster2 ? 0.7 : 0.3;
        row.push(base + Math.random() * 0.3);
      }
      data.push(row);
    }
    return data;
  };

  const data = generateHeatmapData();

  const getColor = (value: number) => {
    const colors = [
      { stop: 0, color: "#3b82f6" }, // blue
      { stop: 0.5, color: "#fafafa" }, // white
      { stop: 1, color: "#ef4444" }, // red
    ];

    if (value <= 0.5) {
      const t = value * 2;
      return interpolateColor(colors[0].color, colors[1].color, t);
    } else {
      const t = (value - 0.5) * 2;
      return interpolateColor(colors[1].color, colors[2].color, t);
    }
  };

  const interpolateColor = (color1: string, color2: string, t: number) => {
    const c1 = parseInt(color1.slice(1), 16);
    const c2 = parseInt(color2.slice(1), 16);
    const r1 = (c1 >> 16) & 255;
    const g1 = (c1 >> 8) & 255;
    const b1 = c1 & 255;
    const r2 = (c2 >> 16) & 255;
    const g2 = (c2 >> 8) & 255;
    const b2 = c2 & 255;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };

  const width = cols * cellSize + padding.left + padding.right;
  const height = rows * cellSize + padding.top + padding.bottom;

  const sampleLabels = Array.from({ length: cols }, (_, i) => {
    const group = i < cols / 2 ? "AD" : "Ctrl";
    return `${group}_${String(i + 1).padStart(2, "0")}`;
  });

  const featureLabels = [
    "Glutamate",
    "Leucine",
    "Phenylalanine",
    "Valine",
    "Isoleucine",
    "Arginine",
    "Proline",
    "Serine",
    "Threonine",
    "Alanine",
  ];

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      {/* Background */}
      <rect width={width} height={height} fill="transparent" />

      {/* Heatmap cells */}
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {data.map((row, i) =>
          row.map((value, j) => (
            <rect
              key={`${i}-${j}`}
              x={j * cellSize}
              y={i * cellSize}
              width={cellSize}
              height={cellSize}
              fill={getColor(value)}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.5"
            />
          ))
        )}
      </g>

      {/* Sample labels (top) */}
      <g transform={`translate(${padding.left}, ${padding.top - 5})`}>
        {sampleLabels.map((label, i) => (
          <text
            key={i}
            x={i * cellSize + cellSize / 2}
            y={0}
            fontSize="7"
            fill="currentColor"
            textAnchor="end"
            transform={`rotate(-45, ${i * cellSize + cellSize / 2}, 0)`}
            className="fill-muted-foreground"
          >
            {label}
          </text>
        ))}
      </g>

      {/* Feature labels (left) - show only first 10 */}
      <g transform={`translate(${padding.left - 5}, ${padding.top})`}>
        {featureLabels.map((label, i) => {
          const idx = Math.floor((i * rows) / featureLabels.length);
          return (
            <text
              key={i}
              x={0}
              y={idx * cellSize + cellSize / 2}
              fontSize="8"
              fill="currentColor"
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground"
            >
              {label}
            </text>
          );
        })}
      </g>

      {/* Color scale legend */}
      <g transform={`translate(${padding.left + cols * cellSize + 20}, ${padding.top})`}>
        <text fontSize="9" fill="currentColor" className="fill-muted-foreground">
          Expression
        </text>
        {Array.from({ length: 100 }, (_, i) => (
          <rect
            key={i}
            x={0}
            y={20 + i * 1.5}
            width={15}
            height={1.5}
            fill={getColor(1 - i / 100)}
          />
        ))}
        <text
          y={25}
          x={20}
          fontSize="8"
          fill="currentColor"
          className="fill-muted-foreground"
        >
          High
        </text>
        <text
          y={170}
          x={20}
          fontSize="8"
          fill="currentColor"
          className="fill-muted-foreground"
        >
          Low
        </text>
      </g>

      {/* Dendrogram (simplified top) */}
      <g transform={`translate(${padding.left}, ${padding.top - 30})`}>
        <path
          d={`M ${cols * cellSize * 0.25} 0 L ${cols * cellSize * 0.25} 10 L ${cols * cellSize * 0.5} 10 L ${cols * cellSize * 0.5} 0`}
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          className="stroke-violet-500"
        />
        <path
          d={`M ${cols * cellSize * 0.75} 0 L ${cols * cellSize * 0.75} 10 L ${cols * cellSize} 10 L ${cols * cellSize} 0`}
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          className="stroke-cyan-500"
        />
        <path
          d={`M ${cols * cellSize * 0.5} 10 L ${cols * cellSize * 0.5} 20 L ${cols * cellSize * 0.875} 20 L ${cols * cellSize * 0.875} 10`}
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          className="stroke-muted-foreground"
        />
      </g>
    </svg>
  );
}
