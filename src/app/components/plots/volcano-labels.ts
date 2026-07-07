/** Repulsion layout for volcano plot feature labels (ggrepel-style). */

export interface VolcanoLabelPoint {
  log2fc: number;
  negLogP: number;
  name: string;
}

export interface PlacedVolcanoLabel {
  text: string;
  ax: number;
  ay: number;
  pointX: number;
  pointY: number;
}

interface BBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

function estimateWidth(text: string, xSpan: number): number {
  return Math.min(xSpan * 0.38, Math.max(xSpan * 0.06, text.length * xSpan * 0.011));
}

function overlaps(a: BBox, b: BBox, pad: number): boolean {
  return !(a.right + pad < b.left || a.left - pad > b.right || a.top + pad < b.bottom || a.bottom - pad > b.top);
}

export function placeVolcanoLabels(
  points: VolcanoLabelPoint[],
  xMaxAbs: number,
  yMax: number,
): PlacedVolcanoLabel[] {
  if (!points.length) return [];

  const xSpan = xMaxAbs * 2;
  const ySpan = yMax;
  const labelH = ySpan * 0.042;
  const pad = xSpan * 0.012;

  const sorted = [...points].sort((a, b) => b.negLogP - a.negLogP || Math.abs(b.log2fc) - Math.abs(a.log2fc));
  const placedBoxes: BBox[] = [];
  const results: PlacedVolcanoLabel[] = [];

  for (const p of sorted) {
    const w = estimateWidth(p.name, xSpan);
    const baseOffsets = [
      { dx: 0, dy: labelH * 1.1 },
      { dx: w * 0.45, dy: labelH * 1.0 },
      { dx: -w * 0.45, dy: labelH * 1.0 },
      { dx: w * 0.7, dy: labelH * 0.4 },
      { dx: -w * 0.7, dy: labelH * 0.4 },
      { dx: 0, dy: labelH * 2.0 },
      { dx: 0, dy: labelH * 3.0 },
    ];

    let placed: PlacedVolcanoLabel | null = null;

    for (const off of baseOffsets) {
      let ax = p.log2fc + off.dx;
      let ay = p.negLogP + off.dy;

      for (let step = 0; step < 24; step++) {
        const box: BBox = {
          left: ax - w / 2,
          right: ax + w / 2,
          bottom: ay - labelH,
          top: ay,
        };

        const hitsPoint = Math.hypot(ax - p.log2fc, ay - p.negLogP) < labelH * 0.35;
        const collision = placedBoxes.some((b) => overlaps(box, b, pad));

        if (!collision && !hitsPoint) {
          placed = { text: p.name, ax, ay, pointX: p.log2fc, pointY: p.negLogP };
          placedBoxes.push(box);
          break;
        }
        ay += labelH * 0.55;
      }
      if (placed) break;
    }

    if (!placed) {
      const ax = p.log2fc;
      const ay = p.negLogP + labelH * (1 + results.length * 0.65);
      placed = { text: p.name, ax, ay, pointX: p.log2fc, pointY: p.negLogP };
      placedBoxes.push({
        left: ax - w / 2,
        right: ax + w / 2,
        bottom: ay - labelH,
        top: ay,
      });
    }

    results.push(placed);
  }

  return results;
}
