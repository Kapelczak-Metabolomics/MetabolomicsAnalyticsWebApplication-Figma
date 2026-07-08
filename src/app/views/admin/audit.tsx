import { useState, useEffect } from "react";
import {
  Search, Download, ChevronDown, Shield, Info,
  AlertTriangle, CheckCircle2, LogIn, LogOut, Settings,
  Trash2, Upload, Play, UserCog, Key, Eye,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { downloadCsv, downloadJson, downloadText } from "../../../lib/export";

type AuditSeverity = "info" | "warning" | "critical" | "success";
type AuditCategory = "auth" | "data" | "analysis" | "admin" | "export";

interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  userEmail: string;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  resource: string;
  details: string;
  ip: string;
  userAgent: string;
}

const events: AuditEvent[] = [];

const severityConfig: Record<AuditSeverity, { icon: typeof Info; cls: string; dot: string }> = {
  info: { icon: Info, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  success: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  warning: { icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  critical: { icon: Shield, cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
};

const actionIcons: Record<string, typeof Info> = {
  LOGIN: LogIn, LOGIN_FAILED: LogIn, LOGOUT: LogOut, RUN_ANALYSIS: Play,
  DATASET_IMPORT: Upload, DATASET_DELETE: Trash2, EXPORT_DATA: Download,
  SETTINGS_CHANGE: Settings, USER_ROLE_CHANGE: UserCog, USER_INVITE: UserCog,
  BACKUP_COMPLETED: CheckCircle2, VIEW_DATA: Eye, PASSWORD_RESET: Key,
};

const categoryColors: Record<AuditCategory, string> = {
  auth: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  data: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  analysis: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  admin: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  export: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function AdminAudit() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All Severity");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [userFilter, setUserFilter] = useState("All Users");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(events);

  useEffect(() => {
    api.admin.getAudit()
      .then((data) => setAuditEvents(data.map((e) => ({
        id: String(e.id),
        timestamp: String(e.timestamp),
        user: String(e.user),
        userEmail: String(e.userEmail),
        action: String(e.action),
        category: e.category as AuditCategory,
        severity: e.severity as AuditSeverity,
        resource: String(e.resource),
        details: String(e.details),
        ip: String(e.ip),
        userAgent: String(e.userAgent),
      }))))
      .catch(console.error);
  }, []);

  const uniqueUsers = [...new Set(auditEvents.map((e) => e.user))];

  const filtered = auditEvents.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = e.action.toLowerCase().includes(q) || e.user.toLowerCase().includes(q) || e.resource.toLowerCase().includes(q) || e.details.toLowerCase().includes(q);
    const matchSeverity = severityFilter === "All Severity" || e.severity === severityFilter.toLowerCase();
    const matchCategory = categoryFilter === "All Categories" || e.category === categoryFilter.toLowerCase();
    const matchUser = userFilter === "All Users" || e.user === userFilter;
    return matchSearch && matchSeverity && matchCategory && matchUser;
  });

  const exportAudit = (fmt: string) => {
    if (!filtered.length) { toast.error("No events to export"); return; }
    const rows = filtered.map((e) => ({
      id: e.id, timestamp: e.timestamp, user: e.user, email: e.userEmail,
      action: e.action, category: e.category, severity: e.severity,
      resource: e.resource, details: e.details, ip: e.ip,
    }));
    if (fmt === "JSON") downloadJson("audit-log.json", rows);
    else downloadCsv("audit-log.csv", rows);
    toast.success(`Audit log exported as ${fmt}`);
  };

  const counts = {
    critical: auditEvents.filter((e) => e.severity === "critical").length,
    warning: auditEvents.filter((e) => e.severity === "warning").length,
    total: auditEvents.length,
  };

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Audit Trail</h2>
            <p className="text-sm text-muted-foreground">
              Full log of all user actions and system events across the platform
            </p>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
                <Download className="h-3.5 w-3.5" /> Export Log <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-[150px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
                {["CSV", "JSON"].map((fmt) => (
                  <DropdownMenu.Item key={fmt} className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                    onSelect={() => exportAudit(fmt)}>
                    {fmt}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total Events", value: counts.total, cls: "text-foreground", bg: "border-border" },
            { label: "Critical Events", value: counts.critical, cls: "text-rose-600 dark:text-rose-400", bg: "border-rose-500/20 bg-rose-500/5" },
            { label: "Warnings", value: counts.warning, cls: "text-amber-600 dark:text-amber-400", bg: "border-amber-500/20 bg-amber-500/5" },
            { label: "Unique Users", value: uniqueUsers.length, cls: "text-violet-600 dark:text-violet-400", bg: "border-violet-500/20 bg-violet-500/5" },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg border ${s.bg} p-3 text-center`}>
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
              placeholder="Search by action, user, resource, or details..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
          </div>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
            <option>All Severity</option>
            <option>Critical</option>
            <option>Warning</option>
            <option>Success</option>
            <option>Info</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
            <option>All Categories</option>
            <option>Auth</option>
            <option>Analysis</option>
            <option>Data</option>
            <option>Admin</option>
            <option>Export</option>
          </select>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none">
            <option>All Users</option>
            {uniqueUsers.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>

        {/* Event log */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="border-b border-border bg-muted/30 px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Showing {filtered.length} of {auditEvents.length} events — most recent first
            </p>
            <p className="text-xs text-muted-foreground">Click a row to expand details</p>
          </div>
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No events match your filters</div>
            ) : filtered.map((event) => {
              const { icon: SevIcon, cls, dot } = severityConfig[event.severity];
              const ActionIcon = actionIcons[event.action] ?? Info;
              const isOpen = expanded === event.id;
              return (
                <div key={event.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : event.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    {/* Severity dot */}
                    <div className="mt-1 flex-shrink-0">
                      <div className={`h-2 w-2 rounded-full ${dot}`} />
                    </div>

                    {/* Action icon */}
                    <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${cls}`}>
                      <ActionIcon className="h-3.5 w-3.5" />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold font-mono">{event.action}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${categoryColors[event.category]}`}>{event.category}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${cls}`}>{event.severity}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{event.resource}</p>
                    </div>

                    {/* User + time */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-medium">{event.user}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{event.timestamp}</p>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="border-t border-border/50 bg-muted/20 px-4 py-3 pl-14">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-0.5">Resource</p>
                          <p className="font-medium">{event.resource}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">User Email</p>
                          <p className="font-medium">{event.userEmail}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">IP Address</p>
                          <p className="font-mono">{event.ip}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">User Agent</p>
                          <p className="font-medium">{event.userAgent}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground mb-0.5">Event Details</p>
                          <p className="leading-relaxed text-foreground bg-card rounded-md border border-border px-2.5 py-2">{event.details}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
