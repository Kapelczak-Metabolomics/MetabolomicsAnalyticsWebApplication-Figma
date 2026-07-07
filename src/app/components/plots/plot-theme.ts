export const GROUP_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"];

export const PLOT_SIZE = { width: 720, height: 520 };

export const PLOT_PAD = { left: 84, right: 148, top: 40, bottom: 76 };

export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
}

export function paddedDomain(values: number[], padRatio = 0.12): [number, number] {
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * padRatio;
  return [min - pad, max + pad];
}

export function symmetricDomain(values: number[], padRatio = 0.12): [number, number] {
  const maxAbs = Math.max(...values.map(Math.abs), 0.01);
  const pad = maxAbs * padRatio;
  return [-maxAbs - pad, maxAbs + pad];
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = (span / count) / step;
  const niceStep = err >= 7.5 ? step * 10 : err >= 3.5 ? step * 5 : err >= 1.5 ? step * 2 : step;
  const start = Math.ceil(min / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let v = start; v <= max + niceStep * 0.001; v += niceStep) ticks.push(Number(v.toFixed(6)));
  return ticks.length ? ticks : [min, max];
}

export function formatTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

export function groupColor(index: number) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

export function heatColor(value: number, min: number, max: number) {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const low = { r: 30, g: 64, b: 175 };
  const mid = { r: 241, g: 245, b: 249 };
  const high = { r: 220, g: 38, b: 38 };
  const c = t < 0.5
    ? { r: low.r + (mid.r - low.r) * (t * 2), g: low.g + (mid.g - low.g) * (t * 2), b: low.b + (mid.b - low.b) * (t * 2) }
    : { r: mid.r + (high.r - mid.r) * ((t - 0.5) * 2), g: mid.g + (high.g - mid.g) * ((t - 0.5) * 2), b: mid.b + (high.b - mid.b) * ((t - 0.5) * 2) };
  return `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
}
