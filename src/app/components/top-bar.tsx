import { ChevronDown, Moon, Sun, Settings, LogOut, User, Bell, HelpCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { Link } from "react-router";
import * as Select from "@radix-ui/react-select";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { NotificationsPopover } from "./notifications-popover";

export function TopBar() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-gradient-to-r from-background via-background to-muted/10 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <SelectDropdown
          label="Project"
          value="ADNI Metabolomics Study"
          options={[
            "ADNI Metabolomics Study",
            "Cancer Biomarker Panel",
            "Diabetes Cohort 2024",
          ]}
        />
        <SelectDropdown
          label="Dataset"
          value="Plasma Samples (n=342)"
          options={[
            "Plasma Samples (n=342)",
            "Serum Samples (n=287)",
            "Urine Samples (n=156)",
          ]}
        />
        <SelectDropdown
          label="Lens"
          value="AD vs Control"
          options={[
            "AD vs Control",
            "Early vs Late Stage",
            "Treatment Response",
          ]}
        />
      </div>
      <div className="flex items-center gap-1">
        <Link
          to="/help"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Help & Documentation"
        >
          <HelpCircle className="h-4 w-4" />
        </Link>

        <NotificationsPopover />

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <Link
          to="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1 hover:bg-accent">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-semibold text-white">
                SC
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
              sideOffset={5}
              align="end"
            >
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Dr. Sarah Chen</div>
                <div className="mt-0.5">sarah.chen@university.edu</div>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <Link
                  to="/profile"
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent"
                >
                  <User className="h-4 w-4" />
                  Profile Settings
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  to="/notifications"
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent"
                >
                  <Bell className="h-4 w-4" />
                  Notifications
                  <span className="ml-auto rounded-full bg-violet-500/20 px-1.5 py-0.5 text-xs text-violet-600 dark:text-violet-400">3</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  to="/help"
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent"
                >
                  <HelpCircle className="h-4 w-4" />
                  Help & Docs
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <Link
                  to="/login"
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

function SelectDropdown({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <Select.Root value={value}>
      <Select.Trigger className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-accent">
        <span className="text-muted-foreground">{label}:</span>
        <Select.Value />
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option}
                value={option}
                className="cursor-pointer rounded px-2 py-1.5 text-xs outline-none hover:bg-accent"
              >
                <Select.ItemText>{option}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
