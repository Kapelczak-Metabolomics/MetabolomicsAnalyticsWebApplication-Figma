import { ChevronDown, Moon, Sun, Settings, LogOut, User, Bell, HelpCircle, Menu, SlidersHorizontal } from "lucide-react";
import { useTheme } from "next-themes";
import { Link } from "react-router";
import * as Select from "@radix-ui/react-select";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { NotificationsPopover } from "./notifications-popover";
import { useAuth } from "../../contexts/auth-context";
import { useApp } from "../../contexts/app-context";
import { useNotifications } from "../../contexts/notifications-context";
import { useLayout } from "../../contexts/layout-context";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { setMobileNavOpen, setWorkspaceOpen } = useLayout();
  const {
    projects, datasets, selectedProjectId, selectedDatasetId, selectedLens, groupLenses,
    setSelectedProjectId, setSelectedDatasetId, setSelectedLens,
  } = useApp();

  const initials = (user?.name ?? "U").split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const projectDatasets = datasets.filter((d) => d.project_id === selectedProjectId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  return (
    <>
      {/* Phone layout only (< 640px) */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-background via-background to-muted/10 px-3 backdrop-blur-sm sm:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceOpen(true)}
            className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:bg-accent"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedProject?.name ?? "Project"} · {selectedDataset?.name ?? "Dataset"}
            </span>
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link to="/help" className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Help">
            <HelpCircle className="h-4 w-4" />
          </Link>
          <NotificationsPopover />
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <MobileUserMenu user={user} initials={initials} unreadCount={unreadCount} logout={logout} />
        </div>
      </header>

      {/* Desktop layout — unchanged from pre-mobile version */}
      <div className="hidden h-14 shrink-0 items-center justify-between border-b border-border bg-gradient-to-r from-background via-background to-muted/10 px-4 backdrop-blur-sm sm:flex">
        <div className="flex items-center gap-4">
          <SelectDropdown
            label="Project"
            value={selectedProject?.name ?? "Select project"}
            options={projects.map((p) => p.name)}
            onChange={(name) => {
              const p = projects.find((x) => x.name === name);
              if (p) {
                setSelectedProjectId(p.id);
                const ds = datasets.find((d) => d.project_id === p.id);
                if (ds) setSelectedDatasetId(ds.id);
              }
            }}
          />
          <SelectDropdown
            label="Dataset"
            value={selectedDataset ? `${selectedDataset.name} (n=${selectedDataset.samples_count})` : "Select dataset"}
            options={(projectDatasets.length ? projectDatasets : datasets).map((d) => `${d.name} (n=${d.samples_count})`)}
            onChange={(label) => {
              const ds = (projectDatasets.length ? projectDatasets : datasets).find((d) => label.startsWith(d.name));
              if (ds) setSelectedDatasetId(ds.id);
            }}
          />
          <SelectDropdown
            label="Lens"
            value={selectedLens}
            options={groupLenses}
            onChange={setSelectedLens}
          />
        </div>
        <div className="flex items-center gap-1">
          <Link to="/help" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Help & Documentation">
            <HelpCircle className="h-4 w-4" />
          </Link>
          <NotificationsPopover />
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/settings" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Settings">
            <Settings className="h-4 w-4" />
          </Link>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="ml-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1 hover:bg-accent">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-semibold text-white">{initials}</div>
                )}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={5} align="end">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{user?.name}</div>
                  <div className="mt-0.5">{user?.email}</div>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item asChild>
                  <Link to="/profile" className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent">
                    <User className="h-4 w-4" /> Profile Settings
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <Link to="/notifications" className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent">
                    <Bell className="h-4 w-4" /> Notifications
                    {unreadCount > 0 && <span className="ml-auto rounded-full bg-violet-500/20 px-1.5 py-0.5 text-xs text-violet-600 dark:text-violet-400">{unreadCount}</span>}
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item onSelect={logout} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" /> Log Out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </>
  );
}

function MobileUserMenu({
  user,
  initials,
  unreadCount,
  logout,
}: {
  user: { name?: string; email?: string; avatarUrl?: string | null } | null;
  initials: string;
  unreadCount: number;
  logout: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:bg-accent">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-semibold text-white">{initials}</div>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={5} align="end">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{user?.name}</div>
            <div className="mt-0.5">{user?.email}</div>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link to="/profile" className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 text-sm outline-none hover:bg-accent">
              <User className="h-4 w-4" /> Profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 text-sm outline-none hover:bg-accent">
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link to="/notifications" className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 text-sm outline-none hover:bg-accent">
              <Bell className="h-4 w-4" /> Notifications
              {unreadCount > 0 && <span className="ml-auto rounded-full bg-violet-500/20 px-1.5 py-0.5 text-xs text-violet-600 dark:text-violet-400">{unreadCount}</span>}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item onSelect={logout} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 text-sm text-destructive outline-none hover:bg-destructive/10">
            <LogOut className="h-4 w-4" /> Log Out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SelectDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange?: (v: string) => void }) {
  if (!options.length) return null;
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-accent">
        <span className="text-muted-foreground">{label}:</span>
        <Select.Value />
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item key={option} value={option} className="cursor-pointer rounded px-2 py-1.5 text-xs outline-none hover:bg-accent">
                <Select.ItemText>{option}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
