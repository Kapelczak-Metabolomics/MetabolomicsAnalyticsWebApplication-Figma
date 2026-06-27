import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
}

const iconColors = [
  { bg: "bg-gradient-to-br from-violet-500/10 to-violet-600/10 dark:from-violet-500/20 dark:to-violet-600/20", icon: "text-violet-600 dark:text-violet-400" },
  { bg: "bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 dark:from-cyan-500/20 dark:to-cyan-600/20", icon: "text-cyan-600 dark:text-cyan-400" },
  { bg: "bg-gradient-to-br from-amber-500/10 to-amber-600/10 dark:from-amber-500/20 dark:to-amber-600/20", icon: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 dark:from-emerald-500/20 dark:to-emerald-600/20", icon: "text-emerald-600 dark:text-emerald-400" },
];

let kpiColorIndex = 0;

export function KPICard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
}: KPICardProps) {
  const colorScheme = iconColors[kpiColorIndex++ % iconColors.length];

  return (
    <div className="group rounded-lg border border-border bg-gradient-to-br from-card to-card/50 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-2xl tabular-nums tracking-tight">
            {value}
          </p>
          {change && (
            <p
              className={`mt-1 text-xs font-medium ${
                changeType === "positive"
                  ? "text-green-600 dark:text-green-400"
                  : changeType === "negative"
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
              }`}
            >
              {change}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`rounded-lg p-2.5 ${colorScheme.bg}`}>
            <Icon className={`h-5 w-5 ${colorScheme.icon}`} />
          </div>
        )}
      </div>
    </div>
  );
}
