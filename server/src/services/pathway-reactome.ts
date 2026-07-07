type AnalysisConfig = Record<string, unknown>;

const REACTOME_ANALYSIS = "https://reactome.org/AnalysisService";

const SPECIES_MAP: Record<string, string> = {
  "homo sapiens": "9606",
  "mus musculus": "10090",
  "rattus norvegicus": "10116",
};

type ReactomePathway = {
  stId?: string;
  name?: string;
  entities?: { found?: number; total?: number };
  entitiesPValue?: number;
  entitiesFdr?: number;
};

type ReactomeProjection = {
  token?: string;
  pathways?: ReactomePathway[];
  summary?: { token?: string };
};

export async function enrichReactome(sigNames: string[], config: AnalysisConfig = {}) {
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

  const species = SPECIES_MAP[String(config.organism ?? "Homo sapiens").toLowerCase()] ?? "9606";

  try {
    const url = new URL(`${REACTOME_ANALYSIS}/identifiers/projection/`);
    url.searchParams.set("interactors", "false");
    url.searchParams.set("species", species);
    url.searchParams.set("pageSize", "25");
    url.searchParams.set("page", "1");

    const tokenRes = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Accept: "application/json",
      },
      body: identifiers,
      signal: AbortSignal.timeout(90_000),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => "");
      throw new Error(`Reactome request failed (${tokenRes.status})${detail ? `: ${detail.slice(0, 160)}` : ""}`);
    }

    const payload = (await tokenRes.json()) as ReactomeProjection;
    const rows = (payload.pathways ?? [])
      .filter((p) => p.entities?.found && p.entitiesPValue != null)
      .sort((a, b) => (a.entitiesPValue ?? 1) - (b.entitiesPValue ?? 1))
      .slice(0, 20);

    const pathways = rows.map((row) => {
      const pValue = row.entitiesPValue ?? 1;
      const name = row.name || row.stId || "Pathway";
      const stId = row.stId || "";
      return {
        name,
        genes: row.entities?.found ?? 0,
        total: row.entities?.total ?? row.entities?.found ?? 0,
        pValue,
        negLogP: Number((-Math.log10(Math.max(pValue, 1e-16))).toFixed(2)),
        database: "Reactome",
        url: stId ? `https://reactome.org/PathwayBrowser/#/${stId}` : "https://reactome.org/",
        category: name.split(" ")[0] || "Pathway",
        fdr: row.entitiesFdr ?? pValue,
      };
    });

    const categories = [...pathways.reduce((m, p) => {
      m.set(p.category, (m.get(p.category) ?? 0) + 1);
      return m;
    }, new Map<string, number>())].map(([name, count]) => ({ name, count }));

    return {
      pathways,
      significantFeatures: sigNames.length,
      categories,
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
