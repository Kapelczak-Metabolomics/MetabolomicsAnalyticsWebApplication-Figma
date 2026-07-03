import { useEffect, useState } from "react";
import { Bell, Database, Globe, Lock, Palette, Zap } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { api } from "../../lib/api";

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [exportFormat, setExportFormat] = useState("SVG");
  const [resultsPerPage, setResultsPerPage] = useState("50");
  const [compactMode, setCompactMode] = useState(false);
  const [storage, setStorage] = useState({ usedGb: 0, quotaGb: 10 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getPreferences().then((p) => {
      if (p.notifications != null) setNotifications(!!p.notifications);
      if (p.autoSave != null) setAutoSave(!!p.autoSave);
      if (p.exportFormat) setExportFormat(String(p.exportFormat));
      if (p.resultsPerPage) setResultsPerPage(String(p.resultsPerPage));
      if (p.compactMode != null) setCompactMode(!!p.compactMode);
      if (p.theme) setTheme(String(p.theme));
    }).catch(console.error);
    api.getStorage().then(setStorage).catch(console.error);
  }, [setTheme]);

  async function save() {
    setSaving(true);
    try {
      await api.updatePreferences({ notifications, autoSave, exportFormat, resultsPerPage, compactMode, theme });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="text-sm text-muted-foreground">Manage your application preferences</p>
          </div>
          <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /><h3 className="text-base font-medium">General</h3></div>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm">Auto-save analyses</span>
              <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Default export format</span>
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option>SVG</option><option>PNG</option><option>CSV</option><option>PDF</option>
              </select>
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Results per page</span>
              <select value={resultsPerPage} onChange={(e) => setResultsPerPage(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option>25</option><option>50</option><option>100</option><option>200</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Palette className="h-5 w-5 text-violet-500" /><h3 className="text-base font-medium">Appearance</h3></div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {["light", "dark", "system"].map((option) => (
              <button key={option} onClick={() => setTheme(option)} className={`rounded-lg border p-3 text-sm capitalize ${theme === option ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>{option}</button>
            ))}
          </div>
          <label className="flex items-center justify-between">
            <span className="text-sm">Compact mode</span>
            <input type="checkbox" checked={compactMode} onChange={(e) => setCompactMode(e.target.checked)} />
          </label>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Bell className="h-5 w-5 text-cyan-500" /><h3 className="text-base font-medium">Notifications</h3></div>
          <label className="flex items-center justify-between">
            <span className="text-sm">Email notifications</span>
            <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
          </label>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Database className="h-5 w-5 text-emerald-500" /><h3 className="text-base font-medium">Storage</h3></div>
          <p className="text-sm text-muted-foreground">{storage.usedGb} GB of {storage.quotaGb} GB used</p>
          <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (storage.usedGb / storage.quotaGb) * 100)}%` }} /></div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Globe className="h-5 w-5 text-blue-500" /><h3 className="text-base font-medium">Integrations</h3></div>
          <p className="text-sm text-muted-foreground">R and Python workers can be configured in Admin → System.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2"><Lock className="h-5 w-5 text-rose-500" /><h3 className="text-base font-medium">Security</h3></div>
          <p className="text-sm text-muted-foreground">Change your password from Profile Settings.</p>
        </div>
      </div>
    </div>
  );
}
