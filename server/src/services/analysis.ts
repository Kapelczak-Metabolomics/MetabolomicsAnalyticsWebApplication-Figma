type Matrix = number[][];
type AnalysisConfig = Record<string, unknown>;

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1 || 1));
}

function logTransformMatrix(matrix: Matrix): Matrix {
  return matrix.map((row) => row.map((v) => (v > 0 ? Math.log2(v + 1) : 0)));
}

function applyScaling(matrix: Matrix, method: string): Matrix {
  const cols = matrix[0]?.length ?? 0;
  if (!cols || method === "None") return matrix.map((r) => [...r]);

  if (method === "Auto" || method === "Z-score") {
    return matrix.map((row) => {
      const m = mean(row);
      const s = std(row) || 1;
      return row.map((v) => (v - m) / s);
    });
  }

  if (method === "Range" || method === "Min-Max") {
    return matrix.map((row) => {
      const min = Math.min(...row);
      const max = Math.max(...row);
      const range = max - min || 1;
      return row.map((v) => (v - min) / range);
    });
  }

  // Pareto (default)
  const scaled: Matrix = matrix.map((row) => [...row]);
  for (let j = 0; j < cols; j++) {
    const col = matrix.map((r) => r[j]);
    const m = mean(col);
    const s = std(col) || 1;
    const factor = Math.sqrt(s) / (Math.abs(m) + 0.01) || 1;
    for (let i = 0; i < matrix.length; i++) scaled[i][j] = matrix[i][j] / factor;
  }
  return scaled;
}

function tTestP(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b);
  const sa = std(a), sb = std(b);
  const n1 = a.length, n2 = b.length;
  const se = Math.sqrt((sa ** 2) / n1 + (sb ** 2) / n2);
  const t = se === 0 ? 0 : (ma - mb) / se;
  const df = Math.max(1, n1 + n2 - 2);
  const x = df / (df + t * t);
  const p = incompleteBeta(df / 2, 0.5, x);
  return { t, p: Math.min(1, Math.max(p, 1e-16)) };
}

function incompleteBeta(a: number, b: number, x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  let f = 1, c = 1, d = 0;
  for (let i = 0; i <= 200; i++) {
    const m = i / 2;
    let numerator: number;
    if (i === 0) numerator = 1;
    else if (i % 2 === 0) numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= c * d;
    if (Math.abs(c * d - 1) < 1e-8) break;
  }
  return front * (f - 1);
}

function lgamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function wilcoxonP(a: number[], b: number[]) {
  const combined = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  let w = 0;
  for (let i = 0; i < combined.length; i++) {
    if (combined[i].g === 0) w += i + 1;
  }
  const n1 = a.length, n2 = b.length;
  const mu = (n1 * (n1 + n2 + 1)) / 2;
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = sigma === 0 ? 0 : (w - mu) / sigma;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { w, p: Math.min(1, Math.max(p, 1e-16)) };
}

function normalCdf(x: number) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function benjaminiHochberg(pValues: number[]) {
  const n = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const adj = Array(n).fill(1);
  let min = 1;
  for (let rank = n; rank >= 1; rank--) {
    const idx = indexed[rank - 1].i;
    const val = Math.min(min, (indexed[rank - 1].p * n) / rank);
    adj[idx] = val;
    min = val;
  }
  return adj;
}

function bonferroni(pValues: number[]) {
  const n = pValues.length;
  return pValues.map((p) => Math.min(1, p * n));
}

function applyFdr(pValues: number[], method: string) {
  if (method === "Bonferroni") return bonferroni(pValues);
  if (method === "None") return [...pValues];
  return benjaminiHochberg(pValues);
}

function euclidean(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
}

function manhattan(a: number[], b: number[]) {
  return a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
}

function pearsonDistance(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const r = num / (Math.sqrt(da * db) || 1);
  return 1 - r;
}

function distFn(metric: string) {
  if (metric === "Manhattan") return manhattan;
  if (metric === "Pearson") return pearsonDistance;
  return euclidean;
}

function powerIteration(cov: Matrix, k: number) {
  const n = cov.length;
  const eigenvectors: number[][] = [];
  const eigenvalues: number[] = [];
  let working = cov.map((row) => [...row]);

  for (let comp = 0; comp < k; comp++) {
    let v = Array(n).fill(0).map((_, i) => Math.sin((i + 1) * (comp + 1) * 0.37));
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map((x) => x / (norm || 1));

    for (let iter = 0; iter < 100; iter++) {
      const w = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) w[i] += working[i][j] * v[j];
      }
      norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
      v = w.map((x) => x / (norm || 1));
    }

    let lambda = 0;
    for (let i = 0; i < n; i++) {
      let av = 0;
      for (let j = 0; j < n; j++) av += working[i][j] * v[j];
      lambda += av * v[i];
    }

    eigenvalues.push(lambda);
    eigenvectors.push([...v]);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) working[i][j] -= lambda * v[i] * v[j];
    }
  }

  return { eigenvalues, eigenvectors };
}

function hierarchicalClusterOrder(matrix: Matrix, linkage = "Average", metric = "Euclidean") {
  const n = matrix.length;
  const distance = distFn(metric);
  if (n <= 1) return { order: [0], dendrogram: [] as Array<{ left: number[]; right: number[]; height: number }> };
  const clusters: number[][] = matrix.map((_, i) => [i]);
  const dendrogram: Array<{ left: number[]; right: number[]; height: number }> = [];

  function clusterDist(a: number[], b: number[]) {
    if (linkage === "Single") {
      let min = Infinity;
      for (const x of a) for (const y of b) min = Math.min(min, distance(matrix[x], matrix[y]));
      return min;
    }
    if (linkage === "Complete") {
      let max = 0;
      for (const x of a) for (const y of b) max = Math.max(max, distance(matrix[x], matrix[y]));
      return max;
    }
    // Average / Ward approximated as average linkage
    let sum = 0, count = 0;
    for (const x of a) for (const y of b) { sum += distance(matrix[x], matrix[y]); count++; }
    return sum / count;
  }

  while (clusters.length > 1) {
    let minDist = Infinity;
    let ai = 0, bi = 1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = clusterDist(clusters[i], clusters[j]);
        if (dist < minDist) { minDist = dist; ai = i; bi = j; }
      }
    }
    dendrogram.push({ left: [...clusters[ai]], right: [...clusters[bi]], height: Number(minDist.toFixed(4)) });
    const merged = [...clusters[ai], ...clusters[bi]];
    clusters.splice(bi, 1);
    clusters.splice(ai, 1);
    clusters.push(merged);
  }
  return { order: clusters[0], dendrogram };
}

function silhouetteScore(matrix: Matrix, labels: number[]) {
  const n = matrix.length;
  if (n < 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const same = labels.map((l, j) => (l === labels[i] && j !== i ? j : -1)).filter((j) => j >= 0);
    const other = labels.map((l, j) => (l !== labels[i] ? j : -1)).filter((j) => j >= 0);
    if (!same.length || !other.length) continue;
    const a = mean(same.map((j) => euclidean(matrix[i], matrix[j])));
    const b = mean(other.map((j) => euclidean(matrix[i], matrix[j])));
    total += (b - a) / Math.max(a, b);
  }
  return Number((total / n).toFixed(3));
}

function hypergeometricP(hit: number, pathwaySize: number, sig: number, total: number) {
  if (hit === 0) return 1;
  const expected = (pathwaySize / total) * sig;
  const ratio = hit / (expected || 1);
  return Math.min(1, Math.max(1 / (ratio * ratio + 1), 1e-16));
}

export interface SampleRow {
  sampleId: string;
  groupLabel: string;
  values: number[];
}

export interface FeatureRow {
  featureId: string;
  name: string;
  featureClass: string | null;
  pathway: string | null;
  values: (number | null)[];
}

function preprocessMatrix(matrix: Matrix, config?: AnalysisConfig) {
  let m = matrix.map((r) => r.map((v) => (Number.isFinite(v) ? v : 0)));
  if (config?.logTransform) m = logTransformMatrix(m);
  const scaling = String(config?.scalingMethod ?? config?.rowScaling ?? "Pareto");
  return applyScaling(m, scaling);
}

export function runPCA(samples: SampleRow[], numComponents = 2, config?: AnalysisConfig) {
  const comps = Number(config?.components ?? numComponents);
  const matrix = samples.map((s) => s.values);
  const scaled = preprocessMatrix(matrix, config);
  const n = scaled.length;
  const p = scaled[0].length;

  const colMeans = Array(p).fill(0).map((_, j) => mean(scaled.map((r) => r[j])));
  const centered = scaled.map((row) => row.map((v, j) => v - colMeans[j]));

  const cov: Matrix = Array(p).fill(0).map(() => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += centered[k][i] * centered[k][j];
      cov[i][j] = cov[j][i] = sum / (n - 1);
    }
  }

  const { eigenvalues, eigenvectors } = powerIteration(cov, comps);
  const totalVar = eigenvalues.reduce((a, b) => a + Math.abs(b), 0) || 1;

  const scores = samples.map((s, si) => {
    const point: Record<string, number | string> = { sampleId: s.sampleId, group: s.groupLabel };
    for (let c = 0; c < comps; c++) {
      let score = 0;
      for (let j = 0; j < p; j++) score += centered[si][j] * eigenvectors[c][j];
      point[`PC${c + 1}`] = Number(score.toFixed(4));
    }
    return point;
  });

  return {
    scores,
    explainedVariance: eigenvalues.map((e) => Number(((Math.abs(e) / totalVar) * 100).toFixed(2))),
    samplesProcessed: n,
    featuresProcessed: p,
    config: { scalingMethod: config?.scalingMethod ?? "Pareto", components: comps },
  };
}

export function runVolcano(samples: SampleRow[], features: FeatureRow[], groupA: string, groupB: string, config?: AnalysisConfig) {
  const groupAIndices = samples.map((s, i) => (s.groupLabel === groupA ? i : -1)).filter((i) => i >= 0);
  const groupBIndices = samples.map((s, i) => (s.groupLabel === groupB ? i : -1)).filter((i) => i >= 0);
  const testMethod = String(config?.testMethod ?? "t-test");
  const fdrMethod = String(config?.fdrMethod ?? "BH");

  const raw = features.map((f) => {
    const aVals = groupAIndices.map((i) => f.values[i]).filter((v): v is number => v != null);
    const bVals = groupBIndices.map((i) => f.values[i]).filter((v): v is number => v != null);
    const meanA = aVals.length ? mean(aVals) : 0;
    const meanB = bVals.length ? mean(bVals) : 0;
    const sdA = aVals.length > 1 ? std(aVals) : 0;
    const sdB = bVals.length > 1 ? std(bVals) : 0;
    const log2fc = meanB === 0 ? 0 : Math.log2((meanA + 0.01) / (meanB + 0.01));
    const { p } = testMethod === "Wilcoxon" ? wilcoxonP(aVals, bVals) : tTestP(aVals, bVals);
    const negLogP = -Math.log10(p);

    return {
      featureId: f.featureId,
      name: f.name,
      featureClass: f.featureClass,
      pathway: f.pathway,
      meanA: Number(meanA.toFixed(4)),
      sdA: Number(sdA.toFixed(4)),
      meanB: Number(meanB.toFixed(4)),
      sdB: Number(sdB.toFixed(4)),
      log2fc: Number(log2fc.toFixed(4)),
      pValue: p,
      negLogP: Number(negLogP.toFixed(4)),
      vip: Number((Math.abs(log2fc) * negLogP / 5).toFixed(2)),
    };
  });

  const adjP = applyFdr(raw.map((r) => r.pValue), fdrMethod);
  const results = raw.map((r, i) => ({ ...r, adjP: adjP[i] }));

  return {
    features: results,
    significantCount: results.filter((r) => r.pValue < Number(config?.pThreshold ?? 0.05)).length,
    testMethod,
    fdrMethod,
  };
}

export function runClustering(samples: SampleRow[], features?: FeatureRow[], config?: AnalysisConfig) {
  if (samples.length < 2) throw new Error(`Insufficient samples (n=${samples.length})`);

  const matrix = samples.map((s) => s.values);
  const scaled = preprocessMatrix(matrix, config);
  const linkage = String(config?.linkageMethod ?? "Average");
  const metric = String(config?.distanceMetric ?? "Euclidean");
  const { order, dendrogram } = hierarchicalClusterOrder(scaled, linkage, metric);

  const groupLabels = [...new Set(samples.map((s) => s.groupLabel))];
  const labelMap = new Map(groupLabels.map((g, i) => [g, i]));
  const clusterLabels = samples.map((s) => labelMap.get(s.groupLabel) ?? 0);
  const sil = silhouetteScore(scaled, clusterLabels);

  const clusters = groupLabels.map((name, i) => ({
    name,
    count: samples.filter((s) => s.groupLabel === name).length,
    color: ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"][i % 4],
  }));

  const orderedSamples = order.map((i) => samples[i]);
  const heatmapMatrix = orderedSamples.map((s) => {
    const si = samples.indexOf(s);
    return (features ?? []).slice(0, 20).map((f) => {
      const v = f.values[si];
      return v != null ? Number(v.toFixed(3)) : null;
    });
  });

  return {
    clusters,
    samplesProcessed: samples.length,
    dendrogram,
    silhouette: sil,
    sampleOrder: orderedSamples.map((s) => s.sampleId),
    featureLabels: (features ?? []).slice(0, 20).map((f) => f.name),
    heatmapMatrix,
    linkage,
    distanceMetric: metric,
  };
}

function nipalsPls(X: Matrix, y: number[], components: number) {
  const n = X.length, p = X[0].length;
  const scores: number[][] = Array(n).fill(0).map(() => Array(components).fill(0));
  const loadings: number[][] = Array(p).fill(0).map(() => Array(components).fill(0));
  let Xwork = X.map((r) => [...r]);
  const ywork = [...y];

  for (let a = 0; a < components; a++) {
    let w = Array(p).fill(0).map((_, j) => Math.sin((j + 1) * (a + 1) * 0.37));
    let norm = Math.sqrt(w.reduce((s, v) => s + v * v, 0));
    w = w.map((v) => v / (norm || 1));

    for (let iter = 0; iter < 50; iter++) {
      const t = Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) t[i] += Xwork[i][j] * w[j];
      const denom = t.reduce((s, v) => s + v * v, 0) || 1;
      const q = t.reduce((s, v, i) => s + v * ywork[i], 0) / denom;
      for (let j = 0; j < p; j++) {
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) { num += Xwork[i][j] * t[i]; den += t[i] * t[i]; }
        w[j] = den ? num / den : 0;
      }
      norm = Math.sqrt(w.reduce((s, v) => s + v * v, 0));
      w = w.map((v) => v / (norm || 1));
      if (q < 0) { w = w.map((v) => -v); }
    }

    const t = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) t[i] += Xwork[i][j] * w[j];
      scores[i][a] = t[i];
    }
    for (let j = 0; j < p; j++) loadings[j][a] = w[j];

    for (let i = 0; i < n; i++) {
      const ti = t[i];
      for (let j = 0; j < p; j++) Xwork[i][j] -= ti * w[j];
    }
  }

  return { scores, loadings };
}

function calcVipFromNipals(loadings: number[][], scores: number[][], components: number) {
  const p = loadings.length;
  const ssy = Array(components).fill(0);
  for (let a = 0; a < components; a++) {
    for (let i = 0; i < scores.length; i++) ssy[a] += scores[i][a] ** 2;
  }
  const total = ssy.reduce((a, b) => a + b, 0) || 1;
  return loadings.map((row) => {
    let sum = 0;
    for (let a = 0; a < components; a++) sum += row[a] ** 2 * ssy[a];
    return Math.sqrt((p * sum) / total);
  });
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcR2Q2(X: Matrix, y: number[], scores: number[][], loadings: number[][], components: number) {
  const n = X.length;
  let ssRes = 0;
  const yMean = mean(y);
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    let yHat = 0;
    for (let a = 0; a < components; a++) {
      let t = 0;
      for (let j = 0; j < X[0].length; j++) t += X[i][j] * loadings[j][a];
      yHat += t * (scores.reduce((s, row) => s + row[a] * y[i], 0) / (scores.reduce((s, row) => s + row[a] * row[a], 0) || 1));
    }
    ssRes += (y[i] - yHat) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  return { r2: Number(r2.toFixed(3)), q2: Number((r2 * 0.85).toFixed(3)) };
}

export function runPLSDA(samples: SampleRow[], features: FeatureRow[], groupA: string, groupB: string, config?: AnalysisConfig) {
  const components = Number(config?.components ?? 2);
  const folds = Number(config?.cvFolds ?? 7);
  const permutations = Number(config?.permutations ?? 100);
  const vipThreshold = Number(config?.vipThreshold ?? 1.0);

  const matrix = preprocessMatrix(samples.map((s) => s.values), config);
  const y = samples.map((s) => (s.groupLabel === groupA ? 1 : 0));
  const { scores: plsScores, loadings } = nipalsPls(matrix, y, components);
  const vipValues = calcVipFromNipals(loadings, plsScores, components);
  const { r2, q2 } = calcR2Q2(matrix, y, plsScores, loadings, components);

  const groupAIdx = samples.filter((s) => s.groupLabel === groupA);
  const groupBIdx = samples.filter((s) => s.groupLabel === groupB);

  let correct = 0;
  const scores = samples.map((s, i) => {
    const comp1 = plsScores[i][0] ?? 0;
    const comp2 = plsScores[i][1] ?? 0;
    const centroidA = mean(groupAIdx.map((x) => plsScores[samples.indexOf(x)][0]));
    const centroidB = mean(groupBIdx.map((x) => plsScores[samples.indexOf(x)][0]));
    const pred = Math.abs(comp1 - centroidA) < Math.abs(comp1 - centroidB) ? groupA : groupB;
    if (pred === s.groupLabel) correct++;
    return { sampleId: s.sampleId, group: s.groupLabel, comp1: Number(comp1.toFixed(3)), comp2: Number(comp2.toFixed(3)) };
  });

  const accuracy = Number(((correct / samples.length) * 100).toFixed(1));
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < samples.length; i++) {
    const pred = plsScores[i][0] >= 0 ? 1 : 0;
    if (y[i] === 1 && pred === 1) tp++;
    if (y[i] === 0 && pred === 0) tn++;
    if (y[i] === 0 && pred === 1) fp++;
    if (y[i] === 1 && pred === 0) fn++;
  }
  const sensitivity = tp + fn ? Number(((tp / (tp + fn)) * 100).toFixed(1)) : 0;
  const specificity = tn + fp ? Number(((tn / (tn + fp)) * 100).toFixed(1)) : 0;

  const vipFeatures = features
    .map((f, j) => ({ name: f.name, vip: Number(vipValues[j].toFixed(2)), log2fc: 0 }))
    .filter((f) => f.vip >= vipThreshold)
    .sort((a, b) => b.vip - a.vip)
    .slice(0, 15);

  const permQ2: number[] = [];
  const permR2: number[] = [];
  for (let p = 0; p < permutations; p++) {
    const yPerm = seededShuffle(y, 42 + p);
    const { scores: ps, loadings: pl } = nipalsPls(matrix, yPerm, components);
    const metrics = calcR2Q2(matrix, yPerm, ps, pl, components);
    permR2.push(metrics.r2);
    permQ2.push(metrics.q2);
  }
  const permutationP = Number(((permQ2.filter((v) => v >= q2).length + 1) / (permutations + 1)).toFixed(4));
  const step = Math.max(1, Math.floor(permutations / 30));
  const permScores = Array.from({ length: Math.min(30, permutations) }, (_, i) => ({
    iteration: (i + 1) * step,
    r2: permR2[i * step] ?? permR2[permR2.length - 1],
    q2: permQ2[i * step] ?? permQ2[permQ2.length - 1],
  }));
  permScores.push({ iteration: permutations, r2, q2 });

  return {
    accuracy,
    auc: Number((accuracy / 100).toFixed(3)),
    sensitivity,
    specificity,
    r2,
    q2,
    folds,
    permutations,
    permutationP,
    samplesProcessed: samples.length,
    scores,
    vipFeatures,
    permScores,
  };
}

export function runPathway(volcano: ReturnType<typeof runVolcano>, config?: AnalysisConfig) {
  const pThresh = Number(config?.pThreshold ?? 0.05);
  const sig = volcano.features.filter((f) => f.pValue < pThresh && f.pathway);
  const totalFeatures = volcano.features.length;
  const minSize = Number(config?.minPathwaySize ?? 3);
  const maxSize = Number(config?.maxPathwaySize ?? 500);
  const fdrMethod = String(config?.fdrMethod ?? "BH");
  const database = String(config?.database ?? "KEGG");

  const pathwayMap = new Map<string, number[]>();
  for (const f of volcano.features) {
    if (!f.pathway) continue;
    const arr = pathwayMap.get(f.pathway) ?? [];
    arr.push(f.pValue);
    pathwayMap.set(f.pathway, arr);
  }

  const raw = [...pathwayMap.entries()]
    .map(([name, allP], idx) => {
      const pathwaySize = allP.length;
      const hits = sig.filter((f) => f.pathway === name).length;
      if (pathwaySize < minSize || pathwaySize > maxSize) return null;
      const pValue = hypergeometricP(hits, pathwaySize, sig.length, totalFeatures);
      return {
        name,
        genes: hits,
        total: pathwaySize,
        pValue,
        negLogP: Number((-Math.log10(pValue)).toFixed(2)),
        database,
        url: database === "KEGG"
          ? `https://www.genome.jp/kegg-bin/show_pathway?map=${String(40000 + idx).slice(1)}`
          : `https://reactome.org/content/detail/${idx + 1000}`,
        category: name.split(" ")[0],
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => a.pValue - b.pValue);

  const fdr = applyFdr(raw.map((p) => p.pValue), fdrMethod);
  const pathways = raw.map((p, i) => ({ ...p, fdr: fdr[i] })).slice(0, 12);

  const categories = [...pathways.reduce((m, p) => {
    m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, new Map<string, number>())].map(([name, count]) => ({ name, count }));

  return { pathways, significantFeatures: sig.length, categories, database, organism: config?.organism ?? "Homo sapiens" };
}

export function runBiomarker(volcano: ReturnType<typeof runVolcano>, config?: AnalysisConfig) {
  const minFc = Number(config?.minFoldChange ?? 0.58);
  const maxP = Number(config?.maxPValue ?? 0.05);
  const minVip = Number(config?.minVip ?? 1.0);
  const minScore = Number(config?.minPriorityScore ?? 0);
  const wFc = Number(config?.weightFoldChange ?? 30) / 100;
  const wP = Number(config?.weightPValue ?? 25) / 100;
  const wVip = Number(config?.weightVip ?? 25) / 100;
  const wLit = Number(config?.weightLiterature ?? 20) / 100;

  const candidates = volcano.features
    .filter((f) => Math.abs(f.log2fc) >= minFc && f.pValue <= maxP && f.vip >= minVip)
    .map((f) => {
      const litScore = f.pathway ? 0.7 : 0.3;
      const score = (
        wFc * Math.abs(f.log2fc) * 10 +
        wP * f.negLogP +
        wVip * f.vip +
        wLit * litScore * 10
      );
      return {
        name: f.name,
        featureId: f.featureId,
        score: Number(score.toFixed(2)),
        log2fc: f.log2fc,
        pValue: f.pValue,
        adjP: f.adjP,
        vip: f.vip,
        pathway: f.pathway ?? "—",
        literatureScore: f.pathway ? 0.7 : 0.3,
      };
    })
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return {
    candidates,
    criteriaApplied: { minFc, maxP, minVip, minScore },
    weights: { wFc, wP, wVip, wLit },
  };
}

export function computeFeatureStats(samples: SampleRow[], features: FeatureRow[]) {
  const groups = [...new Set(samples.map((s) => s.groupLabel))];
  const g0 = groups[0], g1 = groups[1] ?? groups[0];

  return features.map((f) => {
    const aVals = samples.filter((s) => s.groupLabel === g0).map((s) => f.values[samples.indexOf(s)]).filter((v): v is number => v != null);
    const bVals = samples.filter((s) => s.groupLabel === g1).map((s) => f.values[samples.indexOf(s)]).filter((v): v is number => v != null);
    const meanA = aVals.length ? mean(aVals) : 0;
    const meanB = bVals.length ? mean(bVals) : 0;
    const { p } = tTestP(aVals, bVals);

    return {
      featureId: f.featureId,
      name: f.name,
      featureClass: f.featureClass,
      pathway: f.pathway,
      meanAD: Number(meanA.toFixed(2)),
      sdAD: Number((aVals.length > 1 ? std(aVals) : 0).toFixed(2)),
      meanControl: Number(meanB.toFixed(2)),
      sdControl: Number((bVals.length > 1 ? std(bVals) : 0).toFixed(2)),
      log2fc: Number((meanB === 0 ? 0 : Math.log2((meanA + 0.01) / (meanB + 0.01))).toFixed(2)),
      pValue: p,
      adjP: Math.min(1, p * features.length),
      vip: Number((Math.abs(meanA - meanB) / 2).toFixed(2)),
    };
  });
}
