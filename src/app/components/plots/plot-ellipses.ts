/** 95% bivariate normal confidence ellipse (ggplot stat_ellipse equivalent). */
const CHI2_95 = 5.991;

export interface Point2D {
  x: number;
  y: number;
}

export function confidenceEllipse(
  points: Point2D[],
  level = 0.95,
  segments = 80,
): Point2D[] | null {
  if (points.length < 2) return null;

  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;

  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  cxx /= n - 1;
  cyy /= n - 1;
  cxy /= n - 1;

  const trace = cxx + cyy;
  const det = cxx * cyy - cxy * cxy;
  const disc = Math.max(0, trace * trace / 4 - det);
  const lambda1 = trace / 2 + Math.sqrt(disc);
  const lambda2 = trace / 2 - Math.sqrt(disc);

  const angle = Math.abs(cxy) < 1e-12 && cxx >= cyy ? 0 : Math.atan2(lambda1 - cxx, cxy);
  const chi2 = level === 0.95 ? CHI2_95 : 2.772;
  const a = Math.sqrt(Math.max(0, lambda1 * chi2));
  const b = Math.sqrt(Math.max(0, lambda2 * chi2));

  const ellipse: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (2 * Math.PI * i) / segments;
    const ex = a * Math.cos(t);
    const ey = b * Math.sin(t);
    ellipse.push({
      x: mx + ex * Math.cos(angle) - ey * Math.sin(angle),
      y: my + ex * Math.sin(angle) + ey * Math.cos(angle),
    });
  }
  return ellipse;
}
