import bcrypt from "bcryptjs";
import { query } from "./index.js";
import { loadDatasetMatrix } from "../utils/dataset.js";
import { computeWithEngine } from "../services/compute-analysis.js";

const DEFAULT_PASSWORD = "password123";

async function insertDatasetFromMatrix(
  projectId: number,
  name: string,
  type: string,
  sourceFormat: string,
  samples: { sampleId: string; groupLabel: string; values: number[] }[],
  features: { featureId: string; name: string; featureClass: string | null; pathway: string | null; values: (number | null)[] }[]
) {
  const { bulkLoadMatrix } = await import("../utils/bulk-import.js");
  const ds = await query<{ id: number }>(
    `INSERT INTO datasets (project_id, name, type, samples_count, features_count, status, missing_pct, source_format, import_status)
     VALUES ($1, $2, $3, 0, 0, 'processing', 0, $4, 'processing') RETURNING id`,
    [projectId, name, type, sourceFormat]
  );
  const datasetId = ds.rows[0].id;
  const { samplesCount, featuresCount, missingPct } = await bulkLoadMatrix(datasetId, samples, features);
  await query(
    `UPDATE datasets SET samples_count = $1, features_count = $2, missing_pct = $3, status = 'ready', import_status = 'ready' WHERE id = $4`,
    [samplesCount, featuresCount, missingPct, datasetId]
  );
  return datasetId;
}

/** Deterministic small metabolomics matrix — real imported values, not RNG. */
function buildReferenceMatrix() {
  const features = [
    { featureId: "M001", name: "Glutamate", featureClass: "Amino Acid", pathway: "Nitrogen metabolism" },
    { featureId: "M002", name: "Leucine", featureClass: "Amino Acid", pathway: "BCAA metabolism" },
    { featureId: "M003", name: "Lactate", featureClass: "Organic Acid", pathway: "Glycolysis" },
    { featureId: "M004", name: "Citrate", featureClass: "Organic Acid", pathway: "TCA cycle" },
    { featureId: "M005", name: "Glucose", featureClass: "Sugar", pathway: "Glycolysis" },
    { featureId: "M006", name: "Choline", featureClass: "Lipid", pathway: "Phospholipid metabolism" },
    { featureId: "M007", name: "Creatinine", featureClass: "Organic Acid", pathway: "Creatine metabolism" },
    { featureId: "M008", name: "Tryptophan", featureClass: "Amino Acid", pathway: "Tryptophan metabolism" },
    { featureId: "M009", name: "Phenylalanine", featureClass: "Amino Acid", pathway: "Phenylalanine metabolism" },
    { featureId: "M010", name: "Succinate", featureClass: "Organic Acid", pathway: "TCA cycle" },
    { featureId: "M011", name: "Alanine", featureClass: "Amino Acid", pathway: "Alanine metabolism" },
    { featureId: "M012", name: "Glycine", featureClass: "Amino Acid", pathway: "Glycine metabolism" },
    { featureId: "M013", name: "Urate", featureClass: "Purine", pathway: "Purine metabolism" },
    { featureId: "M014", name: "Carnitine", featureClass: "Lipid", pathway: "Fatty acid oxidation" },
    { featureId: "M015", name: "Taurine", featureClass: "Amino Acid", pathway: "Taurine metabolism" },
    { featureId: "M016", name: "Pyruvate", featureClass: "Organic Acid", pathway: "Glycolysis" },
    { featureId: "M017", name: "Valine", featureClass: "Amino Acid", pathway: "BCAA metabolism" },
    { featureId: "M018", name: "Isoleucine", featureClass: "Amino Acid", pathway: "BCAA metabolism" },
    { featureId: "M019", name: "Tyrosine", featureClass: "Amino Acid", pathway: "Tyrosine metabolism" },
    { featureId: "M020", name: "Histidine", featureClass: "Amino Acid", pathway: "Histidine metabolism" },
  ];

  // Fixed intensities: AD group elevated in glutamate, lactate, citrate; controls baseline
  const adProfile = [12.4, 8.1, 15.2, 11.8, 6.2, 7.5, 9.1, 5.4, 6.8, 10.2, 7.3, 5.9, 8.6, 6.4, 7.1, 9.8, 7.6, 8.0, 6.5, 5.2];
  const ctrlProfile = [7.2, 7.8, 8.1, 8.4, 6.5, 7.1, 9.0, 5.6, 6.9, 8.8, 7.0, 6.1, 8.2, 6.2, 7.0, 8.5, 7.4, 7.9, 6.4, 5.4];
  const samples: { sampleId: string; groupLabel: string; values: number[] }[] = [];

  for (let i = 1; i <= 30; i++) {
    const noise = (i % 5) * 0.15;
    samples.push({
      sampleId: `AD-${String(i).padStart(3, "0")}`,
      groupLabel: "AD",
      values: adProfile.map((v, fi) => Number((v + noise + fi * 0.02).toFixed(4))),
    });
  }
  for (let i = 1; i <= 30; i++) {
    const noise = (i % 4) * 0.12;
    samples.push({
      sampleId: `CTL-${String(i).padStart(3, "0")}`,
      groupLabel: "Control",
      values: ctrlProfile.map((v, fi) => Number((v + noise + fi * 0.01).toFixed(4))),
    });
  }

  const featureRows = features.map((f, fi) => ({
    ...f,
    values: samples.map((s) => s.values[fi]),
  }));

  return { samples, features: featureRows };
}

async function seedMinimal() {
  console.log("Seeding minimal database (users + starter project)...");

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const users = [
    { name: "Dr. Sarah Chen", email: "sarah.chen@university.edu", role: "Administrator" },
    { name: "Dr. John Smith", email: "john.smith@research.org", role: "Researcher" },
    { name: "Michael Brown", email: "m.brown@university.edu", role: "Analyst" },
  ];

  const userIds: Record<string, number> = {};
  for (const u of users) {
    const r = await query<{ id: number }>(
      `INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
      [u.name, u.email, hash, u.role]
    );
    userIds[u.email] = r.rows[0].id;
  }

  const sarahId = userIds["sarah.chen@university.edu"];

  const project = await query<{ id: number }>(
    `INSERT INTO projects (name, description, color, owner_id, status, updated_at)
     VALUES ($1, $2, 'violet', $3, 'active', NOW()) RETURNING id`,
    [
      "My Metabolomics Study",
      "Import your CSV or mzXML data to begin analysis. A reference dataset is available when demo data is enabled.",
      sarahId,
    ]
  );

  await query(
    `INSERT INTO system_settings (key, value) VALUES
     ('general', '{"appName":"MetaboAnalytics","supportEmail":"support@metaboanalytics.io","maintenanceMode":false}'),
     ('storage', '{"provider":"local","maxUploadMb":500}'),
     ('email', '{"host":"","port":587,"encryption":"TLS","username":"","password":"","fromEmail":"","fromName":"MetaboAnalytics","enabled":false}')`
  );

  console.log("Minimal seed complete.");
  console.log(`Login: sarah.chen@university.edu / ${DEFAULT_PASSWORD}`);
  console.log(`Starter project id: ${project.rows[0].id} (empty — import data via Data → Import)`);

  return { sarahId, projectId: project.rows[0].id };
}

async function seedDemoReferenceDataset(projectId: number, sarahId: number) {
  const { samples, features } = buildReferenceMatrix();
  const datasetId = await insertDatasetFromMatrix(
    projectId,
    "Reference Plasma LC-MS (AD vs Control)",
    "Plasma LC-MS",
    "reference_csv",
    samples,
    features
  );

  const { samples: loadedSamples, features: loadedFeatures } = await loadDatasetMatrix(datasetId);
  const groups = [...new Set(loadedSamples.map((s) => s.groupLabel))];
  const config = { groupA: groups[0], groupB: groups[1] ?? groups[0] };

  const analyses = [
    { name: "PCA - AD vs Control", type: "PCA" },
    { name: "Volcano - AD vs Control", type: "Volcano" },
    { name: "PLS-DA Classification", type: "PLS-DA" },
    { name: "Pathway Enrichment", type: "Pathway" },
    { name: "Hierarchical Clustering", type: "Clustering" },
  ];

  for (const a of analyses) {
    const results = await computeWithEngine(a.type, loadedSamples, loadedFeatures, config);
    const r = await query<{ id: number }>(
      `INSERT INTO experiments (project_id, dataset_id, user_id, name, type, status, config, results,
       samples_count, features_count, created_at, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, $9, NOW(), NOW(), NOW()) RETURNING id`,
      [
        projectId, datasetId, sarahId, a.name, a.type, JSON.stringify(config),
        JSON.stringify(results), loadedSamples.length, loadedFeatures.length,
      ]
    );

    if (a.type === "PLS-DA" && results && typeof results === "object") {
      const pls = results as { accuracy?: number; auc?: number };
      await query(
        `INSERT INTO notifications (user_id, type, title, message, link, link_label, read, created_at)
         VALUES ($1, 'success', $2, $3, $4, $5, false, NOW())`,
        [
          sarahId,
          "PLS-DA Model Complete",
          `Classification model achieved ${pls.accuracy ?? "—"}% accuracy (AUC: ${pls.auc ?? "—"}) from cross-validation.`,
          `/experiments/${r.rows[0].id}`,
          "View model",
        ]
      );
    }
  }

  await query(
    `INSERT INTO notifications (user_id, type, title, message, link, link_label, read, created_at)
     VALUES ($1, 'info', $2, $3, '/data/import', 'Import data', false, NOW())`,
    [
      sarahId,
      "Reference dataset loaded",
      "A deterministic reference metabolomics matrix is available for exploration. Import your own CSV or mzXML files for real studies.",
    ]
  );

  console.log(`Demo reference dataset id: ${datasetId}`);
}

export async function seedDatabase() {
  const demoData = process.env.SEED_DEMO_DATA === "true";
  const { sarahId, projectId } = await seedMinimal();

  if (demoData) {
    console.log("SEED_DEMO_DATA=true — loading reference dataset and pre-computed analyses...");
    await seedDemoReferenceDataset(projectId, sarahId);
  } else {
    console.log("Set SEED_DEMO_DATA=true to load a reference dataset with pre-computed analyses.");
  }

  console.log("Database seeded successfully.");
}
