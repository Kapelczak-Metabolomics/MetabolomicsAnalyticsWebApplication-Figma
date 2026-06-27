import { LucideIcon } from "lucide-react";
import { Link } from "react-router";

interface AnalysisCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  lastRun?: string;
}

const cardColors = [
  { bg: "bg-gradient-to-br from-violet-500/5 to-violet-600/5 dark:from-violet-500/10 dark:to-violet-600/10", icon: "bg-violet-500/10 group-hover:bg-violet-500/20", iconColor: "text-violet-600 dark:text-violet-400", border: "border-violet-500/20" },
  { bg: "bg-gradient-to-br from-cyan-500/5 to-cyan-600/5 dark:from-cyan-500/10 dark:to-cyan-600/10", icon: "bg-cyan-500/10 group-hover:bg-cyan-500/20", iconColor: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20" },
  { bg: "bg-gradient-to-br from-amber-500/5 to-amber-600/5 dark:from-amber-500/10 dark:to-amber-600/10", icon: "bg-amber-500/10 group-hover:bg-amber-500/20", iconColor: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  { bg: "bg-gradient-to-br from-rose-500/5 to-rose-600/5 dark:from-rose-500/10 dark:to-rose-600/10", icon: "bg-rose-500/10 group-hover:bg-rose-500/20", iconColor: "text-rose-600 dark:text-rose-400", border: "border-rose-500/20" },
  { bg: "bg-gradient-to-br from-emerald-500/5 to-emerald-600/5 dark:from-emerald-500/10 dark:to-emerald-600/10", icon: "bg-emerald-500/10 group-hover:bg-emerald-500/20", iconColor: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
  { bg: "bg-gradient-to-br from-indigo-500/5 to-indigo-600/5 dark:from-indigo-500/10 dark:to-indigo-600/10", icon: "bg-indigo-500/10 group-hover:bg-indigo-500/20", iconColor: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20" },
];

let cardColorIndex = 0;

export function AnalysisCard({
  title,
  description,
  icon: Icon,
  href,
  lastRun,
}: AnalysisCardProps) {
  const colorScheme = cardColors[cardColorIndex++ % cardColors.length];

  return (
    <Link
      to={href}
      className={`group rounded-lg border border-border ${colorScheme.bg} p-4 transition-all hover:border-${colorScheme.border} hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2.5 ${colorScheme.icon} transition-colors`}>
          <Icon className={`h-5 w-5 ${colorScheme.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
          {lastRun && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <p className="text-xs text-muted-foreground">
                Last run: {lastRun}
              </p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
