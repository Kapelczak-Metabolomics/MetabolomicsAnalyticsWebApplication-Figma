/** Dynamic Plotly margins and tick sizing for heatmaps with long feature/sample names. */
export function computeHeatmapLayout(
  featureLabels: string[],
  sampleLabels: string[],
  sampleCount: number
) {
  const nFeatures = Math.max(1, featureLabels.length);
  const maxFeatureLen = featureLabels.reduce((m, l) => Math.max(m, l.length), 0);
  const maxSampleLen = sampleLabels.reduce((m, l) => Math.max(m, l.length), 0);

  const tickFontSize = Math.max(
    7,
    Math.min(11, Math.floor(100 / (nFeatures * 0.42)), Math.floor(72 / Math.max(6, maxFeatureLen)))
  );

  const tickAngle =
    maxFeatureLen > 18 || nFeatures > 16 ? -70 : maxFeatureLen > 12 || nFeatures > 12 ? -55 : nFeatures > 8 ? -45 : -35;

  const radians = (Math.abs(tickAngle) * Math.PI) / 180;
  const labelStack = tickFontSize * 1.35 + maxFeatureLen * Math.sin(radians) * (tickFontSize * 0.42);
  const topMargin = Math.max(100, Math.min(260, Math.ceil(56 + labelStack)));

  const leftMargin = Math.max(72, Math.min(180, Math.ceil(maxSampleLen * 6.5 + 28)));
  const rightMargin = 96;
  const bottomMargin = 48;
  const height = Math.max(380, sampleCount * 20 + topMargin + bottomMargin + 40);
  const showEveryNth = nFeatures > 24 ? Math.ceil(nFeatures / 24) : 1;

  return {
    tickFontSize,
    tickAngle,
    topMargin,
    leftMargin,
    rightMargin,
    bottomMargin,
    height,
    showEveryNth,
  };
}

export function truncateLabel(label: string, max = 22): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}
