import { useState, useEffect } from "react";
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
import { api } from "../../lib/api";

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

const iconMap: Record<NotifType, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  warning: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
};

export function NotificationsView() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getNotifications()
      .then(setNotifications)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  function markAllRead() {
    api.markAllNotificationsRead()
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast.success("All notifications marked as read");
      })
      .catch(() => toast.error("Failed to mark notifications as read"));
  }

  function markRead(id: number) {
    api.markNotificationRead(id)
      .then(() => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))));
  }

  function deleteNotif(id: number) {
    api.deleteNotification(id)
      .then(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        toast.success("Notification deleted");
      })
      .catch(() => toast.error("Failed to delete notification"));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "All caught up"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter(filter === "all" ? "unread" : "all")}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Filter className="h-3.5 w-3.5" />
              {filter === "all" ? "Unread only" : "Show all"}
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            filtered.map((notif) => {
              const { icon: Icon, color, bg } = iconMap[notif.type as NotifType] ?? iconMap.info;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-4 p-4 transition-colors ${!notif.read ? "bg-primary/[0.03]" : ""}`}
                >
                  <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{notif.title}</p>
                      {!notif.read && <div className="h-2 w-2 rounded-full bg-violet-500" />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{notif.message}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{notif.time}</span>
                      {notif.link && (
                        <Link to={notif.link} className="text-xs font-medium text-primary hover:underline" onClick={() => markRead(notif.id)}>
                          {notif.linkLabel ?? "View"}
                        </Link>
                      )}
                      {!notif.read && (
                        <button onClick={() => markRead(notif.id)} className="text-xs text-muted-foreground hover:text-foreground">
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteNotif(notif.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
