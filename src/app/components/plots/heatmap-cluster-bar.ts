/** Build discrete Plotly colorscale from group names. */
import { GROUP_COLORS } from "./plot-theme";

export function buildGroupColorMap(groups: string[]) {
  const unique = [...new Set(groups.filter(Boolean))];
  const map = new Map<string, string>();
  unique.forEach((g, i) => map.set(g, GROUP_COLORS[i % GROUP_COLORS.length]));
  return map;
}

export function groupIndices(groups: string[], colorMap: Map<string, string>) {
  const unique = [...colorMap.keys()];
  return groups.map((g) => Math.max(0, unique.indexOf(g)));
}

export function discreteColorscale(colorMap: Map<string, string>) {
  const entries = [...colorMap.entries()];
  if (!entries.length) return [[0, "#94a3b8"], [1, "#94a3b8"]] as [number, string][];
  if (entries.length === 1) return [[0, entries[0][1]], [1, entries[0][1]]] as [number, string][];
  return entries.map(([, color], i) => [i / (entries.length - 1), color] as [number, string]);
}

export function clusterBarLegend(colorMap: Map<string, string>) {
  return [...colorMap.entries()].map(([name, color]) => ({ name, color }));
}
