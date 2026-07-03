import express from "express";
import cors from "cors";
import { waitForDb, initSchema, isSeeded } from "./db/index.js";
import { seedDatabase } from "./db/seed.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import datasetRoutes from "./routes/datasets.js";
import experimentRoutes from "./routes/experiments.js";
import notificationRoutes from "./routes/notifications.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
import profileRoutes from "./routes/profile.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/experiments", experimentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);

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
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
