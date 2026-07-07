type AnalysisConfig = Record<string, unknown>;

const GPROFILER_URL = "https://biit.cs.ut.ee/gprofiler/api/gost/profile/";

const ORGANISM_MAP: Record<string, string> = {
  "homo sapiens": "hsapiens",
  "mus musculus": "mmusculus",
  "rattus norvegicus": "rnorvegicus",
};

const SOURCE_MAP: Record<string, string[]> = {
  go: ["GO:BP", "GO:MF", "GO:CC"],
  metacyc: ["META", "KEGG"],
};

type GProfilerRow = {
  native?: string;
  name?: string;
  p_value?: number;
  term_size?: number;
  intersection_size?: number;
  source?: string;
};

export async function enrichGProfiler(
  sigNames: string[],
  config: AnalysisConfig,
  databaseLabel: string,
  sourceKey: "go" | "metacyc"
) {
  const organism =
    ORGANISM_MAP[String(config.organism ?? "Homo sapiens").toLowerCase()] ?? "hsapiens";
  const query = sigNames.map((n) => n.trim()).filter(Boolean);
  if (!query.length) {
    return {
      pathways: [],
      significantFeatures: 0,
      categories: [],
      database: databaseLabel,
      engine: `gprofiler-${sourceKey}`,
    };
  }

  try {
    const res = await fetch(GPROFILER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        organism,
        query,
        sources: SOURCE_MAP[sourceKey],
        user_threshold: Number(config.pThreshold ?? 0.05),
        significance_threshold_method: "fdr",
        ordered: false,
        no_evidences: true,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`g:Profiler request failed (${res.status})${text ? `: ${text.slice(0, 120)}` : ""}`);
    }

    const body = (await res.json()) as { result?: GProfilerRow[] };
    const rows = (body.result ?? [])
      .filter((r) => r.intersection_size && r.p_value != null)
      .sort((a, b) => (a.p_value ?? 1) - (b.p_value ?? 1))
      .slice(0, 20);

    const pathways = rows.map((row) => {
      const pValue = row.p_value ?? 1;
      const name = row.name || row.native || "Pathway";
      const source = row.source || databaseLabel;
      return {
        name,
        genes: row.intersection_size ?? 0,
        total: row.term_size ?? row.intersection_size ?? 0,
        pValue,
        negLogP: Number((-Math.log10(Math.max(pValue, 1e-16))).toFixed(2)),
        database: databaseLabel,
        url: `https://biit.cs.ut.ee/gprofiler/gost?organism=${organism}&query=${encodeURIComponent(query.join(","))}`,
        category: source,
        fdr: pValue,
      };
    });

    const categories = [...pathways.reduce((m, p) => {
      m.set(p.category, (m.get(p.category) ?? 0) + 1);
      return m;
    }, new Map<string, number>())].map(([name, count]) => ({ name, count }));

    return {
      pathways,
      significantFeatures: query.length,
      categories,
      database: databaseLabel,
      organism: config.organism ?? "Homo sapiens",
      engine: `gprofiler-${sourceKey}`,
    };
  } catch (err) {
    return {
      pathways: [],
      significantFeatures: query.length,
      categories: [],
      database: databaseLabel,
      warning: err instanceof Error ? err.message : "g:Profiler request failed",
      engine: `gprofiler-${sourceKey}`,
    };
  }
}
