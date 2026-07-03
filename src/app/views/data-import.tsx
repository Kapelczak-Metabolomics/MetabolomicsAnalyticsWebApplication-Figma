import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";

const steps = ["Upload File", "Map Columns", "Validate", "Import"];

function parseCsvPreview(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [] as string[], rows: [] as string[][], sampleCount: 0, featureCount: 0 };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
  const sampleIdx = headers.findIndex((h) => /sample/i.test(h));
  const groupIdx = headers.findIndex((h) => /group|class/i.test(h));
  const featureCount = headers.filter((_, i) => i !== sampleIdx && i !== groupIdx).length;
  const groups = groupIdx >= 0 ? [...new Set(rows.map((r) => r[groupIdx]).filter(Boolean))] : [];
  return { headers, rows, sampleCount: rows.length, featureCount, sampleIdx, groupIdx, groups };
}

export function DataImportView() {
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.getProjects()
      .then((list) => {
        setProjects(list.map((p) => ({ id: p.id, name: p.name })));
        if (list[0]) setProjectId(list[0].id);
      })
      .catch(() => toast.error("Failed to load projects"));
  }, []);

  const preview = useMemo(() => parseCsvPreview(csvContent), [csvContent]);

  const validationResults = useMemo(() => {
    if (!csvContent) return [];
    const results: Array<{ type: "success" | "warning"; message: string }> = [];
    if (preview.sampleCount > 0) results.push({ type: "success", message: `${preview.sampleCount} samples detected` });
    if (preview.featureCount > 0) results.push({ type: "success", message: `${preview.featureCount} metabolite features detected` });
    if (preview.groups.length) results.push({ type: "success", message: `${preview.groups.length} sample groups: ${preview.groups.join(", ")}` });
    if (preview.sampleIdx < 0) results.push({ type: "warning", message: "No sample ID column detected — ensure a column named sample_id" });
    if (preview.groupIdx < 0) results.push({ type: "warning", message: "No group column detected — ensure a column named group" });
    return results;
  }, [csvContent, preview]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setCsvContent(text);
      setFileName(file.name);
      setDatasetName(file.name.replace(/\.[^.]+$/, ""));
      setStep(1);
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsText(file);
  }

  function handleFileSelect(input?: HTMLInputElement | null) {
    const file = input?.files?.[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    if (!projectId || !datasetName.trim() || !csvContent.trim()) {
      toast.error("Project, dataset name, and CSV content are required");
      return;
    }
    setImporting(true);
    try {
      const result = await api.importDataset({ projectId, name: datasetName.trim(), csv: csvContent });
      toast.success("Dataset imported successfully", {
        description: `${result.samples} samples · ${result.features} features · ready for analysis`,
      });
      navigate("/data");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/data")} className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold">Import Dataset</h2>
            <p className="text-xs text-muted-foreground">Upload a CSV and import into PostgreSQL</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <div className="flex items-center gap-0">
          {steps.map((s, idx) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <button onClick={() => idx < step && setStep(idx)} className="flex items-center gap-2" disabled={idx > step}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${idx < step ? "bg-emerald-500 text-white" : idx === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {idx < step ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span className={`text-xs font-medium ${idx === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              </button>
              {idx < steps.length - 1 && <div className="flex-1 h-px mx-3 bg-border" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${isDragging ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-sm font-medium">Drop your CSV file here</h3>
              <p className="mt-1 text-xs text-muted-foreground">Must include sample_id and group columns plus feature columns</p>
              <label className="mt-4 inline-flex cursor-pointer rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90">
                Browse Files
                <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => handleFileSelect(e.target)} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { fmt: "CSV / TSV", desc: "Comma or tab separated values" },
                { fmt: "Required columns", desc: "sample_id, group, plus numeric features" },
              ].map((f) => (
                <div key={f.fmt} className="rounded-lg border border-border bg-card p-3 flex items-start gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium">{f.fmt}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 flex-shrink-0" />
              <span><strong>{fileName}</strong> loaded — {preview.sampleCount} rows, {preview.headers.length} columns</span>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="p-3 text-left font-medium">Column</th>
                    <th className="p-3 text-left font-medium">Detected As</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.headers.slice(0, 8).map((h) => (
                    <tr key={h} className="border-b border-border">
                      <td className="p-3 font-mono text-muted-foreground">{h}</td>
                      <td className="p-3">{/sample/i.test(h) ? "Sample ID" : /group|class/i.test(h) ? "Group" : "Feature"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90">
                Validate Data <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              {validationResults.map((r, i) => (
                <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${r.type === "success" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400" : "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400"}`}>
                  {r.type === "success" ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                  {r.message}
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs hover:bg-accent">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button onClick={() => setStep(3)} disabled={preview.sampleIdx < 0 || preview.groupIdx < 0} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Proceed to Import <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Dataset name</label>
                <input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project</label>
                <select value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value))} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs hover:bg-accent">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button onClick={handleImport} disabled={importing || !projectId} className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2 text-xs font-medium text-white disabled:opacity-50">
                {importing ? "Importing..." : <><Upload className="h-3.5 w-3.5" /> Import Dataset</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
