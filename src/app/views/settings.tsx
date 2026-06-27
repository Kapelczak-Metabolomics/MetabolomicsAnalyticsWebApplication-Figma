import { useState } from "react";
import { Bell, Database, Globe, Lock, Palette, Zap } from "lucide-react";

export function SettingsView() {
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [theme, setTheme] = useState("system");

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage your application preferences and configurations
          </p>
        </div>

        {/* General Settings */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-medium">General</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-save analyses</p>
                <p className="text-xs text-muted-foreground">
                  Automatically save your work every 5 minutes
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Default plot export format</p>
                <p className="text-xs text-muted-foreground">
                  Choose your preferred format for plot exports
                </p>
              </div>
              <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                <option>SVG</option>
                <option>PNG</option>
                <option>PDF</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Results per page</p>
                <p className="text-xs text-muted-foreground">
                  Number of items to display in tables
                </p>
              </div>
              <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                <option>25</option>
                <option>50</option>
                <option>100</option>
                <option>200</option>
              </select>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-violet-500" />
            <h3 className="text-base font-medium">Appearance</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-3 text-sm font-medium">Theme preference</p>
              <div className="grid grid-cols-3 gap-3">
                {["light", "dark", "system"].map((option) => (
                  <button
                    key={option}
                    onClick={() => setTheme(option)}
                    className={`rounded-lg border p-3 text-sm capitalize transition-all ${
                      theme === option
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Compact mode</p>
                <p className="text-xs text-muted-foreground">
                  Reduce spacing and padding throughout the interface
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-cyan-500" />
            <h3 className="text-base font-medium">Notifications</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">
                  Receive updates about analysis completion
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Browser notifications</p>
                <p className="text-xs text-muted-foreground">
                  Show desktop notifications for important events
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" className="peer sr-only" />
                <div className="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-background after:transition-all after:content-[''] peer-checked:bg-gradient-to-r peer-checked:from-violet-500 peer-checked:to-cyan-500 peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Data & Storage */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-500" />
            <h3 className="text-base font-medium">Data & Storage</h3>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Storage usage</p>
                  <p className="text-xs text-muted-foreground">
                    4.2 GB of 10 GB used
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  42%
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[42%] bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Clear cache</p>
                <p className="text-xs text-muted-foreground">
                  Remove temporary files and cached data
                </p>
              </div>
              <button className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Privacy & Security */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-rose-500" />
            <h3 className="text-base font-medium">Privacy & Security</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Two-factor authentication</p>
                <p className="text-xs text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <button className="rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20">
                Enable
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Session timeout</p>
                <p className="text-xs text-muted-foreground">
                  Automatically log out after period of inactivity
                </p>
              </div>
              <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                <option>30 minutes</option>
                <option>1 hour</option>
                <option>4 hours</option>
                <option>Never</option>
              </select>
            </div>
          </div>
        </div>

        {/* Integration */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            <h3 className="text-base font-medium">Integrations</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600">
                  <span className="text-sm font-semibold text-white">R</span>
                </div>
                <div>
                  <p className="text-sm font-medium">R Environment</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
              </div>
              <button className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                Configure
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600">
                  <span className="text-sm font-semibold text-white">Py</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Python Environment</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
              </div>
              <button className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                Configure
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
