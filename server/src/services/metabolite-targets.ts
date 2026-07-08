import { query } from "../db/index.js";
import { parseDelimitedTable } from "../utils/csv-parse.js";

export interface MetaboliteTarget {
  name: string;
  mz: number;
  adduct?: string | null;
  rt?: number | null;
}

export interface MetaboliteTargetSettings {
  enabled: boolean;
  mzTolerance: number;
  rtTolerance: number;
  targets: MetaboliteTarget[];
  updatedAt?: string;
}

const SETTINGS_KEY = "metabolite_targets";

const DEFAULT_SETTINGS: MetaboliteTargetSettings = {
  enabled: false,
  mzTolerance: 0.01,
  rtTolerance: 0.5,
  targets: [],
};

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function parseNumber(value: string | undefined | null): number | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function pickColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map((h) => ({ raw: h, key: normalizeHeader(h) }));
  for (const alias of aliases) {
    const match = normalized.find((h) => h.key === alias || h.key.includes(alias));
    if (match) return match.raw;
  }
  return null;
}

export function parseMetaboliteTargetCsv(csv: string): MetaboliteTarget[] {
  const table = parseDelimitedTable(csv);
  if (!table.headers.length) {
    throw new Error("CSV must include a header row");
  }

  const nameCol =
    pickColumn(table.headers, ["compound", "name", "metabolite", "target"]) ?? table.headers[0];
  const mzCol = pickColumn(table.headers, ["mz", "m_z", "mass", "target_mz", "targetmz"]);
  const adductCol = pickColumn(table.headers, ["adduct", "ion", "adduct_type"]);
  const rtCol = pickColumn(table.headers, ["rt", "retention_time", "retention", "r_t"]);

  if (!mzCol) {
    throw new Error("CSV must include a target m/z column (mz, mass, or target_mz)");
  }

  const nameIdx = table.headers.indexOf(nameCol);
  const mzIdx = table.headers.indexOf(mzCol);
  const adductIdx = adductCol ? table.headers.indexOf(adductCol) : -1;
  const rtIdx = rtCol ? table.headers.indexOf(rtCol) : -1;

  const targets: MetaboliteTarget[] = [];
  for (const row of table.rows) {
    const name = String(row[nameIdx] ?? "").trim();
    const mz = parseNumber(row[mzIdx]);
    if (mz == null) continue;
    const adduct = adductIdx >= 0 ? String(row[adductIdx] ?? "").trim() : "";
    const rt = rtIdx >= 0 ? parseNumber(row[rtIdx]) : null;
    targets.push({
      name: name || `m/z ${mz}`,
      mz,
      adduct: adduct || null,
      rt,
    });
  }

  if (!targets.length) {
    throw new Error("No valid metabolite targets found in CSV");
  }

  return targets;
}

export async function loadMetaboliteTargetSettings(): Promise<MetaboliteTargetSettings> {
  const result = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key = $1", [SETTINGS_KEY]);
  const raw = result.rows[0]?.value;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const value = raw as Partial<MetaboliteTargetSettings>;
  return {
    enabled: Boolean(value.enabled),
    mzTolerance: typeof value.mzTolerance === "number" ? value.mzTolerance : DEFAULT_SETTINGS.mzTolerance,
    rtTolerance: typeof value.rtTolerance === "number" ? value.rtTolerance : DEFAULT_SETTINGS.rtTolerance,
    targets: Array.isArray(value.targets)
      ? value.targets.reduce<MetaboliteTarget[]>((acc, t) => {
          if (!t || typeof t !== "object") return acc;
          const row = t as unknown as Record<string, unknown>;
          const mz = typeof row.mz === "number" ? row.mz : Number(row.mz);
          if (!Number.isFinite(mz)) return acc;
          const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : `m/z ${mz}`;
          acc.push({
            name,
            mz,
            adduct: typeof row.adduct === "string" ? row.adduct : null,
            rt: row.rt == null || row.rt === "" ? null : Number(row.rt),
          });
          return acc;
        }, [])
      : [],
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
}

export async function saveMetaboliteTargetSettings(settings: MetaboliteTargetSettings) {
  const payload: MetaboliteTargetSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [SETTINGS_KEY, JSON.stringify(payload)]
  );
  return payload;
}

/** Targets passed to Python when targeted detection is enabled. */
export async function getActiveMetaboliteTargetsForImport(): Promise<{
  enabled: boolean;
  mzTolerance: number;
  rtTolerance: number;
  targets: MetaboliteTarget[];
}> {
  const settings = await loadMetaboliteTargetSettings();
  if (!settings.enabled || !settings.targets.length) {
    return { enabled: false, mzTolerance: settings.mzTolerance, rtTolerance: settings.rtTolerance, targets: [] };
  }
  return {
    enabled: true,
    mzTolerance: settings.mzTolerance,
    rtTolerance: settings.rtTolerance,
    targets: settings.targets,
  };
}
