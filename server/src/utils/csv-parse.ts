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

export function guessColumnRoles(headers: string[]): Record<string, ColumnRole> {
  const roles: Record<string, ColumnRole> = {};
  let sampleSet = false;
  let groupSet = false;

  headers.forEach((h) => {
    const lower = h.toLowerCase();
    if (!sampleSet && /sample|sample.?id|specimen/i.test(lower)) {
      roles[h] = "sample";
      sampleSet = true;
    } else if (!groupSet && /group|class|condition|cohort|treatment/i.test(lower)) {
      roles[h] = "group";
      groupSet = true;
    } else {
      roles[h] = "feature";
    }
  });
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
      const val = parseFloat(String(raw).replace(/,/g, ""));
      return Number.isFinite(val) ? val : null;
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
