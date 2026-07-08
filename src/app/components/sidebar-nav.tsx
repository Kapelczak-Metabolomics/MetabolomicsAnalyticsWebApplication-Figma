import {
  LayoutDashboard,
  ScatterChart,
  TrendingUp,
  Flame,
  Network,
  Route,
  Target,
  Table2,
  FolderKanban,
  ShieldCheck,
  ChevronDown,
  Users,
  Play,
  ClipboardList,
  Settings,
  ScrollText,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "PCA", href: "/pca", icon: ScatterChart },
  { name: "PLS-DA", href: "/plsda", icon: TrendingUp },
  { name: "Volcano", href: "/volcano", icon: Flame },
  { name: "Clustering", href: "/clustering", icon: Network },
  { name: "Pathway Enrichment", href: "/pathway", icon: Route },
  { name: "Biomarker Lenses", href: "/biomarker", icon: Target },
  { name: "Data Table", href: "/data", icon: Table2 },
];

const adminSubNav = [
  { name: "Overview", href: "/admin", icon: ShieldCheck },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "All Runs", href: "/admin/runs", icon: Play },
  { name: "Audit Trail", href: "/admin/audit", icon: ClipboardList },
  { name: "Activity Logs", href: "/admin/logs", icon: ScrollText },
  { name: "System Settings", href: "/admin/system", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const isInAdmin = location.pathname.startsWith("/admin");
  const [adminOpen, setAdminOpen] = useState(isInAdmin);

  return (
    <nav className="flex-1 space-y-0.5 overflow-auto p-2">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onNavigate}
            className={`flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2.5 text-[13px] transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.name}
          </Link>
        );
      })}

      <div className="my-2 border-t border-sidebar-border" />

      <button
        type="button"
        onClick={() => setAdminOpen(!adminOpen)}
        className={`flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2.5 text-[13px] transition-colors ${
          isInAdmin
            ? "bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Admin Panel
        </div>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${adminOpen ? "rotate-180" : ""}`} />
      </button>

      {adminOpen && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
          {adminSubNav.map((item) => {
            const isActive = item.href === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onNavigate}
                className={`flex min-h-10 items-center gap-2 rounded-md px-2 py-2 text-[12px] transition-colors ${
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <div className="flex h-14 items-center border-b border-sidebar-border px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-cyan-500">
          <div className="h-3 w-3 rounded-sm bg-sidebar" />
        </div>
        <h1 className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          MetaboAnalytics
        </h1>
      </div>
    </div>
  );
}
