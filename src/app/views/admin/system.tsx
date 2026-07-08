import { useState, useRef, useEffect } from "react";
import { Server, Database, HardDrive, Cpu, Cloud, Key, Check, RefreshCw, Upload, Palette, ImageIcon, Target } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${
        on ? "bg-gradient-to-r from-violet-500 to-cyan-500" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

const ACCENT_PRESETS = [
  { label: "Violet → Cyan (default)", from: "#8b5cf6", to: "#06b6d4" },
  { label: "Rose → Orange", from: "#f43f5e", to: "#f97316" },
  { label: "Emerald → Teal", from: "#10b981", to: "#14b8a6" },
  { label: "Blue → Indigo", from: "#3b82f6", to: "#6366f1" },
  { label: "Amber → Yellow", from: "#f59e0b", to: "#eab308" },
];

function BrandingSection() {
  const [appName, setAppName] = useState("MetaboAnalytics");
  const [tagline, setTagline] = useState("Advanced Metabolomics Analytics");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [accent, setAccent] = useState(0);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB"); return; }
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
    toast.success("Logo uploaded — save to apply");
  }

  function handleFaviconFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFaviconPreview(url);
    toast.success("Favicon uploaded — save to apply");
  }

  const preset = ACCENT_PRESETS[accent];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-2">
        <Palette className="h-5 w-5 text-violet-500" />
        <h3 className="text-base font-medium">Branding</h3>
      </div>

      {/* Live preview */}
      <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground mb-3">Sidebar preview</p>
        <div className="w-48 rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="h-6 w-6 rounded-md object-cover" />
            ) : (
              <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}>
                <div className="h-3 w-3 rounded-sm bg-white/80" />
              </div>
            )}
            <span className="text-xs font-semibold truncate">{appName || "App Name"}</span>
          </div>
          {["Dashboard", "Projects", "PCA", "PLS-DA"].map((item) => (
            <div key={item} className={`flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground ${item === "Dashboard" ? "bg-muted/60 font-medium text-foreground" : ""}`}>
              <div className="h-3 w-3 rounded bg-muted-foreground/20" />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {/* App name + tagline */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Application Name</label>
            <input type="text" value={appName} onChange={(e) => setAppName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
            <p className="mt-1 text-xs text-muted-foreground">Shown in sidebar and browser tab</p>
          </div>
          <div>
            <label className="text-sm font-medium">Tagline</label>
            <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
            <p className="mt-1 text-xs text-muted-foreground">Shown on the login page</p>
          </div>
        </div>

        {/* Logo + favicon */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Logo</label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">SVG or PNG, max 2 MB, recommended 64×64 px</p>
            <input ref={logoRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoFile} />
            <button onClick={() => logoRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-6 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/40 transition-colors">
              {logoPreview ? (
                <img src={logoPreview} alt="logo preview" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <>
                  <ImageIcon className="h-5 w-5" />
                  <span>Click to upload logo</span>
                </>
              )}
            </button>
            {logoPreview && (
              <button onClick={() => setLogoPreview(null)} className="mt-1 text-xs text-muted-foreground hover:text-destructive">Remove</button>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Favicon</label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">ICO, PNG, or SVG — 32×32 px recommended</p>
            <input ref={faviconRef} type="file" accept="image/*,.ico" className="sr-only" onChange={handleFaviconFile} />
            <button onClick={() => faviconRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-6 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/40 transition-colors">
              {faviconPreview ? (
                <img src={faviconPreview} alt="favicon preview" className="h-8 w-8 rounded object-cover" />
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span>Click to upload favicon</span>
                </>
              )}
            </button>
            {faviconPreview && (
              <button onClick={() => setFaviconPreview(null)} className="mt-1 text-xs text-muted-foreground hover:text-destructive">Remove</button>
            )}
          </div>
        </div>

        {/* Accent color */}
        <div>
          <label className="text-sm font-medium">Accent Color</label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">Used for sidebar logo, buttons, and highlights</p>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((p, i) => (
              <button key={p.label} onClick={() => setAccent(i)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all ${accent === i ? "border-primary shadow-sm" : "border-border hover:border-primary/40"}`}>
                <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }} />
                {p.label}
                {accent === i && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </div>
        </div>

        <button onClick={async () => {
          await api.admin.updateSystemBulk({ branding: { appName, tagline, accent: ACCENT_PRESETS[accent] } });
          toast.success("Branding settings saved");
        }}
          className="rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:shadow-lg">
          Save Branding
        </button>
      </div>
    </div>
  );
}

const METABOLITE_TARGET_TEMPLATE = `compound,mz,adduct,rt
Glucose,179.055,[M+H]+,5.2
Lactate,89.024,[M-H]-,3.1`;

function MetaboliteTargetsSection() {
  const [enabled, setEnabled] = useState(false);
  const [mzTolerance, setMzTolerance] = useState(0.01);
  const [rtTolerance, setRtTolerance] = useState(0.5);
  const [targets, setTargets] = useState<Array<{ name: string; mz: number; adduct?: string | null; rt?: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.admin.getMetaboliteTargets()
      .then((settings) => {
        setEnabled(settings.enabled);
        setMzTolerance(settings.mzTolerance);
        setRtTolerance(settings.rtTolerance);
        setTargets(settings.targets);
      })
      .catch(() => toast.error("Failed to load metabolite targets"))
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings(next?: { enabled?: boolean; targets?: typeof targets }) {
    setSaving(true);
    try {
      const saved = await api.admin.saveMetaboliteTargets({
        enabled: next?.enabled ?? enabled,
        mzTolerance,
        rtTolerance,
        targets: next?.targets ?? targets,
      });
      setEnabled(saved.enabled);
      setTargets(saved.targets);
      toast.success("Metabolite target settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCsvUpload(file: File) {
    const csv = await file.text();
    setSaving(true);
    try {
      const saved = await api.admin.uploadMetaboliteTargetCsv(csv);
      setEnabled(saved.enabled);
      setMzTolerance(saved.mzTolerance);
      setRtTolerance(saved.rtTolerance);
      setTargets(saved.targets);
      toast.success(`Loaded ${saved.targets.length} metabolite target(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV upload failed");
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([METABOLITE_TARGET_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metabolite_targets_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading metabolite target settings…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-violet-500" />
          <div>
            <h3 className="text-base font-medium">Targeted Metabolite Detection</h3>
            <p className="text-xs text-muted-foreground">
              Upload a CSV of known compounds so mzXML imports report only matched peaks (m/z, adduct, optional RT).
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable targeted peak picking for mzXML imports
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-sm font-medium">m/z tolerance (Da)</label>
          <input type="number" step="0.001" value={mzTolerance} onChange={(e) => setMzTolerance(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="text-sm font-medium">RT tolerance (min)</label>
          <input type="number" step="0.1" value={rtTolerance} onChange={(e) => setRtTolerance(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleCsvUpload(file);
            e.currentTarget.value = "";
          }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
          <Upload className="h-4 w-4" /> Upload target CSV
        </button>
        <button type="button" onClick={downloadTemplate}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-accent">
          Download template
        </button>
        <button type="button" disabled={saving} onClick={() => void saveSettings()}
          className="rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        CSV columns: compound/name, mz (required), adduct (optional), rt in minutes (optional).
      </p>

      {targets.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="p-2 text-left">Compound</th>
                <th className="p-2 text-left">m/z</th>
                <th className="p-2 text-left">Adduct</th>
                <th className="p-2 text-left">RT (min)</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={`${t.name}-${t.mz}`} className="border-b border-border last:border-0">
                  <td className="p-2">{t.name}</td>
                  <td className="p-2 font-mono">{t.mz}</td>
                  <td className="p-2 text-muted-foreground">{t.adduct || "—"}</td>
                  <td className="p-2 text-muted-foreground">{t.rt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No targets loaded — mzXML imports will use full-spectrum m/z binning.</p>
      )}
    </div>
  );
}

export function AdminSystem() {
  const [testingS3, setTestingS3] = useState(false);
  const [s3Status, setS3Status] = useState<"idle" | "ok" | "fail">("idle");
  const [health, setHealth] = useState({
    cpu: 0, memory: 0, disk: 0, diskFreeGb: 0, diskTotalGb: 0, diskUsedGb: 0, loadAvg: [0, 0, 0] as number[],
  });
  const [storage, setStorage] = useState<{
    local: { rawDataGb: number; databaseGb: number; diskUsedGb: number; diskTotalGb: number; diskPct: number };
    s3: { connected: boolean; totalGb?: number; objectCount?: number; error?: string };
    provider: string;
  } | null>(null);

  const [s3Provider, setS3Provider] = useState("local");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpEncryption, setSmtpEncryption] = useState("TLS");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("MetaboAnalytics");
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    api.admin.getHealth().then(setHealth).catch(console.error);
    api.admin.getStorage().then(setStorage).catch(console.error);
    api.admin.getSystem().then((s) => {
      const s3 = s.s3 as Record<string, string> | undefined;
      if (s3) {
        if (s3.provider) setS3Provider(s3.provider);
        if (s3.region) setS3Region(s3.region);
        if (s3.bucket) setS3Bucket(s3.bucket);
        if (s3.endpoint) setS3Endpoint(s3.endpoint);
        if (s3.accessKeyId) setS3AccessKey(s3.accessKeyId);
        if (s3.secretAccessKey) setS3SecretKey(s3.secretAccessKey);
      }
      const email = s.email as {
        host?: string; smtpHost?: string; port?: number; encryption?: string;
        username?: string; password?: string; fromEmail?: string; fromName?: string; enabled?: boolean;
      } | undefined;
      if (email) {
        setSmtpHost(email.host || email.smtpHost || "");
        if (email.port) setSmtpPort(email.port);
        if (email.encryption) setSmtpEncryption(email.encryption);
        if (email.username) setSmtpUsername(email.username);
        if (email.password) setSmtpPassword(email.password);
        if (email.fromEmail) setSmtpFromEmail(email.fromEmail);
        if (email.fromName) setSmtpFromName(email.fromName);
        setSmtpEnabled(email.enabled !== false);
      }
    }).catch(console.error);
  }, []);

  async function handleTestS3() {
    setTestingS3(true);
    setS3Status("idle");
    try {
      await api.admin.testS3({
        provider: s3Provider,
        region: s3Region,
        bucket: s3Bucket,
        endpoint: s3Endpoint || undefined,
        accessKeyId: s3AccessKey || undefined,
        secretAccessKey: s3SecretKey || undefined,
      });
      setS3Status("ok");
      toast.success("S3 connection successful");
      api.admin.getStorage().then(setStorage).catch(console.error);
    } catch (err) {
      setS3Status("fail");
      toast.error(err instanceof Error ? err.message : "S3 connection failed");
    } finally {
      setTestingS3(false);
    }
  }

  const localGb = storage?.local.rawDataGb ?? 0;
  const dbGb = storage?.local.databaseGb ?? 0;
  const exportsGb = 0;
  const totalUsedGb = localGb + dbGb + exportsGb + (storage?.s3.connected ? (storage.s3.totalGb ?? 0) : 0);
  const diskPct = storage?.local.diskPct ?? health.disk;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold">System Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure system-wide settings and monitor resources
          </p>
        </div>

        {/* Branding */}
        <BrandingSection />

        <MetaboliteTargetsSection />

        {/* System Health */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-medium">System Health</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Cpu, label: "CPU Usage", value: health.cpu, color: "from-violet-500 to-violet-600", sub: `load ${health.loadAvg[0]?.toFixed(2) ?? "—"}` },
              { icon: Server, label: "Memory Usage", value: health.memory, color: "from-cyan-500 to-cyan-600", sub: null },
              { icon: HardDrive, label: "Disk Usage", value: diskPct, color: "from-emerald-500 to-emerald-600", sub: `${health.diskFreeGb} GB free` },
              { icon: Database, label: "Data on Disk", value: Math.min(100, Math.round((localGb / Math.max(health.diskTotalGb, 0.01)) * 100)), color: "from-amber-500 to-amber-600", sub: `${localGb.toFixed(2)} GB raw` },
            ].map(({ icon: Icon, label, value, color, sub }) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                  </div>
                  <span className="text-sm font-semibold">{value}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full bg-gradient-to-r ${color}`} style={{ width: `${value}%` }} />
                </div>
                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* S3 Storage */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-cyan-500" />
              <h3 className="text-base font-medium">S3 Storage</h3>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              storage?.s3.connected
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : s3Provider === "local"
                  ? "bg-muted text-muted-foreground"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}>
              {storage?.s3.connected ? "Connected" : s3Provider === "local" ? "Local storage" : "Not connected"}
            </span>
          </div>

          {/* Usage bar */}
          <div className="mb-5 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Storage used (measured)</span>
              <span className="font-semibold">
                {totalUsedGb.toFixed(2)} GB
                <span className="font-normal text-muted-foreground"> on {health.diskTotalGb} GB volume</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500" style={{ width: `${Math.min(100, diskPct)}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <span>Raw mzXML: {localGb.toFixed(2)} GB</span>
              <span>Database: {dbGb.toFixed(2)} GB</span>
              <span>S3 objects: {storage?.s3.connected ? `${storage.s3.totalGb?.toFixed(2) ?? 0} GB` : "—"}</span>
            </div>
            {storage?.s3.error && (
              <p className="mt-2 text-xs text-destructive">S3: {storage.s3.error}</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Provider</label>
                <select value={s3Provider} onChange={(e) => setS3Provider(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                  <option value="local">Local filesystem (default)</option>
                  <option value="aws">Amazon S3</option>
                  <option value="minio">MinIO (self-hosted)</option>
                  <option value="r2">Cloudflare R2</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Region</label>
                <select value={s3Region} onChange={(e) => setS3Region(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20">
                  <option value="us-east-1">us-east-1 (N. Virginia)</option>
                  <option value="us-west-2">us-west-2 (Oregon)</option>
                  <option value="eu-west-1">eu-west-1 (Ireland)</option>
                  <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                  <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Bucket Name</label>
              <input
                type="text"
                value={s3Bucket}
                onChange={(e) => setS3Bucket(e.target.value)}
                placeholder="my-metaboanalytics-bucket"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Custom Endpoint URL</label>
              <input
                type="text"
                value={s3Endpoint}
                onChange={(e) => setS3Endpoint(e.target.value)}
                placeholder="https://s3.amazonaws.com (leave blank for AWS default)"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="border-t border-border pt-4">
              <div className="mb-3 flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Credentials</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Access Key ID</label>
                  <input type="text" value={s3AccessKey} onChange={(e) => setS3AccessKey(e.target.value)}
                    placeholder="AKIA..."
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium">Secret Access Key</label>
                  <input type="password" value={s3SecretKey} onChange={(e) => setS3SecretKey(e.target.value)}
                    placeholder="Enter secret key"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-3">Storage Behavior</p>
              <div className="space-y-3">
                {[
                  { label: "Server-side encryption (SSE-S3)", desc: "Encrypt all stored objects at rest", on: true },
                  { label: "Versioning", desc: "Keep multiple versions of dataset files", on: false },
                  { label: "Requester pays", desc: "Charge data transfer costs to requester", on: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Toggle defaultChecked={item.on} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-3">Lifecycle & Retention</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Raw data retention</label>
                  <select className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                    <option>Forever</option>
                    <option>7 years</option>
                    <option>5 years</option>
                    <option>2 years</option>
                    <option>1 year</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Archive after</label>
                  <select className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                    <option>Never</option>
                    <option>90 days (Glacier)</option>
                    <option>180 days (Glacier)</option>
                    <option>1 year (Deep Archive)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleTestS3}
                disabled={testingS3}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testingS3 ? "animate-spin" : ""}`} />
                {testingS3 ? "Testing..." : "Test Connection"}
              </button>
              {s3Status === "ok" && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Connection verified
                </span>
              )}
              <button
                onClick={async () => {
                  await api.admin.updateSystemBulk({
                    s3: {
                      provider: s3Provider,
                      region: s3Region,
                      bucket: s3Bucket,
                      endpoint: s3Endpoint,
                      accessKeyId: s3AccessKey,
                      secretAccessKey: s3SecretKey,
                    },
                    storage: { provider: s3Provider === "local" ? "local" : "s3" },
                  });
                  toast.success("S3 configuration saved");
                }}
                className="ml-auto rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:shadow-lg"
              >
                Save S3 Settings
              </button>
            </div>
          </div>
        </div>

        {/* Server Configuration */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-medium">Server Configuration</h3>
          <div className="space-y-4">
            {[
              { label: "Maintenance Mode", desc: "Temporarily disable user access for maintenance", on: false },
              { label: "Auto Backup", desc: "Automatically backup database daily at 2:00 AM", on: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Toggle defaultChecked={item.on} />
              </div>
            ))}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Max Concurrent Jobs</p>
                <p className="text-xs text-muted-foreground">Maximum analysis jobs running simultaneously</p>
              </div>
              <input
                type="number"
                defaultValue={10}
                className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Session Timeout</p>
                <p className="text-xs text-muted-foreground">User session timeout duration</p>
              </div>
              <select className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none">
                <option>30 minutes</option>
                <option>1 hour</option>
                <option>4 hours</option>
                <option>8 hours</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                onClick={async () => {
                  await api.admin.updateSystemBulk({ server: { maintenanceMode: false, autoBackup: true, maxConcurrentJobs: 10, sessionTimeout: "1 hour" } });
                  toast.success("Server configuration saved");
                }}
                className="rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:shadow-lg"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-medium">Database</h3>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Database Size</p>
                  <p className="text-xs text-muted-foreground">Total storage used by the database</p>
                </div>
                <span className="text-sm font-semibold">{dbGb.toFixed(2)} GB</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Last Backup</p>
                <p className="text-xs text-muted-foreground">Most recent successful backup</p>
              </div>
              <span className="text-sm text-muted-foreground">From PostgreSQL pg_database_size()</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Automated PostgreSQL backups are managed outside this application (e.g. provider snapshots or <code className="text-[10px]">pg_dump</code> cron).
            </p>
            <div className="flex gap-2">
              <button
                disabled
                className="flex-1 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
                title="Use your database provider or pg_dump for backups"
              >
                Backup via pg_dump
              </button>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium">Email Configuration</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${smtpEnabled && smtpHost ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {smtpEnabled && smtpHost ? "SMTP enabled" : "SMTP disabled"}
            </span>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={smtpEnabled} onChange={(e) => setSmtpEnabled(e.target.checked)} />
              Enable outbound email (password reset, invites, new users)
            </label>
            <div>
              <label className="text-sm font-medium">SMTP Server</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.example.com"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Port</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(parseInt(e.target.value, 10) || 587)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Encryption</label>
                <select value={smtpEncryption} onChange={(e) => setSmtpEncryption(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                  <option value="TLS">TLS</option>
                  <option value="SSL">SSL</option>
                  <option value="None">None</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Username</label>
                <input type="text" value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium">Password</label>
                <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="SMTP password"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">From email</label>
                <input type="email" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)}
                  placeholder="noreply@yourdomain.com"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium">From name</label>
                <input type="text" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Set <code className="text-[11px]">APP_URL</code> on the API service to your public app URL so reset links are correct.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await api.admin.updateSystemBulk({
                    email: {
                      host: smtpHost,
                      port: smtpPort,
                      encryption: smtpEncryption,
                      username: smtpUsername,
                      password: smtpPassword,
                      fromEmail: smtpFromEmail,
                      fromName: smtpFromName,
                      enabled: smtpEnabled,
                    },
                  });
                  toast.success("Email settings saved");
                }}
                className="rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white hover:shadow-lg"
              >
                Save Email Settings
              </button>
              <button
                disabled={testingEmail || !smtpHost}
                onClick={async () => {
                  setTestingEmail(true);
                  try {
                    const result = await api.admin.testEmail({
                      host: smtpHost,
                      port: smtpPort,
                      encryption: smtpEncryption,
                      username: smtpUsername,
                      password: smtpPassword,
                      fromEmail: smtpFromEmail,
                      fromName: smtpFromName,
                      enabled: smtpEnabled,
                    });
                    toast.success(result.message);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "SMTP test failed");
                  } finally {
                    setTestingEmail(false);
                  }
                }}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {testingEmail ? "Testing..." : "Test SMTP"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
