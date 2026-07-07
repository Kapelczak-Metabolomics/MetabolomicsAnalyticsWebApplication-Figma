import fs from "fs";
import os from "os";
import path from "path";

function diskUsageForPath(targetPath: string) {
  try {
    const stat = fs.statfsSync(targetPath);
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bfree) * Number(stat.bsize);
    const used = total - free;
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    return { total, used, free, pct };
  } catch {
    return { total: 0, used: 0, free: 0, pct: 0 };
  }
}

function dirSizeBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) stack.push(full);
        else if (entry.isFile()) total += fs.statSync(full).size;
      } catch {
        // skip unreadable files
      }
    }
  }
  return total;
}

export function getSystemHealth() {
  const cpus = os.cpus().length || 1;
  const load = os.loadavg()[0] ?? 0;
  const cpuPct = Math.min(100, Math.round((load / cpus) * 100));

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memPct = Math.round(((totalMem - freeMem) / totalMem) * 100);

  const rawDir = process.env.RAW_DATA_DIR || "/data/raw";
  const disk = diskUsageForPath(rawDir);

  return {
    cpu: cpuPct,
    memory: memPct,
    disk: disk.pct,
    diskFreeGb: Number((disk.free / 1024 / 1024 / 1024).toFixed(2)),
    diskTotalGb: Number((disk.total / 1024 / 1024 / 1024).toFixed(2)),
    diskUsedGb: Number((disk.used / 1024 / 1024 / 1024).toFixed(2)),
    loadAvg: os.loadavg().map((v) => Number(v.toFixed(2))),
    uptimeSeconds: Math.floor(os.uptime()),
    processUptimeSeconds: Math.floor(process.uptime()),
    hostname: os.hostname(),
    rawDataBytes: dirSizeBytes(rawDir),
  };
}

export function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getProcessUsage() {
  const mem = process.memoryUsage();
  const heapGb = mem.heapUsed / 1024 / 1024 / 1024;
  const cpus = os.cpus().length || 1;
  const load = os.loadavg()[0] ?? 0;
  const cpuPct = Math.min(100, Math.round((load / cpus) * 100));
  return {
    cpu: `${cpuPct}%`,
    mem: `${heapGb.toFixed(2)} GB`,
  };
}
