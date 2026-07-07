export interface DendrogramMerge {
  left: number[] | string;
  right: number[] | string;
  height: number;
}

interface DendrogramPlotProps {
  data?: DendrogramMerge[];
  labels?: string[];
  height?: number;
}

function asIndices(value: number[] | string): number[] {
  if (Array.isArray(value)) return value;
  return [];
}

function PlotEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function DendrogramPlot({ data = [], labels = [], height = 280 }: DendrogramPlotProps) {
  if (!data.length) return <PlotEmpty message="Run clustering to generate dendrogram" />;

  const n = labels.length || Math.max(...data.flatMap((d) => [...asIndices(d.left), ...asIndices(d.right)]), -1) + 1;
  if (n < 2) return <PlotEmpty message="Need at least two samples for dendrogram" />;

  const width = Math.max(480, n * 36 + 80);
  const pad = { left: 24, right: 24, top: 16, bottom: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxH = Math.max(...data.map((d) => d.height), 0.01);

  type Cluster = { indices: number[]; x: number; top: number };
  let clusters: Cluster[] = Array.from({ length: n }, (_, i) => ({
    indices: [i],
    x: (i + 0.5) / n,
    top: 0,
  }));

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  for (const merge of data) {
    const leftIdx = asIndices(merge.left);
    const rightIdx = asIndices(merge.right);
    const leftCluster = clusters.find((c) => c.indices.length === leftIdx.length && leftIdx.every((v) => c.indices.includes(v)));
    const rightCluster = clusters.find((c) => c !== leftCluster && c.indices.length === rightIdx.length && rightIdx.every((v) => c.indices.includes(v)));
    if (!leftCluster || !rightCluster) continue;

    const lx = leftCluster.x * plotW;
    const rx = rightCluster.x * plotW;
    const y0 = Math.max(leftCluster.top, rightCluster.top) * plotH / maxH;
    const y1 = (merge.height / maxH) * plotH;

    lines.push({ x1: lx, y1: y0, x2: lx, y2: y1 });
    lines.push({ x1: rx, y1: y0, x2: rx, y2: y1 });
    lines.push({ x1: lx, y1, x2: rx, y2: y1 });

    const merged: Cluster = {
      indices: [...leftCluster.indices, ...rightCluster.indices],
      x: (leftCluster.x + rightCluster.x) / 2,
      top: merge.height,
    };
    clusters = clusters.filter((c) => c !== leftCluster && c !== rightCluster);
    clusters.push(merged);
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sample dendrogram">
      <rect x={0} y={0} width={width} height={height} className="fill-card" />
      <g transform={`translate(${pad.left}, ${pad.top})`}>
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={plotH - l.y1} x2={l.x2} y2={plotH - l.y2} stroke="#64748b" strokeWidth={1.5} />
        ))}
        {Array.from({ length: n }, (_, i) => {
          const x = ((i + 0.5) / n) * plotW;
          return (
            <g key={i}>
              <line x1={x} y1={plotH} x2={x} y2={plotH + 6} stroke="#64748b" strokeWidth={1.5} />
              <text x={x} y={plotH + 20} fontSize={9} textAnchor="end" transform={`rotate(-45, ${x}, ${plotH + 20})`} className="fill-muted-foreground">
                {(labels[i] ?? `S${i + 1}`).slice(0, 12)}
              </text>
            </g>
          );
        })}
        <text x={plotW / 2} y={plotH + 44} fontSize={11} textAnchor="middle" className="fill-muted-foreground">Samples</text>
      </g>
    </svg>
  );
}
