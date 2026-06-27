import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Bell,
  Check,
  Trash2,
  Filter,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

type NotifType = "success" | "warning" | "info" | "error";

interface Notification {
  id: number;
  type: NotifType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
  linkLabel?: string;
}

const initialNotifications: Notification[] = [
  {
    id: 1,
    type: "success",
    title: "Analysis Complete",
    message: "PCA - AD vs Control finished successfully. 342 samples processed.",
    time: "2 minutes ago",
    read: false,
    link: "/experiments/1",
    linkLabel: "View results",
  },
  {
    id: 2,
    type: "success",
    title: "Dataset Imported",
    message: "Plasma Samples (ADNI v3) imported — 1,247 features, 342 samples ready for analysis.",
    time: "1 hour ago",
    read: false,
    link: "/data",
    linkLabel: "View dataset",
  },
  {
    id: 3,
    type: "warning",
    title: "Missing Values Detected",
    message: "Serum Samples dataset has 8.4% missing values. KNN imputation recommended before analysis.",
    time: "3 hours ago",
    read: false,
    link: "/data",
    linkLabel: "Review data",
  },
  {
    id: 4,
    type: "info",
    title: "New Project Shared",
    message: "Dr. Michael Torres shared Cancer Biomarker Panel with you. You have view access.",
    time: "5 hours ago",
    read: true,
    link: "/projects",
    linkLabel: "Open project",
  },
  {
    id: 5,
    type: "success",
    title: "PLS-DA Model Complete",
    message: "Classification model achieved 87.3% accuracy (AUC: 0.923) with 7-fold cross-validation.",
    time: "1 day ago",
    read: true,
    link: "/experiments/3",
    linkLabel: "View model",
  },
  {
    id: 6,
    type: "error",
    title: "Analysis Failed",
    message: "Hierarchical Clustering for COVID-19 dataset failed. Insufficient samples after QC (n=8).",
    time: "4 days ago",
    read: true,
    link: "/experiments/5",
    linkLabel: "View error log",
  },
  {
    id: 7,
    type: "info",
    title: "System Maintenance",
    message: "Scheduled maintenance window on Sunday 02:00–04:00 UTC. Save your work before then.",
    time: "5 days ago",
    read: true,
  },
  {
    id: 8,
    type: "success",
    title: "Report Generated",
    message: "ADNI Metabolomics Summary Report (Q4 2025) is ready to download.",
    time: "1 week ago",
    read: true,
  },
];

const iconMap: Record<NotifType, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  warning: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
};

type FilterType = "all" | "unread" | "success" | "warning" | "error" | "info";

export function NotificationsView() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<FilterType>("all");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "all") return true;
    return n.type === filter;
  });

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  }

  function markRead(id: number) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function deleteNotif(id: number) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function clearAll() {
    setNotifications([]);
    toast.success("All notifications cleared");
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20">
              <Bell className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Notifications</h2>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-4 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {(["all", "unread", "success", "warning", "error", "info"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <h3 className="text-sm font-medium text-muted-foreground">No notifications</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {filter === "unread" ? "You have read all notifications." : "Nothing here yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((notif) => {
              const { icon: Icon, color, bg } = iconMap[notif.type];
              return (
                <div
                  key={notif.id}
                  className={`group flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                    notif.read
                      ? "border-border bg-card/50"
                      : "border-primary/20 bg-card shadow-sm"
                  }`}
                >
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium leading-none">{notif.title}</p>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notif.read && (
                          <button
                            onClick={() => markRead(notif.id)}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotif(notif.id)}
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{notif.time}</span>
                      {notif.link && (
                        <Link
                          to={notif.link}
                          onClick={() => markRead(notif.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          {notif.linkLabel}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
