import { useEffect, useState } from "react";
import { ChevronDown, Moon, Sun, Settings, LogOut, User, Bell, HelpCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { Link } from "react-router";
import * as Select from "@radix-ui/react-select";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { NotificationsPopover } from "./notifications-popover";
import { useAuth } from "../../contexts/auth-context";
import { api } from "../../lib/api";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [datasets, setDatasets] = useState<Array<{ id: number; name: string; samples_count: number; project_id: number }>>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.getProjects().then((p) => {
      setProjects(p);
      if (p.length) setSelectedProject(p[0].name);
    }).catch(console.error);
    api.getDatasets().then((d) => {
      setDatasets(d);
      if (d.length) setSelectedDataset(`${d[0].name} (n=${d[0].samples_count})`);
    }).catch(console.error);
    api.getNotifications().then((n) => setUnreadCount(n.filter((x) => !x.read).length)).catch(console.error);
  }, []);

  const initials = (user?.name ?? "U").split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const projectDatasets = datasets.filter((d) => projects.find((p) => p.name === selectedProject)?.id === d.project_id);

  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-gradient-to-r from-background via-background to-muted/10 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <SelectDropdown
          label="Project"
          value={selectedProject || "Select project"}
          options={projects.map((p) => p.name)}
          onChange={setSelectedProject}
        />
        <SelectDropdown
          label="Dataset"
          value={selectedDataset || "Select dataset"}
          options={(projectDatasets.length ? projectDatasets : datasets).map((d) => `${d.name} (n=${d.samples_count})`)}
          onChange={setSelectedDataset}
        />
        <SelectDropdown
          label="Lens"
          value="AD vs Control"
          options={["AD vs Control", "Early vs Late Stage", "Treatment Response"]}
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
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-semibold text-white">
                {initials}
              </div>
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
  );
}

function SelectDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange?: (v: string) => void }) {
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
