import { useEffect, useState } from "react";
import { Users, Database, Activity, AlertCircle, Play, ClipboardList, Settings, ScrollText, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../../lib/api";

const stats = [
  { label: "Total Users", value: "—", change: "—", color: "violet", icon: Users, key: "totalUsers" },
  { label: "Active Projects", value: "—", change: "—", color: "cyan", icon: Database, key: "activeProjects" },
  { label: "Server Uptime", value: "—", change: "—", color: "emerald", icon: Activity, key: "uptime" },
  { label: "System Alerts", value: "—", change: "—", color: "amber", icon: AlertCircle, key: "systemAlerts" },
];

const colorMap: Record<string, { border: string; bg: string; icon: string; text: string }> = {
  violet: { border: "border-violet-500/20", bg: "from-violet-500/5 to-violet-600/10", icon: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  cyan:   { border: "border-cyan-500/20",   bg: "from-cyan-500/5 to-cyan-600/10",     icon: "bg-cyan-500/10",   text: "text-cyan-600 dark:text-cyan-400" },
  emerald:{ border: "border-emerald-500/20",bg: "from-emerald-500/5 to-emerald-600/10",icon:"bg-emerald-500/10",text: "text-emerald-600 dark:text-emerald-400" },
  amber:  { border: "border-amber-500/20",  bg: "from-amber-500/5 to-amber-600/10",   icon: "bg-amber-500/10",  text: "text-amber-600 dark:text-amber-400" },
};

const quickActions = [
  { href: "/admin/users",  icon: Users,        color: "violet",  label: "User Management",  desc: "Manage users, roles, and permissions" },
  { href: "/admin/runs",   icon: Play,         color: "cyan",    label: "All Runs",          desc: "View every analysis run across all users" },
  { href: "/admin/audit",  icon: ClipboardList,color: "rose",    label: "Audit Trail",       desc: "Full log of all user and system actions" },
  { href: "/admin/system", icon: Settings,     color: "emerald", label: "System Settings",   desc: "Configure S3, email, branding, and more" },
  { href: "/admin/logs",   icon: ScrollText,   color: "amber",   label: "Activity Logs",     desc: "System-level logs and diagnostics" },
];

const iconColorMap: Record<string, string> = {
  violet: "text-violet-500", cyan: "text-cyan-500", rose: "text-rose-500",
  emerald: "text-emerald-500", amber: "text-amber-500",
};

const recentActivity: Array<{ user: string; action: string; time: string }> = [];

export function AdminDashboard() {
  const [statData, setStatData] = useState<Record<string, string | number>>({});
  const [activity, setActivity] = useState(recentActivity);
  const [health, setHealth] = useState({ cpu: 0, memory: 0, disk: 0, loadAvg: [0, 0, 0] as number[] });

  useEffect(() => {
    api.admin.getStats().then((s) => {
      setStatData(s as unknown as Record<string, string | number>);
      if (s.health && typeof s.health === "object") {
        const h = s.health as { cpu: number; memory: number; disk: number; loadAvg?: number[] };
        setHealth({ cpu: h.cpu, memory: h.memory, disk: h.disk, loadAvg: h.loadAvg ?? [0, 0, 0] });
      }
    }).catch(console.error);
    api.admin.getHealth().then((h) => setHealth({ cpu: h.cpu, memory: h.memory, disk: h.disk, loadAvg: h.loadAvg })).catch(console.error);
    api.admin.getActivity().then(setActivity).catch(console.error);
  }, []);

  const resourcesOk = health.cpu < 90 && health.memory < 90 && health.disk < 95;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Admin Dashboard</h2>
            <p className="text-sm text-muted-foreground">System overview and management</p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
            resourcesOk ? "bg-emerald-500/10" : "bg-amber-500/10"
          }`}>
            <div className={`h-2 w-2 rounded-full animate-pulse ${resourcesOk ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className={`text-xs font-medium ${resourcesOk ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
              {resourcesOk ? "Resources within normal range" : "Elevated resource usage"}
            </span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4 max-sm:grid-cols-2 max-sm:gap-3">
          {stats.map(({ label, change, color, icon: Icon, key }) => {
            const c = colorMap[color];
            const value = statData[key] ?? "—";
            return (
              <div key={label} className={`rounded-lg border ${c.border} bg-gradient-to-br ${c.bg} p-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${c.text}`}>{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{change}</p>
                  </div>
                  <div className={`rounded-lg ${c.icon} p-2.5`}>
                    <Icon className={`h-5 w-5 ${c.text}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick actions */}
        <div>
          <h3 className="text-sm font-medium mb-3">Admin Sections</h3>
          <div className="grid grid-cols-5 gap-3">
            {quickActions.map(({ href, icon: Icon, color, label, desc }) => (
              <Link key={href} to={href}
                className="group rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/20">
                <Icon className={`h-5 w-5 ${iconColorMap[color]}`} />
                <h3 className="mt-3 text-sm font-medium group-hover:text-primary leading-snug">{label}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-snug">{desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity + usage side by side */}
        <div className="grid grid-cols-[1fr,320px] gap-4">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">Recent System Activity</h3>
              <Link to="/admin/audit" className="text-xs text-primary hover:underline">View audit trail →</Link>
            </div>
            <div className="divide-y divide-border">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-[10px] font-semibold text-white">
                      {a.user.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.user}</p>
                      <p className="text-xs text-muted-foreground">{a.action}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-3">{a.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-500" /> Resource Usage
              </h3>
              <div className="space-y-3">
                {[
                  { label: "CPU load", value: health.cpu, color: "bg-violet-500", sub: `1m avg ${health.loadAvg[0]?.toFixed(2) ?? "—"}` },
                  { label: "Memory", value: health.memory, color: "bg-cyan-500", sub: null },
                  { label: "Disk", value: health.disk, color: "bg-emerald-500", sub: null },
                ].map(({ label, value, color, sub }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="tabular-nums font-medium">{value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
                    </div>
                    {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-medium mb-3">Quick Stats</h3>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Running analyses", value: String(statData.runningAnalyses ?? "—") },
                  { label: "Datasets imported (30d)", value: String(statData.importsThisMonth ?? "—") },
                  { label: "Active sessions (7d)", value: String(statData.activeSessions ?? "—") },
                  { label: "New users (month)", value: String(statData.newUsersThisMonth ?? "—") },
                  { label: "Storage used", value: statData.storageGb ? `${statData.storageGb} GB` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
