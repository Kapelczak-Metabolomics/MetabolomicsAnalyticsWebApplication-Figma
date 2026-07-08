import express from "express";
import cors from "cors";
import { waitForDb, initSchema, isSeeded, query } from "./db/index.js";
import { seedDatabase } from "./db/seed.js";
import { ensureDefaultMetaboliteTargets } from "./services/metabolite-targets.js";
import { logSystem } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import datasetRoutes from "./routes/datasets.js";
import experimentRoutes from "./routes/experiments.js";
import notificationRoutes from "./routes/notifications.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
import profileRoutes from "./routes/profile.js";
import analysisRoutes from "./routes/analysis.js";
import lensesRoutes from "./routes/lenses.js";
import helpRoutes from "./routes/help.js";
import { pythonHealth, getPythonServiceUrl } from "./services/python-client.js";

const app = express();
const PORT = parseInt(process.env.PORT || "47822", 10);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", async (_req, res) => {
  const python = await pythonHealth();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    python: python.ok,
    pythonUrl: getPythonServiceUrl(),
    pythonError: python.ok ? undefined : python.error,
    upload: {
      maxMb: 500,
      storage: "disk",
    },
    help: python.ok
      ? undefined
      : "Python service unreachable. In EasyPanel: open the compose stack → ensure the python service is running (green) → check python logs → redeploy python + api.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/experiments", experimentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/lenses", lensesRoutes);
app.use("/api/help", helpRoutes);

async function backfillSystemLogsFromAudit() {
  const existing = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM system_logs");
  if (parseInt(existing.rows[0].count, 10) > 0) return;

  const audits = await query<{
    action: string;
    severity: string;
    resource: string;
    details: string;
    user_email: string | null;
    user_id: number | null;
    ip: string | null;
    created_at: Date;
  }>(
    `SELECT action, severity, resource, details, user_email, user_id, ip, created_at
     FROM audit_logs ORDER BY created_at ASC LIMIT 500`
  );

  for (const row of audits.rows) {
    const level =
      row.severity === "critical" || row.severity === "error"
        ? "error"
        : row.severity === "warning"
          ? "warning"
          : "info";
    const details = row.resource ? `${row.resource}: ${row.details}` : row.details;
    await query(
      `INSERT INTO system_logs (level, user_id, user_email, action, details, ip, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [level, row.user_id, row.user_email, row.action, details, row.ip, row.created_at]
    );
  }

  if (audits.rows.length) {
    console.log(`Backfilled ${audits.rows.length} activity log entries from audit trail`);
  }
}

async function start() {
  console.log("Starting MetaboAnalytics API...");
  await waitForDb();
  console.log("Database connected.");
  await initSchema();
  console.log("Schema initialized.");

  if (!(await isSeeded())) {
    await seedDatabase();
  } else {
    console.log("Database already seeded, skipping.");
    await ensureDefaultMetaboliteTargets();
  }

  await backfillSystemLogsFromAudit();

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`API server listening on port ${PORT}`);
    await logSystem("info", "SERVER_START", `API server listening on port ${PORT}`);
    const python = await pythonHealth();
    if (!python.ok) {
      await logSystem("warning", "PYTHON_UNREACHABLE", python.error ?? "Python service health check failed");
    }
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
