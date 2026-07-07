import { query } from "../db/index.js";
import type { FeatureRow, SampleRow } from "../services/analysis.js";

const DEFAULT_MAX_FEATURES = 2500;

export async function loadDatasetMatrix(datasetId: number, options?: { maxFeatures?: number }) {
  const maxFeatures = options?.maxFeatures ?? 0;

  const samplesResult = await query<{ id: number; sample_id: string; group_label: string }>(
    `SELECT id, sample_id, group_label FROM samples WHERE dataset_id = $1 ORDER BY sample_id`,
    [datasetId]
  );

  let featuresResult = await query<{ id: number; feature_id: string; name: string; feature_class: string | null; pathway: string | null }>(
    `SELECT id, feature_id, name, feature_class, pathway FROM features WHERE dataset_id = $1 ORDER BY feature_id`,
    [datasetId]
  );

  let featureRows = featuresResult.rows;

  if (maxFeatures > 0 && featureRows.length > maxFeatures) {
    const top = await query<{ id: number }>(
      `SELECT f.id
       FROM features f
       JOIN (
         SELECT fv.feature_id, VAR_POP(fv.value::double precision) AS v
         FROM feature_values fv
         JOIN samples s ON s.id = fv.sample_id
         WHERE s.dataset_id = $1 AND fv.value IS NOT NULL
         GROUP BY fv.feature_id
         ORDER BY v DESC NULLS LAST
         LIMIT $2
       ) ranked ON ranked.feature_id = f.id
       WHERE f.dataset_id = $1`,
      [datasetId, maxFeatures]
    );
    const keep = new Set(top.rows.map((r) => r.id));
    featureRows = featureRows.filter((f) => keep.has(f.id));
  }

  const featureIds = featureRows.map((f) => f.id);
  const valuesResult = featureIds.length
    ? await query<{ sample_id: number; feature_id: number; value: string | null }>(
        `SELECT fv.sample_id, fv.feature_id, fv.value
         FROM feature_values fv
         JOIN samples s ON s.id = fv.sample_id
         WHERE s.dataset_id = $1 AND fv.feature_id = ANY($2::int[])`,
        [datasetId, featureIds]
      )
    : { rows: [] as Array<{ sample_id: number; feature_id: number; value: string | null }> };

  const valueMap = new Map<string, number | null>();
  for (const v of valuesResult.rows) {
    valueMap.set(`${v.sample_id}:${v.feature_id}`, v.value != null ? parseFloat(v.value) : null);
  }

  const featureMedians = featureRows.map((f) => {
    const vals = samplesResult.rows
      .map((s) => valueMap.get(`${s.id}:${f.id}`))
      .filter((v): v is number => v != null);
    vals.sort((a, b) => a - b);
    return vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  });

  const samples: SampleRow[] = samplesResult.rows.map((s) => ({
    sampleId: s.sample_id,
    groupLabel: s.group_label,
    values: featureRows.map((f, fi) => {
      const v = valueMap.get(`${s.id}:${f.id}`);
      return v ?? featureMedians[fi];
    }),
  }));

  const features: FeatureRow[] = featureRows.map((f) => ({
    featureId: f.feature_id,
    name: f.name,
    featureClass: f.feature_class,
    pathway: f.pathway,
    values: samplesResult.rows.map((s) => {
      const v = valueMap.get(`${s.id}:${f.id}`);
      return v ?? null;
    }),
  }));

  return { samples, features };
}

export function analysisMaxFeatures(): number {
  const raw = process.env.ANALYSIS_MAX_FEATURES;
  const n = raw ? parseInt(raw, 10) : DEFAULT_MAX_FEATURES;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_FEATURES;
}

export function formatRelativeTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

export function formatDuration(start: Date, end: Date) {
  const secs = Math.floor((end.getTime() - start.getTime()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}
