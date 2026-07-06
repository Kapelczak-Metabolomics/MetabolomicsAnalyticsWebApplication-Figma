import { query } from "../db/index.js";

export async function bulkLoadMatrix(
  datasetId: number,
  samples: Array<{ sampleId: string; groupLabel: string }>,
  features: Array<{ featureId: string; name: string; featureClass?: string | null; pathway?: string | null; values: (number | null)[] }>
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
      `INSERT INTO features (dataset_id, feature_id, name, feature_class, pathway) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [datasetId, f.featureId, f.name, f.featureClass ?? null, f.pathway ?? null]
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
