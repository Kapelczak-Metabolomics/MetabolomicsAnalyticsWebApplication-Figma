/** Lightweight CSV/TSV parser with quoted-field support. */

export type ColumnRole = "sample" | "group" | "feature" | "skip";

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export interface ColumnMapping {
  sampleColumn: string;
  groupColumn?: string | null;
  featureColumns?: string[];
  sampleGroups?: Record<string, string>;
}

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  if (tabs > commas) return "\t";
  if (commas > 0) return ",";
  return ",";
}

function parseLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseDelimitedTable(text: string): ParsedTable {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { headers: [], rows: [], delimiter: "," };
  }
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => parseLine(line, delimiter));
  return { headers, rows, delimiter };
}

const SAMPLE_ALIASES = new Set([
  "sample",
  "sample_id",
  "sampleid",
  "specimen",
  "specimen_id",
  "subject",
  "subject_id",
  "patient_id",
  "patient",
]);

const GROUP_ALIASES = new Set([
  "group",
  "group_label",
  "grouplabel",
  "class",
  "condition",
  "cohort",
  "treatment",
  "phenotype",
  "disease",
  "diagnosis",
  "category",
  "status",
  "arm",
  "batch_group",
]);

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumeric(value: string): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const val = parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(val) ? val : null;
}

interface ColumnStats {
  header: string;
  index: number;
  numericRatio: number;
  uniqueCount: number;
}

function columnStats(table: ParsedTable, colIdx: number): ColumnStats {
  const values = table.rows.map((row) => (row[colIdx] ?? "").trim()).filter(Boolean);
  const numericCount = values.filter((v) => parseNumeric(v) != null).length;
  const uniqueCount = new Set(values).size;
  return {
    header: table.headers[colIdx],
    index: colIdx,
    numericRatio: values.length ? numericCount / values.length : 0,
    uniqueCount,
  };
}

function isLikelySampleColumn(stats: ColumnStats, rowCount: number): boolean {
  if (stats.numericRatio > 0.6) return false;
  if (stats.uniqueCount < rowCount * 0.5) return false;
  return stats.uniqueCount >= Math.min(rowCount, 3);
}

function isLikelyGroupColumn(stats: ColumnStats, rowCount: number): boolean {
  if (stats.numericRatio > 0.2) return false;
  if (stats.uniqueCount < 2) return false;
  if (stats.uniqueCount > Math.max(24, Math.ceil(rowCount * 0.5))) return false;
  return true;
}

function isLikelyFeatureColumn(stats: ColumnStats): boolean {
  return stats.numericRatio >= 0.7;
}

/** Infer column roles using exact header aliases and column content (not substring matching). */
export function guessColumnRoles(table: ParsedTable): Record<string, ColumnRole> {
  const { headers, rows } = table;
  const roles: Record<string, ColumnRole> = {};
  headers.forEach((h) => {
    roles[h] = "feature";
  });
  if (!headers.length || !rows.length) return roles;

  const stats = headers.map((_, i) => columnStats(table, i));
  let sampleHeader: string | null = null;
  let groupHeader: string | null = null;

  for (const s of stats) {
    const norm = normalizeHeader(s.header);
    if (!sampleHeader && SAMPLE_ALIASES.has(norm)) {
      sampleHeader = s.header;
      roles[s.header] = "sample";
    } else if (!groupHeader && GROUP_ALIASES.has(norm)) {
      groupHeader = s.header;
      roles[s.header] = "group";
    }
  }

  if (!sampleHeader) {
    const candidate = stats.find((s) => isLikelySampleColumn(s, rows.length));
    if (candidate) {
      sampleHeader = candidate.header;
      roles[candidate.header] = "sample";
    }
  }

  if (!groupHeader) {
    const candidate = stats.find(
      (s) => s.header !== sampleHeader && isLikelyGroupColumn(s, rows.length)
    );
    if (candidate) {
      groupHeader = candidate.header;
      roles[candidate.header] = "group";
    }
  }

  for (const s of stats) {
    if (s.header === sampleHeader || s.header === groupHeader) continue;
    if (isLikelyFeatureColumn(s)) {
      roles[s.header] = "feature";
    }
  }

  // Demote mis-detected group columns that are clearly numeric feature data.
  for (const s of stats) {
    if (roles[s.header] === "group" && isLikelyFeatureColumn(s)) {
      roles[s.header] = "feature";
      if (groupHeader === s.header) groupHeader = null;
    }
  }

  return roles;
}

export function guessGroupFromSampleId(sampleId: string): string {
  const patterns = [
    /^([A-Za-z]+)[-_]\d+/,
    /^([A-Za-z]+)\d+$/,
    /^(AD|Control|CTRL|Treatment|Treat|Case|Healthy|WT|KO)/i,
  ];
  for (const re of patterns) {
    const m = sampleId.match(re);
    if (m) {
      const g = m[1];
      if (/^ctrl$/i.test(g)) return "Control";
      if (/^treat$/i.test(g)) return "Treatment";
      return g;
    }
  }
  return "Group1";
}

export function buildSamplesFromMapping(
  table: ParsedTable,
  mapping: ColumnMapping
): Array<{ sampleId: string; groupLabel: string }> {
  const sampleIdx = table.headers.indexOf(mapping.sampleColumn);
  if (sampleIdx < 0) throw new Error("Sample column not found");

  const groupIdx = mapping.groupColumn ? table.headers.indexOf(mapping.groupColumn) : -1;

  return table.rows.map((row) => {
    const sampleId = row[sampleIdx] ?? "";
    let groupLabel = "Unassigned";
    if (groupIdx >= 0) {
      groupLabel = row[groupIdx] ?? "Unassigned";
    } else if (mapping.sampleGroups && sampleId in mapping.sampleGroups) {
      groupLabel = mapping.sampleGroups[sampleId];
    }
    return { sampleId, groupLabel };
  });
}

export function buildFeaturesFromMapping(
  table: ParsedTable,
  mapping: ColumnMapping
): Array<{ featureId: string; name: string; values: (number | null)[] }> {
  const sampleIdx = table.headers.indexOf(mapping.sampleColumn);
  const groupIdx = mapping.groupColumn ? table.headers.indexOf(mapping.groupColumn) : -1;
  const skip = new Set([sampleIdx, groupIdx].filter((i) => i >= 0));

  const featureHeaders = mapping.featureColumns?.length
    ? mapping.featureColumns.map((h) => ({ h, i: table.headers.indexOf(h) })).filter(({ i }) => i >= 0)
    : table.headers.map((h, i) => ({ h, i })).filter(({ i }) => !skip.has(i));

  return featureHeaders.map(({ h, i }, idx) => ({
    featureId: `F${String(idx + 1).padStart(4, "0")}`,
    name: h,
    values: table.rows.map((row) => {
      const raw = row[i];
      if (raw === "" || raw == null) return null;
      return parseNumeric(String(raw));
    }),
  }));
}

export function autoSampleGroups(table: ParsedTable, sampleColumn: string): Record<string, string> {
  const idx = table.headers.indexOf(sampleColumn);
  if (idx < 0) return {};
  const groups: Record<string, string> = {};
  for (const row of table.rows) {
    const sid = row[idx];
    if (sid) groups[sid] = guessGroupFromSampleId(sid);
  }
  return groups;
}
