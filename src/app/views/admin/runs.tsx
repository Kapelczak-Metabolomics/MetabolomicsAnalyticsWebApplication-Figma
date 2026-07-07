import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Search, Filter, Download, ChevronDown, CheckCircle2,
  Loader2, AlertCircle, Clock, User, Database, RefreshCw, Trash2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { downloadCsv, downloadJson } from "../../../lib/export";
import { downloadFromApi } from "../../../lib/export";

type RunStatus = "completed" | "running" | "failed" | "queued";

interface Run {
  id: string;
  name: string;
  type: string;
  project: string;
  user: string;
  userEmail: string;
  status: RunStatus;
  created: string;
  started: string;
  duration: string;
  samples: number;
  features: number;
  cpuUsage: string;
  memUsage: string;
}

const allRuns: Run[] = [];

const statusConfig: Record<RunStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  running: { label: "Running", icon: Loader2, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  failed: { label: "Failed", icon: AlertCircle, cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  queued: { label: "Queued", icon: Clock, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
};

const typeColors: Record<string, string> = {
  PCA: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "PLS-DA": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  Volcano: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  Clustering: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Pathway: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Biomarker: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
};

export function AdminRuns() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [runs, setRuns] = useState<Run[]>(allRuns);
  const [loading, setLoading] = useState(true);

  function loadRuns() {
    setLoading(true);
    api.admin.getRuns()
      .then((data) => setRuns(data.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        type: String(r.type),
        project: String(r.project),
        user: String(r.user ?? ""),
        userEmail: String(r.userEmail ?? ""),
        status: r.status as RunStatus,
        created: String(r.created),
        started: String(r.started ?? "—"),
        duration: String(r.duration),
        samples: Number(r.samples),
        features: Number(r.features),
        cpuUsage: String(r.cpuUsage ?? "—"),
        memUsage: String(r.memUsage ?? "—"),
      }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  function deleteRun(run: Run) {
    const numericId = parseInt(String(run.id).replace(/^r/, ""), 10);
    if (!window.confirm(`Delete analysis run "${run.name}" by ${run.user}? This cannot be undone.`)) return;
    api.admin.deleteRun(numericId)
      .then(() => {
        setRuns((prev) => prev.filter((r) => r.id !== run.id));
        toast.success(`"${run.name}" deleted`);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to delete run"));
  }

  useEffect(() => { loadRuns(); }, []);
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [userFilter, setUserFilter] = useState("All Users");

  const uniqueUsers = [...new Set(runs.map((r) => r.user))];
  const uniqueTypes = [...new Set(runs.map((r) => r.type))];

  const filtered = runs.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = r.name.toLowerCase().includes(q) || r.user.toLowerCase().includes(q) || r.project.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All Status" || r.status === statusFilter.toLowerCase();
    const matchType = typeFilter === "All Types" || r.type === typeFilter;
    const matchUser = userFilter === "All Users" || r.user === userFilter;
    return matchSearch && matchStatus && matchType && matchUser;
  });

  const exportRuns = (fmt: string) => {
    if (!filtered.length) { toast.error("No runs to export"); return; }
    const rows = filtered.map((r) => ({
      id: r.id.replace(/^r/, ""),
      name: r.name,
      type: r.type,
      project: r.project,
      user: r.user,
      email: r.userEmail,
      status: r.status,
      created: r.created,
      duration: r.duration,
      samples: r.samples,
      features: r.features,
      cpu: r.cpuUsage,
      memory: r.memUsage,
    }));
    if (fmt === "JSON") downloadJson("analysis-runs.json", rows);
    else downloadCsv("analysis-runs.csv", rows);
    toast.success(`Exported ${filtered.length} runs as ${fmt}`);
  };
  const counts = {
    total: runs.length,
    completed: runs.filter((r) => r.status === "completed").length,
    running: runs.filter((r) => r.status === "running").length,
    failed: runs.filter((r) => r.status === "failed").length,
    queued: runs.filter((r) => r.status === "queued").length,
  };

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">All Analysis Runs</h2>
            <p className="text-sm text-muted-foreground">Every experiment run across all users and projects</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadRuns}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
                  <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="z-50 min-w-[150px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
                  {["CSV", "JSON"].map((fmt) => (
                    <DropdownMenu.Item key={fmt} className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                      onSelect={() => exportRuns(fmt)}>
                      {fmt}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total Runs", value: counts.total, cls: "text-foreground" },
            { label: "Completed", value: counts.completed, cls: "text-emerald-600 dark:text-emerald-400" },
            { label: "Running", value: counts.running, cls: "text-amber-600 dark:text-amber-400" },
            { label: "Failed", value: counts.failed, cls: "text-rose-600 dark:text-rose-400" },
            { label: "Queued", value: counts.queued, cls: "text-blue-600 dark:text-blue-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
              <p className={`text-2xl font-semibold tabular-nums ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by run name, user, or project..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
            <option>All Status</option>
            <option>Completed</option>
            <option>Running</option>
            <option>Failed</option>
            <option>Queued</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
            <option>All Types</option>
            {uniqueTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
            <option>All Users</option>
            {uniqueUsers.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="p-3 text-left text-xs font-medium">Run Name</th>
                <th className="p-3 text-left text-xs font-medium">Type</th>
                <th className="p-3 text-left text-xs font-medium">Project</th>
                <th className="p-3 text-left text-xs font-medium">User</th>
                <th className="p-3 text-left text-xs font-medium">Created</th>
                <th className="p-3 text-left text-xs font-medium">Duration</th>
                <th className="p-3 text-left text-xs font-medium">Resources</th>
                <th className="p-3 text-left text-xs font-medium">Status</th>
                <th className="p-3 text-right text-xs font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">No runs match your filters</td></tr>
              ) : filtered.map((run) => {
                const { icon: Icon, cls } = statusConfig[run.status];
                return (
                  <tr key={run.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <p className="font-medium text-sm">{run.name}</p>
                      <p className="text-xs text-muted-foreground">{run.samples.toLocaleString()} samples · {run.features.toLocaleString()} features</p>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[run.type] ?? "bg-muted text-muted-foreground"}`}>{run.type}</span>
                    </td>
                    <td className="p-3">
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[160px]">{run.project}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-[10px] font-semibold text-white flex-shrink-0">
                          {run.user.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-xs font-medium leading-none">{run.user}</p>
                          <p className="text-xs text-muted-foreground">{run.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{run.created}</td>
                    <td className="p-3 text-xs tabular-nums text-muted-foreground">{run.duration}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {run.cpuUsage !== "—" ? (
                        <div className="space-y-0.5">
                          <div>CPU {run.cpuUsage}</div>
                          <div>MEM {run.memUsage}</div>
                        </div>
                      ) : <span>—</span>}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                        <Icon className={`h-2.5 w-2.5 ${run.status === "running" ? "animate-spin" : ""}`} />
                        {statusConfig[run.status].label}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="rounded border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent">Actions ▾</button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className="z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
                            {run.status !== "queued" && (
                              <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                                onSelect={() => navigate(`/experiments/${String(run.id).replace(/^r/, "")}`)}>
                                View Results
                              </DropdownMenu.Item>
                            )}
                            <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                              onSelect={() => navigate("/admin/users")}>
                              View User in Admin
                            </DropdownMenu.Item>
                            <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                              onSelect={() => downloadFromApi(`/experiments/${String(run.id).replace(/^r/, "")}/export?format=csv`, `${run.name}.csv`)}>
                              Download Log
                            </DropdownMenu.Item>
                            {run.status === "running" && (
                              <>
                                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                                <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-destructive/10 text-destructive"
                                  onSelect={() => api.cancelExperiment(parseInt(String(run.id).replace(/^r/, ""), 10)).then(() => { toast.success(`Run "${run.name}" cancelled`); loadRuns(); }).catch(() => toast.error("Cancel failed"))}>
                                  Cancel Run
                                </DropdownMenu.Item>
                              </>
                            )}
                            <DropdownMenu.Separator className="my-1 h-px bg-border" />
                            <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-destructive/10 text-destructive"
                              onSelect={() => deleteRun(run)}>
                              <span className="flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" /> Delete Run</span>
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            Showing {filtered.length} of {runs.length} runs
          </div>
        </div>
      </div>
    </div>
  );
}
