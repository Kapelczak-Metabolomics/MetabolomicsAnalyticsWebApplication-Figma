import { useState, useEffect, useCallback } from "react";
import { Search, Download, Info, AlertTriangle, XCircle, Activity, Trash2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { downloadCsv, downloadJson } from "../../../lib/export";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

type LogEntry = {
  id: number;
  timestamp: string;
  level: string;
  user: string;
  action: string;
  details: string;
  ip: string;
};

const levelConfig: Record<string, { icon: typeof Info; cls: string; dot: string }> = {
  info:    { icon: Info,          cls: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",   dot: "bg-cyan-500" },
  warning: { icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  error:   { icon: XCircle,       cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400",    dot: "bg-rose-500" },
};

function sinceFromTimeFilter(timeFilter: string): string | undefined {
  if (timeFilter === "Last 24 hours") return "24 hours";
  if (timeFilter === "Last 7 days") return "7 days";
  if (timeFilter === "Last 30 days") return "30 days";
  return undefined;
}

export function AdminLogs() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All Levels");
  const [timeFilter, setTimeFilter] = useState("Last 24 hours");
  const [logData, setLogData] = useState<LogEntry[]>([]);
  const [clearScope, setClearScope] = useState<"all" | "older">("all");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadLogs = useCallback(() => {
    const since = sinceFromTimeFilter(timeFilter);
    api.admin.getLogs(since)
      .then((data) => {
        const logs = data.logs ?? data;
        const arr = Array.isArray(logs) ? logs : [];
        setLogData(arr.map((l) => ({
          id: Number(l.id),
          timestamp: String(l.timestamp),
          level: String(l.level),
          user: String(l.user ?? "system"),
          action: String(l.action),
          details: String(l.details),
          ip: String(l.ip ?? ""),
        })));
      })
      .catch(console.error);
  }, [timeFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = logData.filter((log) => {
    const q = search.toLowerCase();
    const matchSearch = log.action.toLowerCase().includes(q) || log.user.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
    const matchLevel = levelFilter === "All Levels" || log.level === levelFilter.toLowerCase();
    return matchSearch && matchLevel;
  });

  const exportLogs = (fmt: string) => {
    if (!filtered.length) { toast.error("No logs to export"); return; }
    if (fmt === "JSON") downloadJson("activity-logs.json", filtered);
    else if (fmt === "CSV") downloadCsv("activity-logs.csv", filtered as unknown as Array<Record<string, unknown>>);
    else downloadCsv("activity-logs.txt", filtered.map((l) => ({ line: `${l.timestamp} [${l.level}] ${l.user}: ${l.action} — ${l.details}` })));
    toast.success(`Logs exported as ${fmt}`);
  };

  async function handleClearLogs() {
    setClearing(true);
    try {
      const olderThan = clearScope === "older" ? sinceFromTimeFilter(timeFilter) ?? "30 days" : undefined;
      const result = await api.admin.clearLogs(olderThan);
      toast.success(`Cleared ${result.deleted} log ${result.deleted === 1 ? "entry" : "entries"}`);
      setClearOpen(false);
      loadLogs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear logs");
    } finally {
      setClearing(false);
    }
  }

  const infoCount    = logData.filter((l) => l.level === "info").length;
  const warnCount    = logData.filter((l) => l.level === "warning").length;
  const errorCount   = logData.filter((l) => l.level === "error").length;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Activity Logs</h2>
            <p className="text-sm text-muted-foreground">System and user activity log stream</p>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
              <AlertDialogTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400">
                  <Trash2 className="h-4 w-4" /> Clear Logs
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear activity logs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes system activity log entries. The action itself is recorded in the audit trail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={clearScope === "all"} onChange={() => setClearScope("all")} />
                    Clear all activity logs
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={clearScope === "older"} onChange={() => setClearScope("older")} />
                    Clear logs older than current time filter ({timeFilter.toLowerCase()})
                  </label>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={clearing}
                    onClick={(e) => { e.preventDefault(); void handleClearLogs(); }}
                    className="bg-rose-600 hover:bg-rose-700"
                  >
                    {clearing ? "Clearing…" : "Clear logs"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                      onSelect={() => exportLogs(fmt)}>
                      {fmt}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 max-sm:grid-cols-2 max-sm:gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Events</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{logData.length}</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-cyan-600/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-4 w-4 text-cyan-500" />
              <p className="text-xs text-muted-foreground">Info</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">{infoCount.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{warnCount.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-rose-600/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-rose-500" />
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">{errorCount.toLocaleString()}</p>
          </div>
        </div>

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
                const { cls, dot } = levelConfig[log.level] ?? levelConfig.info;
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
            Showing {filtered.length} of {logData.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}
