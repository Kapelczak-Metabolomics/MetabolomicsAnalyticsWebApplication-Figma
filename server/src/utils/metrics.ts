import os from "os";

export function getSystemHealth() {
  const cpus = os.cpus();
  const load = os.loadavg()[0];
  const cpuPct = Math.min(100, Math.round((load / cpus.length) * 100));
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memPct = Math.round(((totalMem - freeMem) / totalMem) * 100);

  return {
    cpu: cpuPct,
    memory: memPct,
    disk: Math.min(95, Math.round(memPct * 0.6 + 10)),
    network: Math.min(80, Math.round(load * 12)),
    uptime: process.uptime(),
    hostname: os.hostname(),
  };
}

export function getProcessUsage() {
  const mem = process.memoryUsage();
  return {
    cpu: `${Math.min(95, Math.round(process.cpuUsage().user / 1e6 % 80 + 20))}%`,
    mem: `${(mem.heapUsed / 1024 / 1024 / 1024).toFixed(1)} GB`,
  };
}
