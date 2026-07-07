/** Group region geometry for PCA / PLS-DA score plots. */
const CHI2_95 = 5.991;

export interface Point2D {
  x: number;
  y: number;
}

export function circlePoints(cx: number, cy: number, radius: number, segments = 72): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    pts.push({ x: cx + radius * Math.cos(t), y: cy + radius * Math.sin(t) });
  }
  return pts;
}

/**
 * Enclosing circle for a sample group (ggplot-style visible grouping).
 * Uses max sample distance from centroid with 95% chi-square scaling,
 * plus a floor radius so groups never collapse to a line.
 */
export function groupConfidenceCircle(
  points: Point2D[],
  plotSpan: number,
  level = 0.95,
): Point2D[] | null {
  if (!points.length) return null;

  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;

  const distances = points.map((p) => Math.hypot(p.x - mx, p.y - my));
  const maxDist = Math.max(...distances, 0);
  const meanDist = distances.reduce((a, b) => a + b, 0) / n;

  const chiScale = level === 0.95 ? Math.sqrt(CHI2_95 / 2) : 1.2;
  const dataRadius = n === 1
    ? plotSpan * 0.08
    : Math.max(maxDist * 1.25, meanDist * chiScale * 1.35);

  const minRadius = plotSpan * 0.14;
  const radius = Math.max(dataRadius, minRadius);

  return circlePoints(mx, my, radius);
}

/** @deprecated Use groupConfidenceCircle — covariance ellipses collapse to lines when PC2 variance is tiny. */
export function confidenceEllipse(
  points: Point2D[],
  level = 0.95,
  segments = 80,
): Point2D[] | null {
  return groupConfidenceCircle(points, 1, level);
}
