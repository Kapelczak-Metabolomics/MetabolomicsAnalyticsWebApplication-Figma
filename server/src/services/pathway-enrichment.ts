type AnalysisConfig = Record<string, unknown>;

const KEGG_REST = "https://rest.kegg.jp";
const KEGG_DELAY_MS = 340;

type VolcanoFeature = {
  name: string;
  featureId: string;
  pValue: number;
  pathway: string | null;
};

type PathwayRow = {
  name: string;
  genes: number;
  total: number;
  pValue: number;
  negLogP: number;
  database: string;
  url: string;
  category: string;
  fdr?: number;
};

const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 3600_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function keggGet(path: string): Promise<string> {
  const res = await fetch(`${KEGG_REST}${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`KEGG request failed (${res.status})`);
  return res.text();
}

function nCk(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let num = 1;
  for (let i = 0; i < k; i++) num = (num * (n - i)) / (i + 1);
  return num;
}

function hypergeomP(hits: number, pathwaySize: number, sig: number, total: number) {
  if (hits <= 0) return 1;
  const M = total;
  const n = pathwaySize;
  const N = sig;
  let p = 0;
  for (let x = hits; x <= Math.min(n, N); x++) {
    p += (nCk(n, x) * nCk(M - n, N - x)) / nCk(M, N);
  }
  return Math.min(1, Math.max(p, 1e-16));
}

function applyFdr(pvals: number[], method: string) {
  const n = pvals.length;
  if (!n) return [];
  if (method === "Bonferroni") return pvals.map((p) => Math.min(1, p * n));
  const order = [...pvals.entries()].sort((a, b) => a[1] - b[1]);
  const adj = Array(n).fill(1);
  let prev = 1;
  for (let rank = n; rank >= 1; rank--) {
    const [idx, p] = order[rank - 1];
    const val = Math.min(prev, (p * n) / rank);
    adj[idx] = val;
    prev = val;
  }
  return adj;
}

async function keggFindCompound(name: string): Promise<string | null> {
  const query = encodeURIComponent(name.trim());
  if (!query) return null;
  return cached(`find:${query}`, async () => {
    await sleep(KEGG_DELAY_MS);
    const text = await keggGet(`/find/compound/${query}`);
    for (const line of text.split("\n")) {
      const cpd = line.split("\t", 1)[0]?.trim();
      if (cpd?.startsWith("C") && /^C\d+$/.test(cpd)) return cpd;
    }
    return null;
  });
}

async function keggPathwaysForCompounds(compoundIds: string[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  const unique = [...new Set(compoundIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 8) {
    const batch = unique.slice(i, i + 8);
    const key = `link:${batch.join("+")}`;
    const batchMap = await cached(key, async () => {
      await sleep(KEGG_DELAY_MS);
      const joined = batch.map((c) => `cpd:${c}`).join("+");
      const text = await keggGet(`/link/pathway/${joined}`);
      const map = new Map<string, Set<string>>();
      for (const line of text.split("\n")) {
        const [cpdRaw, pathRaw] = line.split("\t");
        if (!cpdRaw || !pathRaw) continue;
        const cpd = cpdRaw.replace("cpd:", "");
        const pathway = pathRaw.replace("path:", "");
        if (!map.has(cpd)) map.set(cpd, new Set());
        map.get(cpd)!.add(pathway);
      }
      return map;
    });
    for (const [cpd, paths] of batchMap) {
      if (!result.has(cpd)) result.set(cpd, new Set());
      for (const p of paths) result.get(cpd)!.add(p);
    }
  }
  return result;
}

async function keggPathwayTitle(pathwayId: string): Promise<string> {
  return cached(`title:${pathwayId}`, async () => {
    await sleep(KEGG_DELAY_MS);
    const text = await keggGet(`/get/${pathwayId}`);
    for (const line of text.split("\n")) {
      if (line.startsWith("NAME")) {
        return line.replace("NAME", "").trim().split(" - ")[0]?.trim() || pathwayId;
      }
    }
    return pathwayId.replace("path:", "");
  });
}

export async function runLivePathwayEnrichment(
  volcano: { features: VolcanoFeature[] },
  config: AnalysisConfig = {}
) {
  const pThresh = Number(config.pThreshold ?? 0.05);
  const database = String(config.database ?? "KEGG");
  const fdrMethod = String(config.fdrMethod ?? "BH");
  const minSize = Number(config.minPathwaySize ?? 2);
  const maxSize = Number(config.maxPathwaySize ?? 500);

  const features = volcano.features ?? [];
  const sig = features.filter((f) => f.pValue < pThresh);
  const sigNames = sig.map((f) => f.name || f.featureId).filter(Boolean);
  const bgNames = features.map((f) => f.name || f.featureId).filter(Boolean);

  if (database.toLowerCase().startsWith("reactome")) {
    return {
      pathways: [],
      significantFeatures: sigNames.length,
      categories: [],
      database: "Reactome",
      warning: "Reactome live enrichment requires the Python service. Ensure PYTHON_SERVICE_URL is set and python is healthy.",
      engine: "typescript-fallback",
    };
  }

  const bgMap = new Map<string, string | null>();
  for (const name of bgNames) bgMap.set(name, await keggFindCompound(name));
  const sigMap = new Map<string, string | null>();
  for (const name of sigNames) sigMap.set(name, bgMap.get(name) ?? (await keggFindCompound(name)));

  const bgIds = [...bgMap.values()].filter((v): v is string => Boolean(v));
  const sigIds = [...sigMap.values()].filter((v): v is string => Boolean(v));
  if (!sigIds.length) {
    return {
      pathways: [],
      significantFeatures: sigNames.length,
      categories: [],
      database: "KEGG",
      warning: "No significant metabolites could be mapped to KEGG compound IDs.",
      engine: "typescript-kegg",
    };
  }

  const bgPathways = await keggPathwaysForCompounds(bgIds);
  const sigPathways = await keggPathwaysForCompounds(sigIds);

  const membersBg = new Map<string, Set<string>>();
  const membersSig = new Map<string, Set<string>>();

  for (const [name, cpd] of bgMap) {
    if (!cpd) continue;
    for (const pathway of bgPathways.get(cpd) ?? []) {
      if (!membersBg.has(pathway)) membersBg.set(pathway, new Set());
      membersBg.get(pathway)!.add(name);
    }
  }
  for (const [name, cpd] of sigMap) {
    if (!cpd) continue;
    for (const pathway of sigPathways.get(cpd) ?? []) {
      if (!membersSig.has(pathway)) membersSig.set(pathway, new Set());
      membersSig.get(pathway)!.add(name);
    }
  }

  const mappedBg = [...bgMap.values()].filter(Boolean).length;
  const mappedSig = [...sigMap.values()].filter(Boolean).length;
  const totalBg = Math.max(mappedBg, 1);
  const totalSig = Math.max(mappedSig, 1);

  const raw: PathwayRow[] = [];
  for (const [pathwayId, bgMembers] of membersBg) {
    const size = bgMembers.size;
    if (size < minSize || size > maxSize) continue;
    const hits = membersSig.get(pathwayId)?.size ?? 0;
    if (!hits) continue;
    const pValue = hypergeomP(hits, size, totalSig, totalBg);
    const title = await keggPathwayTitle(pathwayId);
    raw.push({
      name: title,
      genes: hits,
      total: size,
      pValue,
      negLogP: Number((-Math.log10(Math.max(pValue, 1e-16))).toFixed(2)),
      database: "KEGG",
      url: `https://www.genome.jp/kegg-bin/show_pathway?${pathwayId.replace("path:", "")}`,
      category: title.split(" ")[0] || pathwayId,
    });
  }

  raw.sort((a, b) => a.pValue - b.pValue);
  const fdr = applyFdr(raw.map((p) => p.pValue), fdrMethod);
  const pathways = raw.map((p, i) => ({ ...p, fdr: fdr[i] })).slice(0, 20);

  const categories = [...pathways.reduce((m, p) => {
    m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, new Map<string, number>())].map(([name, count]) => ({ name, count }));

  return {
    pathways,
    significantFeatures: sigNames.length,
    mappedFeatures: mappedSig,
    categories,
    database: "KEGG",
    organism: config.organism ?? "Homo sapiens",
    engine: "typescript-kegg",
  };
}
