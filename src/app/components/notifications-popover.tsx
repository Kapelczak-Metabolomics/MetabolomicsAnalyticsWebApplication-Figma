import { useState } from "react";
import { Link } from "react-router";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCircle2, AlertCircle, Info, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useNotifications, type NotificationType } from "../../contexts/notifications-context";

const iconMap: Record<NotificationType, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  warning: { icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
};

export function NotificationsPopover() {
  const { notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) await refresh();
  }

  function handleMarkAllRead() {
    markAllRead()
      .then(() => toast.success("All notifications marked as read"))
      .catch(() => toast.error("Failed to mark notifications as read"));
  }

  function handleMarkRead(id: number) {
    markRead(id).catch(() => toast.error("Failed to mark notification as read"));
  }

  const preview = notifications.slice(0, 4);

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-2 w-2 items-center justify-center">
              <span className="absolute h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-violet-500" />
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[380px] overflow-hidden rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="divide-y divide-border">
            {preview.map((notif) => {
              const { icon: Icon, color, bg } = iconMap[notif.type] ?? iconMap.info;
              const content = (
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${!notif.read ? "bg-primary/[0.03]" : ""}`}
                  onClick={() => !notif.read && handleMarkRead(notif.id)}
                >
                  <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium leading-snug">{notif.title}</p>
                      {!notif.read && <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500" />}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-2">{notif.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">{notif.time}</p>
                  </div>
                </div>
              );

              return notif.link ? (
                <Link
                  key={notif.id}
                  to={notif.link}
                  onClick={() => {
                    if (!notif.read) handleMarkRead(notif.id);
                    setOpen(false);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <div key={notif.id}>{content}</div>
              );
            })}

            {notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No notifications</p>
              </div>
            )}
          </div>

          <div className="border-t border-border p-2">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              View all notifications
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
