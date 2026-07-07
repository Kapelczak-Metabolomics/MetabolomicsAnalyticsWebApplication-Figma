type AnalysisConfig = Record<string, unknown>;

const REACTOME_ANALYSIS = "https://reactome.org/AnalysisService";

export async function enrichReactome(sigNames: string[], config: AnalysisConfig = {}) {
  const fdrMethod = String(config.fdrMethod ?? "BH");
  const identifiers = sigNames.map((n) => n.trim()).filter(Boolean).join("\n");
  if (!identifiers) {
    return {
      pathways: [],
      significantFeatures: 0,
      categories: [],
      database: "Reactome",
      engine: "typescript-reactome",
    };
  }

  try {
    const tokenRes = await fetch(`${REACTOME_ANALYSIS}/identifiers/`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", Accept: "text/plain" },
      body: identifiers,
      signal: AbortSignal.timeout(60_000),
    });
    if (!tokenRes.ok) throw new Error(`Reactome token request failed (${tokenRes.status})`);
    const token = (await tokenRes.text()).trim().replace(/"/g, "");
    if (!token) throw new Error("Reactome returned empty analysis token");

    const reportRes = await fetch(`${REACTOME_ANALYSIS}/report/${token}/`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!reportRes.ok) throw new Error(`Reactome report failed (${reportRes.status})`);
    const report = await reportRes.text();

    const raw: Array<{
      name: string;
      genes: number;
      total: number;
      pValue: number;
      negLogP: number;
      database: string;
      url: string;
      category: string;
      fdr?: number;
    }> = [];

    for (const line of report.split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      const parts = line.split("\t");
      if (parts.length < 4) continue;
      const [pathwayId, url, name, entitiesFound, , , pRaw] = parts;
      const hits = parseInt(entitiesFound, 10);
      if (!hits || Number.isNaN(hits)) continue;
      const pValue = pRaw ? parseFloat(pRaw) : 0.05;
      raw.push({
        name,
        genes: hits,
        total: hits,
        pValue,
        negLogP: Number((-Math.log10(Math.max(pValue, 1e-16))).toFixed(2)),
        database: "Reactome",
        url: url || `https://reactome.org/PathwayBrowser/#${pathwayId}`,
        category: name.split(" ")[0] || "Pathway",
      });
    }

    raw.sort((a, b) => a.pValue - b.pValue);
    const pathways = raw.slice(0, 20);

    return {
      pathways,
      significantFeatures: sigNames.length,
      categories: [],
      database: "Reactome",
      organism: config.organism ?? "Homo sapiens",
      engine: "typescript-reactome",
    };
  } catch (err) {
    return {
      pathways: [],
      significantFeatures: sigNames.length,
      categories: [],
      database: "Reactome",
      warning: err instanceof Error ? err.message : "Reactome API request failed",
      engine: "typescript-reactome",
    };
  }
}
