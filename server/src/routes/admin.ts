import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { query } from "../db/index.js";
import { authMiddleware, adminMiddleware, logAudit } from "../middleware/auth.js";
import { formatRelativeTime, formatDuration } from "../utils/dataset.js";
import { getSystemHealth, formatUptime, getProcessUsage } from "../utils/metrics.js";
import {
  testS3Connection,
  getS3BucketStats,
  sanitizeS3ForResponse,
  loadS3Config,
  type S3Config,
} from "../services/s3.js";
import { loadEmailConfig, sanitizeEmailForResponse, sendUserWelcomeEmail, trySendPasswordReset, verifySmtpConnection, type EmailConfig } from "../services/email.js";
import { getActiveStorageProvider } from "../services/storage.js";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/health", async (_req: Request, res: Response) => {
  res.json(getSystemHealth());
});

router.get("/stats", async (_req: Request, res: Response) => {
  const [users, projects, running, alerts, newUsers, imports, sessions, storage] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users"),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM projects WHERE status = 'active'"),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM experiments WHERE status = 'running'"),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM system_logs WHERE level = 'error' AND created_at > NOW() - INTERVAL '7 days'"),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users WHERE created_at > date_trunc('month', NOW())"),
    query<{ count: string }>("SELECT COUNT(*)::text AS count FROM audit_logs WHERE action = 'DATASET_IMPORT' AND created_at > NOW() - INTERVAL '30 days'"),
    query<{ count: string }>("SELECT COUNT(DISTINCT user_id)::text AS count FROM audit_logs WHERE action = 'LOGIN' AND created_at > NOW() - INTERVAL '7 days'"),
    query<{ bytes: string }>("SELECT COALESCE(SUM(pg_column_size(fv.value)), 0)::text AS bytes FROM feature_values fv"),
  ]);

  const health = getSystemHealth();
  const uptimeLabel = formatUptime(health.uptimeSeconds);

  res.json({
    totalUsers: parseInt(users.rows[0].count, 10),
    activeProjects: parseInt(projects.rows[0].count, 10),
    runningAnalyses: parseInt(running.rows[0].count, 10),
    systemAlerts: parseInt(alerts.rows[0].count, 10),
    newUsersThisMonth: parseInt(newUsers.rows[0].count, 10),
    importsThisMonth: parseInt(imports.rows[0].count, 10),
    activeSessions: parseInt(sessions.rows[0].count, 10),
    storageGb: Number((parseInt(storage.rows[0].bytes, 10) / 1024 / 1024 / 1024).toFixed(1)),
    uptime: uptimeLabel,
    health,
  });
});

router.get("/activity", async (_req: Request, res: Response) => {
  const result = await query<{ user_name: string; action: string; created_at: Date }>(
    `SELECT user_name, action, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10`
  );
  res.json(result.rows.map((r) => ({
    user: r.user_name,
    action: r.action,
    time: formatRelativeTime(r.created_at),
  })));
});

router.get("/users", async (_req: Request, res: Response) => {
  const result = await query<{
    id: number; name: string; email: string; role: string; status: string; last_active_at: Date; project_count: string;
  }>(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.last_active_at,
            COUNT(DISTINCT p.id)::text AS project_count
     FROM users u LEFT JOIN projects p ON p.owner_id = u.id
     GROUP BY u.id ORDER BY u.name`
  );

  res.json(
    result.rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      lastActive: formatRelativeTime(u.last_active_at),
      projects: parseInt(u.project_count, 10),
    }))
  );
});

router.post("/users", async (req: Request, res: Response) => {
  const { name, email, role } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: "Name and email required" });
    return;
  }
  const hash = await bcrypt.hash("changeme123", 10);
  const result = await query<{ id: number }>(
    `INSERT INTO users (name, email, password_hash, role, status) VALUES ($1, $2, $3, $4, 'inactive') RETURNING id`,
    [name, email.toLowerCase(), hash, role ?? "Researcher"]
  );
  try {
    const emailCfg = await loadEmailConfig();
    await sendUserWelcomeEmail(email.toLowerCase(), name, "changeme123", emailCfg);
  } catch (err) {
    console.log(`[admin-create-user] Email not sent for ${email}:`, err instanceof Error ? err.message : err);
  }
  await logAudit(req.user, "CREATE_USER", "admin", `User: ${email}`, `Invited user ${name}`, req);
  res.status(201).json({ id: result.rows[0].id });
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  const { role, status } = req.body;
  await query(
    `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status) WHERE id = $3`,
    [role, status, req.params.id]
  );
  res.json({ success: true });
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  await query("DELETE FROM users WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

router.post("/users/:id/reset-password", async (req: Request, res: Response) => {
  const user = await query<{ email: string }>("SELECT email FROM users WHERE id = $1", [req.params.id]);
  if (!user.rows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
    [req.params.id, token]
  );
  const emailResult = await trySendPasswordReset(user.rows[0].email, token);
  await logAudit(req.user, "RESET_PASSWORD", "admin", `User #${req.params.id}`, "Password reset initiated", req);
  res.json({
    success: true,
    message: emailResult.sent
      ? `Password reset email sent to ${user.rows[0].email}`
      : `Password reset link generated for ${user.rows[0].email} (check server logs — SMTP not configured)`,
  });
});

router.get("/runs", async (_req: Request, res: Response) => {
  const result = await query<{
    id: number; name: string; type: string; status: string; samples_count: number; features_count: number;
    cpu_usage: string; mem_usage: string; created_at: Date; started_at: Date | null; completed_at: Date | null;
    project_name: string; user_name: string; user_email: string;
  }>(
    `SELECT e.*, p.name AS project_name, u.name AS user_name, u.email AS user_email
     FROM experiments e
     JOIN projects p ON p.id = e.project_id
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.created_at DESC`
  );

  res.json(
    result.rows.map((r) => ({
      id: `r${r.id}`,
      name: r.name,
      type: r.type,
      project: r.project_name,
      user: r.user_name,
      userEmail: r.user_email,
      status: r.status,
      created: new Date(r.created_at).toISOString().slice(0, 16).replace("T", " "),
      started: r.started_at ? new Date(r.started_at).toISOString().slice(0, 16).replace("T", " ") : null,
      duration: r.started_at && r.completed_at ? formatDuration(new Date(r.started_at), new Date(r.completed_at)) : r.status === "running" ? "In progress" : "—",
      samples: r.samples_count,
      features: r.features_count,
      cpuUsage: r.cpu_usage,
      memUsage: r.mem_usage,
    }))
  );
});

router.delete("/runs/:id", async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id).replace(/^r/, ""), 10);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid run id" });
    return;
  }

  const exp = await query<{ id: number; name: string; type: string; status: string }>(
    "SELECT id, name, type, status FROM experiments WHERE id = $1",
    [id]
  );
  if (!exp.rows[0]) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  await query("DELETE FROM experiments WHERE id = $1", [id]);
  await logAudit(
    req.user,
    "DELETE_RUN",
    "admin",
    `Experiment: ${exp.rows[0].name}`,
    `Admin deleted ${exp.rows[0].type} run #${id} (${exp.rows[0].status})`,
    req
  );
  res.json({ success: true });
});

router.get("/logs", async (req: Request, res: Response) => {
  const since = req.query.since as string | undefined;
  const params: unknown[] = [];
  let sql = `SELECT id, level, user_email, action, details, ip, created_at FROM system_logs`;
  if (since) {
    sql += ` WHERE created_at > NOW() - INTERVAL '${since}'`;
  }
  sql += ` ORDER BY created_at DESC LIMIT 200`;

  const result = await query<{
    id: number; level: string; user_email: string; action: string; details: string; ip: string; created_at: Date;
  }>(sql, params);

  const counts = {
    total: result.rows.length,
    info: result.rows.filter((l) => l.level === "info").length,
    warning: result.rows.filter((l) => l.level === "warning").length,
    error: result.rows.filter((l) => l.level === "error").length,
  };

  res.json({
    counts,
    logs: result.rows.map((l) => ({
      id: l.id,
      timestamp: new Date(l.created_at).toISOString().slice(0, 19).replace("T", " "),
      level: l.level,
      user: l.user_email,
      action: l.action,
      details: l.details,
      ip: l.ip,
    })),
  });
});

router.get("/audit", async (_req: Request, res: Response) => {
  const result = await query<{
    id: number; user_name: string; user_email: string; action: string; category: string; severity: string;
    resource: string; details: string; ip: string; user_agent: string; created_at: Date;
  }>(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50`
  );

  res.json(
    result.rows.map((a) => ({
      id: `a${a.id}`,
      timestamp: new Date(a.created_at).toISOString().slice(0, 19).replace("T", " "),
      user: a.user_name,
      userEmail: a.user_email,
      action: a.action,
      category: a.category,
      severity: a.severity,
      resource: a.resource,
      details: a.details,
      ip: a.ip,
      userAgent: a.user_agent,
    }))
  );
});

router.get("/system", async (_req: Request, res: Response) => {
  const result = await query<{ key: string; value: unknown }>("SELECT key, value FROM system_settings");
  const settings: Record<string, unknown> = {};
  for (const row of result.rows) settings[row.key] = row.value;
  if (settings.s3 && typeof settings.s3 === "object") {
    settings.s3 = sanitizeS3ForResponse(settings.s3 as S3Config);
  }
  if (settings.email && typeof settings.email === "object") {
    settings.email = sanitizeEmailForResponse(settings.email as EmailConfig);
  }
  const provider = await getActiveStorageProvider();
  settings.storage = { ...(settings.storage as object), provider };
  res.json(settings);
});

router.get("/storage", async (_req: Request, res: Response) => {
  const health = getSystemHealth();
  const dbSize = await query<{ bytes: string }>("SELECT pg_database_size(current_database())::text AS bytes");
  const settings = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key = 's3'");
  const s3Config = settings.rows[0]?.value as S3Config | undefined;
  const activeProvider = await getActiveStorageProvider();

  let s3: Awaited<ReturnType<typeof getS3BucketStats>> | { connected: false; error?: string } = { connected: false };
  if (s3Config?.bucket && s3Config.accessKeyId && s3Config.secretAccessKey) {
    try {
      s3 = await getS3BucketStats(s3Config);
    } catch (err) {
      s3 = { connected: false, error: err instanceof Error ? err.message : "S3 connection failed" };
    }
  }

  const dbBytes = parseInt(dbSize.rows[0].bytes, 10);
  res.json({
    local: {
      rawDataBytes: health.rawDataBytes,
      rawDataGb: Number((health.rawDataBytes / 1024 / 1024 / 1024).toFixed(2)),
      databaseBytes: dbBytes,
      databaseGb: Number((dbBytes / 1024 / 1024 / 1024).toFixed(2)),
      diskUsedGb: health.diskUsedGb,
      diskTotalGb: health.diskTotalGb,
      diskFreeGb: health.diskFreeGb,
      diskPct: health.disk,
    },
    s3,
    provider: activeProvider,
  });
});

router.patch("/system", async (req: Request, res: Response) => {
  const { key, value, settings } = req.body;
  if (settings && typeof settings === "object") {
    const incoming = settings as Record<string, unknown>;
    if (incoming.s3 && typeof incoming.s3 === "object") {
      const existing = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key = 's3'");
      const prev = (existing.rows[0]?.value ?? {}) as S3Config;
      const next = incoming.s3 as S3Config;
      if (!next.secretAccessKey || next.secretAccessKey.includes("••••")) {
        next.secretAccessKey = prev.secretAccessKey;
      }
      incoming.s3 = next;
    }
    if (incoming.email && typeof incoming.email === "object") {
      const existing = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key = 'email'");
      const prev = (existing.rows[0]?.value ?? {}) as EmailConfig;
      const next = incoming.email as EmailConfig;
      if (!next.password || next.password.includes("••••")) {
        next.password = prev.password;
      }
      incoming.email = next;
    }
    for (const [k, v] of Object.entries(incoming)) {
      await query(
        `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [k, JSON.stringify(v)]
      );
    }
    await logAudit(req.user, "UPDATE_SETTINGS", "admin", "Bulk settings", "System settings updated", req);
    res.json({ success: true });
    return;
  }
  await query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
  await logAudit(req.user, "UPDATE_SETTINGS", "admin", `Settings: ${key}`, "System settings updated", req);
  res.json({ success: true });
});

router.post("/system/test-s3", async (req: Request, res: Response) => {
  const body = req.body as S3Config;
  let config = body;
  if (!config.secretAccessKey || config.secretAccessKey.includes("••••")) {
    const existing = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key = 's3'");
    const prev = (existing.rows[0]?.value ?? {}) as S3Config;
    config = { ...prev, ...body, secretAccessKey: prev.secretAccessKey };
  }
  if (!config.bucket) {
    res.status(400).json({ error: "Bucket name required" });
    return;
  }
  if (!config.accessKeyId || !config.secretAccessKey) {
    res.status(400).json({ error: "Access key and secret are required to test S3" });
    return;
  }
  try {
    const result = await testS3Connection(config);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "S3 connection failed" });
  }
});

router.post("/system/test-email", async (req: Request, res: Response) => {
  const body = req.body as EmailConfig & { testRecipient?: string };
  let config = body;
  const existing = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key = 'email'");
  const prev = (existing.rows[0]?.value ?? {}) as EmailConfig;
  if (!config.password || config.password.includes("••••")) {
    config = { ...prev, ...body, password: prev.password };
  }
  if (!config.host && !config.smtpHost) {
    res.status(400).json({ error: "SMTP host required" });
    return;
  }
  try {
    const result = await verifySmtpConnection(config, body.testRecipient || req.user?.email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "SMTP connection failed" });
  }
});

export default router;
