type AnalysisConfig = Record<string, unknown>;

const KEGG_REST = "https://rest.kegg.jp";
const KEGG_DELAY_MS = 200;
const KEGG_CONCURRENCY = 4;

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
  const res = await fetch(`${KEGG_REST}${path}`, { signal: AbortSignal.timeout(30_000) });
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

async function mapCompoundsParallel(names: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(names.filter(Boolean))];
  const result = new Map<string, string | null>();
  let index = 0;

  async function worker() {
    while (index < unique.length) {
      const i = index++;
      const name = unique[i];
      result.set(name, await keggFindCompound(name));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(KEGG_CONCURRENCY, unique.length) }, () => worker())
  );
  return result;
}

async function keggPathwaysForCompounds(compoundIds: string[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  const unique = [...new Set(compoundIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
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

function parseKeggBatchTitles(text: string): Map<string, string> {
  const titles = new Map<string, string>();
  const blocks = text.split(/\n\/\/\/\n/);
  for (const block of blocks) {
    // KEGG pathway entries look like: ENTRY       PATHWAY       map00020
    const entryMatch =
      block.match(/^ENTRY\s+PATHWAY\s+(\S+)/m) ?? block.match(/^ENTRY\s+\S+\s+(\S+)/m);
    const mapId = entryMatch?.[1] ?? block.match(/\b(map\d{5})\b/)?.[1];
    if (!mapId) continue;

    const nameLine = block.split("\n").find((line) => /^\s*NAME\b/.test(line));
    const title = nameLine
      ? nameLine.replace(/^\s*NAME\s+/, "").trim().split(" - ")[0]?.trim() || mapId
      : mapId;

    const withPrefix = mapId.startsWith("path:") ? mapId : `path:${mapId}`;
    titles.set(withPrefix, title);
    titles.set(mapId, title);
  }
  return titles;
}

async function keggPathwayTitles(pathwayIds: string[]): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const unique = [...new Set(pathwayIds)];
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const key = `titles:${batch.join("+")}`;
    const batchTitles = await cached(key, async () => {
      await sleep(KEGG_DELAY_MS);
      const joined = batch.map((id) => (id.startsWith("path:") ? id : `path:${id}`)).join("+");
      const text = await keggGet(`/get/${joined}`);
      return parseKeggBatchTitles(text);
    });
    for (const [id, title] of batchTitles) titles.set(id, title);
  }
  return titles;
}

function formatPathwayId(pathwayId: string) {
  return pathwayId.startsWith("path:") ? pathwayId : `path:${pathwayId}`;
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
    const { enrichReactome } = await import("./pathway-reactome.js");
    return enrichReactome(sigNames, config);
  }

  if (database.toLowerCase().includes("go")) {
    const { enrichGProfiler } = await import("./pathway-gprofiler.js");
    return enrichGProfiler(sigNames, config, "GO Biological Process", "go");
  }

  if (database.toLowerCase().includes("metacyc")) {
    const { enrichGProfiler } = await import("./pathway-gprofiler.js");
    return enrichGProfiler(sigNames, config, "MetaCyc", "metacyc");
  }

  const compoundMap = await mapCompoundsParallel(bgNames);
  const sigMap = new Map(sigNames.map((name) => [name, compoundMap.get(name) ?? null]));

  const bgIds = [...compoundMap.values()].filter((v): v is string => Boolean(v));
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

  const compoundPathways = await keggPathwaysForCompounds(bgIds);

  const membersBg = new Map<string, Set<string>>();
  const membersSig = new Map<string, Set<string>>();

  for (const [name, cpd] of compoundMap) {
    if (!cpd) continue;
    for (const pathway of compoundPathways.get(cpd) ?? []) {
      if (!membersBg.has(pathway)) membersBg.set(pathway, new Set());
      membersBg.get(pathway)!.add(name);
    }
  }
  for (const [name, cpd] of sigMap) {
    if (!cpd) continue;
    for (const pathway of compoundPathways.get(cpd) ?? []) {
      if (!membersSig.has(pathway)) membersSig.set(pathway, new Set());
      membersSig.get(pathway)!.add(name);
    }
  }

  const mappedBg = bgIds.length;
  const mappedSig = sigIds.length;
  const totalBg = Math.max(mappedBg, 1);
  const totalSig = Math.max(mappedSig, 1);

  const raw: Array<PathwayRow & { pathwayId: string }> = [];
  for (const [pathwayId, bgMembers] of membersBg) {
    const size = bgMembers.size;
    if (size < minSize || size > maxSize) continue;
    const hits = membersSig.get(pathwayId)?.size ?? 0;
    if (!hits) continue;
    const pValue = hypergeomP(hits, size, totalSig, totalBg);
    const normalizedId = formatPathwayId(pathwayId);
    raw.push({
      pathwayId: normalizedId,
      name: normalizedId.replace("path:", "KEGG "),
      genes: hits,
      total: size,
      pValue,
      negLogP: Number((-Math.log10(Math.max(pValue, 1e-16))).toFixed(2)),
      database: "KEGG",
      url: `https://www.genome.jp/kegg-bin/show_pathway?${normalizedId.replace("path:", "")}`,
      category: pathwayId.replace("path:", "").slice(0, 8),
    });
  }

  raw.sort((a, b) => a.pValue - b.pValue);
  const fdr = applyFdr(raw.map((p) => p.pValue), fdrMethod);
  const top = raw.slice(0, 20).map((p, i) => ({ ...p, fdr: fdr[i] }));

  const titleMap = await keggPathwayTitles(top.map((p) => p.pathwayId));
  const pathways = top.map((p) => {
    const bareId = p.pathwayId.replace(/^path:/, "");
    const title = titleMap.get(p.pathwayId) ?? titleMap.get(bareId) ?? p.name;
    return {
      name: title,
      genes: p.genes,
      total: p.total,
      pValue: p.pValue,
      negLogP: p.negLogP,
      database: p.database,
      url: p.url,
      category: title.split(" ")[0] || p.category,
      fdr: p.fdr,
    };
  });

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
