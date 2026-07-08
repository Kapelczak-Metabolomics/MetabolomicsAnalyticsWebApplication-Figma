import { query } from "../db/index.js";

export async function clearDatasetMatrix(datasetId: number) {
  await query("DELETE FROM samples WHERE dataset_id = $1", [datasetId]);
}

export async function bulkLoadMatrix(
  datasetId: number,
  samples: Array<{ sampleId: string; groupLabel: string }>,
  features: Array<{
    featureId: string;
    name: string;
    featureClass?: string | null;
    pathway?: string | null;
    metadata?: Record<string, unknown> | null;
    values: (number | null)[];
  }>
) {
  const sampleIds: number[] = [];
  for (const s of samples) {
    const r = await query<{ id: number }>(
      `INSERT INTO samples (dataset_id, sample_id, group_label) VALUES ($1, $2, $3) RETURNING id`,
      [datasetId, s.sampleId, s.groupLabel]
    );
    sampleIds.push(r.rows[0].id);
  }

  const featureIds: number[] = [];
  for (const f of features) {
    const r = await query<{ id: number }>(
      `INSERT INTO features (dataset_id, feature_id, name, feature_class, pathway, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [datasetId, f.featureId, f.name, f.featureClass ?? null, f.pathway ?? null, JSON.stringify(f.metadata ?? {})]
    );
    featureIds.push(r.rows[0].id);
  }

  let missing = 0;
  let total = 0;
  const chunkSize = 400;

  for (let si = 0; si < samples.length; si++) {
    for (let fiStart = 0; fiStart < features.length; fiStart += chunkSize) {
      const fiEnd = Math.min(fiStart + chunkSize, features.length);
      const rows: string[] = [];
      const params: unknown[] = [];
      let pi = 1;

      for (let fi = fiStart; fi < fiEnd; fi++) {
        const raw = features[fi].values[si];
        total++;
        const val = raw == null || (typeof raw === "number" && Number.isNaN(raw)) ? null : Number(raw);
        if (val == null) missing++;
        rows.push(`($${pi}, $${pi + 1}, $${pi + 2})`);
        params.push(sampleIds[si], featureIds[fi], val);
        pi += 3;
      }

      if (rows.length) {
        await query(
          `INSERT INTO feature_values (sample_id, feature_id, value) VALUES ${rows.join(", ")}`,
          params
        );
      }
    }
  }

  const missingPct = total ? Number(((missing / total) * 100).toFixed(1)) : 0;
  return { samplesCount: samples.length, featuresCount: features.length, missingPct };
}

export async function recalculateDatasetStats(datasetId: number) {
  const counts = await query<{ samples: string; features: string }>(
    `SELECT
       (SELECT COUNT(*)::text FROM samples WHERE dataset_id = $1) AS samples,
       (SELECT COUNT(*)::text FROM features WHERE dataset_id = $1) AS features`,
    [datasetId]
  );
  const missing = await query<{ missing: string; total: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE fv.value IS NULL)::text AS missing,
       COUNT(*)::text AS total
     FROM feature_values fv
     JOIN samples s ON s.id = fv.sample_id
     WHERE s.dataset_id = $1`,
    [datasetId]
  );
  const samplesCount = parseInt(counts.rows[0]?.samples ?? "0", 10);
  const featuresCount = parseInt(counts.rows[0]?.features ?? "0", 10);
  const total = parseInt(missing.rows[0]?.total ?? "0", 10);
  const missingCount = parseInt(missing.rows[0]?.missing ?? "0", 10);
  const missingPct = total ? Number(((missingCount / total) * 100).toFixed(1)) : 0;
  await query(
    `UPDATE datasets SET samples_count = $1, features_count = $2, missing_pct = $3 WHERE id = $4`,
    [samplesCount, featuresCount, missingPct, datasetId]
  );
  return { samplesCount, featuresCount, missingPct };
}
