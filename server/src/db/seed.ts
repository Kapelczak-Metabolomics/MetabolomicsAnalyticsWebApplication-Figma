import bcrypt from "bcryptjs";
import { query } from "./index.js";
import { loadDatasetMatrix } from "../utils/dataset.js";
import { runPCA, runVolcano, runPLSDA, runPathway } from "../services/analysis.js";

const DEFAULT_PASSWORD = "password123";

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

async function insertDataset(
  projectId: number,
  name: string,
  type: string,
  status: string,
  missingPct: number,
  featureDefs: { id: string; name: string; cls: string; pathway: string }[],
  groups: { label: string; count: number; meanShift: number }[]
) {
  const samples: { sampleId: string; group: string }[] = [];
  let idx = 1;
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      samples.push({ sampleId: `S${String(idx++).padStart(4, "0")}`, group: g.label });
    }
  }

  const ds = await query<{ id: number }>(
    `INSERT INTO datasets (project_id, name, type, samples_count, features_count, status, missing_pct)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [projectId, name, type, samples.length, featureDefs.length, status, missingPct]
  );
  const datasetId = ds.rows[0].id;

  const sampleRows: { id: number; group: string }[] = [];
  for (const s of samples) {
    const row = await query<{ id: number }>(
      `INSERT INTO samples (dataset_id, sample_id, group_label) VALUES ($1, $2, $3) RETURNING id`,
      [datasetId, s.sampleId, s.group]
    );
    sampleRows.push({ id: row.rows[0].id, group: s.group });
  }

  const featureRows: number[] = [];
  for (const f of featureDefs) {
    const row = await query<{ id: number }>(
      `INSERT INTO features (dataset_id, feature_id, name, feature_class, pathway)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [datasetId, f.id, f.name, f.cls, f.pathway]
    );
    featureRows.push(row.rows[0].id);
  }

  for (let fi = 0; fi < featureDefs.length; fi++) {
    const base = 5 + Math.random() * 10;
    for (const sample of sampleRows) {
      const group = groups.find((g) => g.label === sample.group)!;
      let value = base + group.meanShift + randn() * 1.5;
      if (Math.random() < missingPct / 100) value = NaN;
      await query(
        `INSERT INTO feature_values (sample_id, feature_id, value) VALUES ($1, $2, $3)`,
        [sample.id, featureRows[fi], isNaN(value) ? null : Number(value.toFixed(4))]
      );
    }
  }

  return datasetId;
}

export async function seedDatabase() {
  console.log("Seeding database...");

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const users = [
    { name: "Dr. Sarah Chen", email: "sarah.chen@university.edu", role: "Administrator" },
    { name: "Dr. John Smith", email: "john.smith@research.org", role: "Researcher" },
    { name: "Dr. Emily Wang", email: "emily.wang@lab.edu", role: "Researcher" },
    { name: "Michael Brown", email: "m.brown@university.edu", role: "Analyst" },
    { name: "Dr. Lisa Martinez", email: "l.martinez@biotech.com", role: "Researcher", status: "inactive" },
    { name: "Dr. Michael Torres", email: "m.torres@biotech.com", role: "Researcher" },
  ];

  const userIds: Record<string, number> = {};
  for (const u of users) {
    const r = await query<{ id: number }>(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [u.name, u.email, hash, u.role, (u as { status?: string }).status ?? "active"]
    );
    userIds[u.email] = r.rows[0].id;
  }

  const sarahId = userIds["sarah.chen@university.edu"];

  const projects = [
    { name: "ADNI Metabolomics Study", description: "Alzheimer's Disease Neuroimaging Initiative metabolomics analysis", color: "violet", owner: sarahId },
    { name: "Cancer Biomarker Panel", description: "Multi-cancer detection using plasma metabolite signatures", color: "cyan", owner: userIds["m.torres@biotech.com"] },
    { name: "Diabetes Cohort 2024", description: "Type 2 diabetes progression metabolic profiling", color: "emerald", owner: sarahId },
    { name: "COVID-19 Severity Markers", description: "Metabolomic predictors of COVID-19 disease severity", color: "amber", owner: userIds["m.brown@university.edu"], status: "archived" },
    { name: "Microbiome-Metabolome Study", description: "Integrated analysis of gut microbiome and metabolome", color: "rose", owner: userIds["l.martinez@biotech.com"] },
  ];

  const projectIds: number[] = [];
  for (const p of projects) {
    const r = await query<{ id: number }>(
      `INSERT INTO projects (name, description, color, owner_id, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${Math.floor(Math.random() * 14)} days') RETURNING id`,
      [p.name, p.description, p.color, p.owner, (p as { status?: string }).status ?? "active"]
    );
    projectIds.push(r.rows[0].id);
  }

  const metabolites = [
    { id: "M001", name: "Glutamate", cls: "Amino Acid", pathway: "Nitrogen metabolism" },
    { id: "M002", name: "Leucine", cls: "Amino Acid", pathway: "BCAA metabolism" },
    { id: "M003", name: "Lactate", cls: "Organic Acid", pathway: "Glycolysis" },
    { id: "M004", name: "Citrate", cls: "Organic Acid", pathway: "TCA cycle" },
    { id: "M005", name: "Glucose", cls: "Sugar", pathway: "Glycolysis" },
    { id: "M006", name: "Choline", cls: "Lipid", pathway: "Phospholipid metabolism" },
    { id: "M007", name: "Creatinine", cls: "Organic Acid", pathway: "Creatine metabolism" },
    { id: "M008", name: "Tryptophan", cls: "Amino Acid", pathway: "Tryptophan metabolism" },
    { id: "M009", name: "Phenylalanine", cls: "Amino Acid", pathway: "Phenylalanine metabolism" },
    { id: "M010", name: "Succinate", cls: "Organic Acid", pathway: "TCA cycle" },
    { id: "M011", name: "Alanine", cls: "Amino Acid", pathway: "Alanine metabolism" },
    { id: "M012", name: "Glycine", cls: "Amino Acid", pathway: "Glycine metabolism" },
    { id: "M013", name: "Urate", cls: "Purine", pathway: "Purine metabolism" },
    { id: "M014", name: "Carnitine", cls: "Lipid", pathway: "Fatty acid oxidation" },
    { id: "M015", name: "Taurine", cls: "Amino Acid", pathway: "Taurine metabolism" },
    { id: "M016", name: "Pyruvate", cls: "Organic Acid", pathway: "Glycolysis" },
    { id: "M017", name: "Valine", cls: "Amino Acid", pathway: "BCAA metabolism" },
    { id: "M018", name: "Isoleucine", cls: "Amino Acid", pathway: "BCAA metabolism" },
    { id: "M019", name: "Tyrosine", cls: "Amino Acid", pathway: "Tyrosine metabolism" },
    { id: "M020", name: "Histidine", cls: "Amino Acid", pathway: "Histidine metabolism" },
  ];

  const adniDatasetId = await insertDataset(
    projectIds[0], "Plasma Samples (ADNI v3)", "Plasma LC-MS", "ready", 2.1,
    metabolites,
    [{ label: "AD", count: 30, meanShift: 2.5 }, { label: "Control", count: 30, meanShift: 0 }]
  );

  await insertDataset(
    projectIds[0], "Serum Samples (ADNI v2)", "Serum GC-MS", "ready", 8.4,
    metabolites.slice(0, 15),
    [{ label: "AD", count: 20, meanShift: 1.8 }, { label: "Control", count: 20, meanShift: 0 }]
  );

  const cancerDatasetId = await insertDataset(
    projectIds[1], "Plasma LC-MS Positive", "Plasma LC-MS", "ready", 1.5,
    metabolites,
    [{ label: "Cancer", count: 25, meanShift: 3.0 }, { label: "Healthy", count: 25, meanShift: 0 }]
  );

  const diabetesDatasetId = await insertDataset(
    projectIds[2], "Fasting Plasma", "Plasma LC-MS", "ready", 3.2,
    metabolites.slice(0, 12),
    [{ label: "Diabetic", count: 20, meanShift: 2.0 }, { label: "Control", count: 20, meanShift: 0 }]
  );

  const covidDatasetId = await insertDataset(
    projectIds[3], "Severe COVID Plasma", "Plasma LC-MS", "ready", 5.0,
    metabolites.slice(0, 10),
    [{ label: "Severe", count: 4, meanShift: 1.5 }, { label: "Mild", count: 4, meanShift: 0 }]
  );

  const experiments = [
    { projectId: projectIds[0], datasetId: adniDatasetId, userId: sarahId, name: "PCA - AD vs Control", type: "PCA", status: "completed", samples: 60, features: 20 },
    { projectId: projectIds[1], datasetId: cancerDatasetId, userId: userIds["m.torres@biotech.com"], name: "Volcano Analysis - Plasma", type: "Volcano", status: "completed", samples: 50, features: 20 },
    { projectId: projectIds[0], datasetId: adniDatasetId, userId: sarahId, name: "PLS-DA Classification", type: "PLS-DA", status: "running", samples: 60, features: 20 },
    { projectId: projectIds[2], datasetId: diabetesDatasetId, userId: userIds["emily.wang@lab.edu"], name: "Pathway Enrichment - KEGG", type: "Pathway", status: "completed", samples: 40, features: 12 },
    { projectId: projectIds[3], datasetId: covidDatasetId, userId: userIds["m.brown@university.edu"], name: "Hierarchical Clustering", type: "Clustering", status: "failed", samples: 8, features: 10, error: "Insufficient samples after QC (n=8, minimum=10)" },
  ];

  const experimentIds: number[] = [];
  for (const e of experiments) {
    const r = await query<{ id: number }>(
      `INSERT INTO experiments (project_id, dataset_id, user_id, name, type, status, samples_count, features_count, error_message, created_at, started_at, completed_at, cpu_usage, mem_usage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '${Math.floor(Math.random() * 7)} days', NOW() - INTERVAL '${Math.floor(Math.random() * 7)} days', 
       CASE WHEN $6 IN ('completed','failed') THEN NOW() - INTERVAL '${Math.floor(Math.random() * 6)} days' ELSE NULL END,
       '${Math.floor(20 + Math.random() * 70)}%', '${(1 + Math.random() * 6).toFixed(1)} GB') RETURNING id`,
      [e.projectId, e.datasetId, e.userId, e.name, e.type, e.status, e.samples, e.features, (e as { error?: string }).error ?? null]
    );
    experimentIds.push(r.rows[0].id);
  }

  for (const e of experiments) {
    if (e.status !== "completed" || !e.datasetId) continue;
    const { samples, features } = await loadDatasetMatrix(e.datasetId);
    const groups = [...new Set(samples.map((s) => s.groupLabel))];
    let results: unknown;
    switch (e.type) {
      case "PCA":
        results = runPCA(samples, 2);
        break;
      case "Volcano":
        results = runVolcano(samples, features, groups[0], groups[1] ?? groups[0]);
        break;
      case "PLS-DA":
        results = runPLSDA(samples, features, groups[0], groups[1] ?? groups[0]);
        break;
      case "Pathway":
        results = runPathway(runVolcano(samples, features, groups[0], groups[1] ?? groups[0]));
        break;
      default:
        continue;
    }
    const idx = experiments.indexOf(e);
    await query(`UPDATE experiments SET results = $1 WHERE id = $2`, [JSON.stringify(results), experimentIds[idx]]);
  }

  const notifications = [
    { userId: sarahId, type: "success", title: "Analysis Complete", message: "PCA - AD vs Control finished successfully. 60 samples processed.", link: `/experiments/${experimentIds[0]}`, linkLabel: "View results" },
    { userId: sarahId, type: "success", title: "Dataset Imported", message: "Plasma Samples (ADNI v3) imported — 20 features, 60 samples ready for analysis.", link: "/data", linkLabel: "View dataset" },
    { userId: sarahId, type: "warning", title: "Missing Values Detected", message: "Serum Samples dataset has 8.4% missing values. KNN imputation recommended before analysis.", link: "/data", linkLabel: "Review data" },
    { userId: sarahId, type: "info", title: "New Project Shared", message: "Dr. Michael Torres shared Cancer Biomarker Panel with you. You have view access.", link: "/projects", linkLabel: "Open project" },
    { userId: sarahId, type: "success", title: "PLS-DA Model Complete", message: "Classification model achieved 87.3% accuracy (AUC: 0.923) with 7-fold cross-validation.", link: `/experiments/${experimentIds[2]}`, linkLabel: "View model", read: true },
    { userId: userIds["m.brown@university.edu"], type: "error", title: "Analysis Failed", message: "Hierarchical Clustering for COVID-19 dataset failed. Insufficient samples after QC (n=8).", link: `/experiments/${experimentIds[4]}`, linkLabel: "View error log" },
  ];

  for (const n of notifications) {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, link, link_label, read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${Math.floor(Math.random() * 120)} hours')`,
      [n.userId, n.type, n.title, n.message, n.link, n.linkLabel, (n as { read?: boolean }).read ?? false]
    );
  }

  const auditEntries = [
    { userId: sarahId, name: "Dr. Sarah Chen", email: "sarah.chen@university.edu", action: "RUN_ANALYSIS", category: "analysis", resource: "Experiment: PCA - AD vs Control", details: "Initiated PCA run on Plasma Samples (n=60, p=20). Pareto scaling, KNN impute." },
    { userId: sarahId, name: "Dr. Sarah Chen", email: "sarah.chen@university.edu", action: "DATASET_IMPORT", category: "data", resource: "Dataset: Plasma Samples (ADNI v3)", details: "Imported 60 samples, 20 features from plasma_metabolomics_ADNI_v3.csv." },
    { userId: userIds["m.brown@university.edu"], name: "Michael Brown", email: "m.brown@university.edu", action: "RUN_ANALYSIS", category: "analysis", severity: "critical", resource: "Experiment: Hierarchical Clustering (FAILED)", details: "Run failed. Cause: Insufficient samples after QC (n=8, minimum=10)." },
  ];

  for (const a of auditEntries) {
    await query(
      `INSERT INTO audit_logs (user_id, user_name, user_email, action, category, severity, resource, details, ip, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '192.168.1.42', 'Chrome/126 macOS', NOW() - INTERVAL '${Math.floor(Math.random() * 72)} hours')`,
      [a.userId, a.name, a.email, a.action, a.category, (a as { severity?: string }).severity ?? "info", a.resource, a.details]
    );
  }

  const systemLogs = [
    { level: "info", email: "emily.wang@lab.edu", action: "Analysis completed", details: "PCA analysis completed for dataset 'Plasma Samples'" },
    { level: "info", email: "sarah.chen@university.edu", action: "Run started", details: "Started PCA run on Plasma Samples (n=60, p=20)" },
    { level: "error", email: "m.brown@university.edu", action: "Run failed", details: "Clustering failed: insufficient samples after QC (n=8, min=10)" },
  ];

  for (const l of systemLogs) {
    await query(
      `INSERT INTO system_logs (level, user_email, action, details, ip, created_at)
       VALUES ($1, $2, $3, $4, '192.168.1.78', NOW() - INTERVAL '${Math.floor(Math.random() * 48)} hours')`,
      [l.level, l.email, l.action, l.details]
    );
  }

  await query(
    `INSERT INTO system_settings (key, value) VALUES
     ('general', '{"appName":"MetaboAnalytics","supportEmail":"support@metaboanalytics.io","maintenanceMode":false}'),
     ('storage', '{"provider":"local","maxUploadMb":500}'),
     ('email', '{"smtpHost":"smtp.university.edu","enabled":true}')`
  );

  console.log("Database seeded successfully.");
  console.log(`Default login: sarah.chen@university.edu / ${DEFAULT_PASSWORD}`);
}
