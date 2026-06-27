import { useState } from "react";
import { Search, Download, Filter, Info, AlertTriangle, XCircle, Activity } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";

const logs = [
  { id: 1, timestamp: "2025-06-27 14:23:15", level: "info", user: "sarah.chen@university.edu", action: "Project created", details: "Created project 'ADNI Metabolomics Study'", ip: "192.168.1.45" },
  { id: 2, timestamp: "2025-06-27 14:18:42", level: "info", user: "system", action: "Backup completed", details: "Database backup completed successfully (42.8 GB)", ip: "127.0.0.1" },
  { id: 3, timestamp: "2025-06-27 13:56:23", level: "warning", user: "john.smith@research.org", action: "Failed login attempt", details: "Incorrect password (3/5 attempts)", ip: "203.45.67.89" },
  { id: 4, timestamp: "2025-06-27 13:42:11", level: "info", user: "emily.wang@lab.edu", action: "Analysis completed", details: "PCA analysis completed for dataset 'Plasma Samples'", ip: "192.168.1.78" },
  { id: 5, timestamp: "2025-06-27 12:34:56", level: "error", user: "system", action: "Analysis failed", details: "PLS-DA analysis failed: Out of memory (8 GB limit)", ip: "127.0.0.1" },
  { id: 6, timestamp: "2025-06-27 11:23:45", level: "info", user: "sarah.chen@university.edu", action: "Settings updated", details: "Updated email notification preferences", ip: "192.168.1.45" },
  { id: 7, timestamp: "2025-06-27 10:15:32", level: "info", user: "m.brown@university.edu", action: "Data exported", details: "Exported volcano plot results (CSV, 1247 features)", ip: "192.168.1.92" },
  { id: 8, timestamp: "2025-06-27 09:47:18", level: "warning", user: "system", action: "High CPU usage", details: "CPU usage exceeded 85% for 5 minutes", ip: "127.0.0.1" },
  { id: 9, timestamp: "2025-06-27 09:14:32", level: "info", user: "sarah.chen@university.edu", action: "Run started", details: "Started PCA run on Plasma Samples (n=342, p=1247)", ip: "192.168.1.45" },
  { id: 10, timestamp: "2025-06-26 23:00:00", level: "info", user: "system", action: "Scheduled backup", details: "Nightly S3 backup initiated", ip: "127.0.0.1" },
  { id: 11, timestamp: "2025-06-26 17:22:14", level: "warning", user: "admin@metaboanalytics.com", action: "Config changed", details: "S3 bucket updated to production endpoint", ip: "10.0.0.1" },
  { id: 12, timestamp: "2025-06-26 16:44:09", level: "error", user: "m.brown@university.edu", action: "Run failed", details: "Clustering failed: insufficient samples after QC (n=8, min=10)", ip: "172.16.0.88" },
];

const levelConfig: Record<string, { icon: typeof Info; cls: string; dot: string }> = {
  info:    { icon: Info,          cls: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",   dot: "bg-cyan-500" },
  warning: { icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  error:   { icon: XCircle,       cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400",    dot: "bg-rose-500" },
};

export function AdminLogs() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All Levels");
  const [timeFilter, setTimeFilter] = useState("Last 24 hours");

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchSearch = log.action.toLowerCase().includes(q) || log.user.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
    const matchLevel = levelFilter === "All Levels" || log.level === levelFilter.toLowerCase();
    return matchSearch && matchLevel;
  });

  const infoCount    = logs.filter((l) => l.level === "info").length;
  const warnCount    = logs.filter((l) => l.level === "warning").length;
  const errorCount   = logs.filter((l) => l.level === "error").length;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Activity Logs</h2>
            <p className="text-sm text-muted-foreground">System and user activity log stream</p>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">
                <Download className="h-4 w-4" /> Export Logs
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-[150px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
                {["CSV", "JSON", "Plain text"].map((fmt) => (
                  <DropdownMenu.Item key={fmt} className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                    onSelect={() => toast.success(`Logs exported as ${fmt}`)}>
                    {fmt}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Stats — top */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Events</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums">12,847</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-cyan-600/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-4 w-4 text-cyan-500" />
              <p className="text-xs text-muted-foreground">Info</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">11,234</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">1,456</p>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-rose-600/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-rose-500" />
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">157</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, user, or details..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
          </div>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
            <option>All Levels</option>
            <option>Info</option>
            <option>Warning</option>
            <option>Error</option>
          </select>
          <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>All time</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="p-3 text-left text-xs font-medium">Timestamp</th>
                <th className="p-3 text-left text-xs font-medium">Level</th>
                <th className="p-3 text-left text-xs font-medium">User</th>
                <th className="p-3 text-left text-xs font-medium">Action</th>
                <th className="p-3 text-left text-xs font-medium">Details</th>
                <th className="p-3 text-left text-xs font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No logs match your filters</td></tr>
              ) : filtered.map((log) => {
                const { icon: Icon, cls, dot } = levelConfig[log.level] ?? levelConfig.info;
                return (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="p-3 font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                        {log.level}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{log.user}</td>
                    <td className="p-3 text-xs font-medium">{log.action}</td>
                    <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{log.details}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{log.ip}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            Showing {filtered.length} of {logs.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}
