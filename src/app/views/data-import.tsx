import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Dna,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";

const csvSteps = ["Upload File", "Map Columns", "Validate", "Import"];
const mzxmlSteps = ["Upload mzXML", "Sample Groups", "Import"];

function parseCsvPreview(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [] as string[], rows: [] as string[][], sampleCount: 0, featureCount: 0, sampleIdx: -1, groupIdx: -1, groups: [] as string[] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
  const sampleIdx = headers.findIndex((h) => /sample/i.test(h));
  const groupIdx = headers.findIndex((h) => /group|class/i.test(h));
  const featureCount = headers.filter((_, i) => i !== sampleIdx && i !== groupIdx).length;
  const groups = groupIdx >= 0 ? [...new Set(rows.map((r) => r[groupIdx]).filter(Boolean))] : [];
  return { headers, rows, sampleCount: rows.length, featureCount, sampleIdx, groupIdx, groups };
}

type ImportFormat = "csv" | "mzxml";

export function DataImportView() {
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [mzxmlFiles, setMzxmlFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [groupMappings, setGroupMappings] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const steps = format === "csv" ? csvSteps : mzxmlSteps;

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
    if (format !== "csv" || !csvContent) return [];
    const results: Array<{ type: "success" | "warning"; message: string }> = [];
    if (preview.sampleCount > 0) results.push({ type: "success", message: `${preview.sampleCount} samples detected` });
    if (preview.featureCount > 0) results.push({ type: "success", message: `${preview.featureCount} metabolite features detected` });
    if (preview.groups.length) results.push({ type: "success", message: `${preview.groups.length} sample groups: ${preview.groups.join(", ")}` });
    if (preview.sampleIdx < 0) results.push({ type: "warning", message: "No sample ID column detected — ensure a column named sample_id" });
    if (preview.groupIdx < 0) results.push({ type: "warning", message: "No group column detected — ensure a column named group" });
    return results;
  }, [csvContent, preview, format]);

  function resetForFormat(f: ImportFormat) {
    setFormat(f);
    setStep(0);
    setFileName(null);
    setCsvContent("");
    setMzxmlFiles([]);
    setGroupMappings({});
    setDatasetName("");
  }

  function handleCsvFile(file: File) {
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

  function handleMzxmlFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith(".mzxml") || f.name.toLowerCase().endsWith(".xml") || f.name.toLowerCase().endsWith(".zip")
    );
    if (!files.length) {
      toast.error("Select mzXML, XML, or ZIP files");
      return;
    }
    setMzxmlFiles(files);
    setFileName(files.length === 1 ? files[0].name : `${files.length} files`);
    setDatasetName(files[0].name.replace(/\.[^.]+$/, "").replace(/\.mzxml$/i, ""));
    const mappings: Record<string, string> = {};
    files.forEach((f, i) => {
      const sid = f.name.replace(/\.(mzxml|xml|zip)$/i, "");
      mappings[sid] = i % 2 === 0 ? "Group1" : "Group2";
      mappings[f.name] = mappings[sid];
    });
    setGroupMappings(mappings);
    setStep(1);
  }

  function handleFileSelect(input?: HTMLInputElement | null) {
    const file = input?.files?.[0];
    if (!file) return;
    if (format === "csv") handleCsvFile(file);
    else if (input?.files) handleMzxmlFiles(input.files);
  }

  async function pollImportStatus(datasetId: number) {
    setPolling(true);
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await api.getImportStatus(datasetId);
      if (status.status === "ready") {
        toast.success("mzXML import complete", {
          description: `${status.samples} samples · ${status.features} m/z features`,
        });
        navigate("/data");
        return;
      }
      if (status.status === "failed") {
        toast.error(status.error || "mzXML import failed");
        return;
      }
    }
    toast.error("Import timed out — check notifications");
  }

  async function handleImport() {
    if (!projectId || !datasetName.trim()) {
      toast.error("Project and dataset name are required");
      return;
    }
    setImporting(true);
    try {
      if (format === "csv") {
        if (!csvContent.trim()) {
          toast.error("CSV content is required");
          return;
        }
        const result = await api.importDataset({ projectId, name: datasetName.trim(), csv: csvContent });
        toast.success("Dataset imported successfully", {
          description: `${result.samples} samples · ${result.features} features`,
        });
        navigate("/data");
      } else {
        if (!mzxmlFiles.length) {
          toast.error("Select mzXML files");
          return;
        }
        const { id } = await api.importMzxml({
          projectId,
          name: datasetName.trim(),
          files: mzxmlFiles,
          groups: groupMappings,
        });
        toast.info("mzXML import started", { description: "Processing spectra with Python backend..." });
        await pollImportStatus(id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
      setPolling(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/data")} className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-base font-semibold">Import Dataset</h2>
              <p className="text-xs text-muted-foreground">CSV feature matrix or raw mzXML spectra (Python backend)</p>
            </div>
          </div>
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button onClick={() => resetForFormat("csv")} className={`rounded-md px-3 py-1.5 ${format === "csv" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>CSV</button>
            <button onClick={() => resetForFormat("mzxml")} className={`rounded-md px-3 py-1.5 ${format === "mzxml" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>mzXML</button>
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
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (format === "csv" && e.dataTransfer.files[0]) handleCsvFile(e.dataTransfer.files[0]);
                else if (e.dataTransfer.files.length) handleMzxmlFiles(e.dataTransfer.files);
              }}
              className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${isDragging ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"}`}
            >
              {format === "csv" ? (
                <>
                  <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-sm font-medium">Drop your CSV file here</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Must include sample_id and group columns plus feature columns</p>
                  <a href="/fixtures/sample_metabolomics.csv" download className="mt-2 inline-block text-xs text-primary hover:underline">
                    Download sample metabolomics CSV (20 features, AD vs Control)
                  </a>
                </>
              ) : (
                <>
                  <Dna className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="text-sm font-medium">Drop mzXML file(s) or a ZIP archive</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Each file = one sample. MS1 spectra are binned by m/z into features.</p>
                </>
              )}
              <label className="mt-4 inline-flex cursor-pointer rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90">
                Browse Files
                <input
                  type="file"
                  accept={format === "csv" ? ".csv,.tsv,.txt" : ".mzxml,.xml,.zip"}
                  multiple={format === "mzxml"}
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {format === "csv" ? (
                <>
                  <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div><p className="text-xs font-medium">CSV / TSV</p><p className="text-xs text-muted-foreground">Pre-processed feature matrix</p></div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-2">
                    <Check className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div><p className="text-xs font-medium">Required columns</p><p className="text-xs text-muted-foreground">sample_id, group, features</p></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-2">
                    <Dna className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div><p className="text-xs font-medium">mzXML / mzML XML</p><p className="text-xs text-muted-foreground">Raw LC-MS spectra via pymzML</p></div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-2">
                    <Check className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div><p className="text-xs font-medium">Multi-file upload</p><p className="text-xs text-muted-foreground">One sample per file or ZIP batch</p></div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {format === "csv" && step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 flex-shrink-0" />
              <span><strong>{fileName}</strong> loaded — {preview.sampleCount} rows, {preview.headers.length} columns</span>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90">
                Validate Data <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {format === "csv" && step === 2 && (
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
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs hover:bg-accent"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
              <button onClick={() => setStep(3)} disabled={preview.sampleIdx < 0 || preview.groupIdx < 0} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Proceed to Import <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {format === "mzxml" && step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 flex-shrink-0" />
              <span><strong>{fileName}</strong> ready for import</span>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/30"><tr><th className="p-3 text-left">File</th><th className="p-3 text-left">Sample ID</th><th className="p-3 text-left">Group</th></tr></thead>
                <tbody>
                  {mzxmlFiles.map((f) => {
                    const sid = f.name.replace(/\.(mzxml|xml|zip)$/i, "");
                    return (
                      <tr key={f.name} className="border-b border-border">
                        <td className="p-3 font-mono text-muted-foreground">{f.name}</td>
                        <td className="p-3">{sid}</td>
                        <td className="p-3">
                          <select
                            value={groupMappings[sid] ?? "Group1"}
                            onChange={(e) => setGroupMappings((m) => ({ ...m, [sid]: e.target.value, [f.name]: e.target.value }))}
                            className="rounded border border-border bg-background px-2 py-1"
                          >
                            <option>Group1</option>
                            <option>Group2</option>
                            <option>Control</option>
                            <option>Treatment</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90">
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {((format === "csv" && step === 3) || (format === "mzxml" && step === 2)) && (
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
              {format === "mzxml" && (
                <p className="text-xs text-muted-foreground">
                  Import runs on the Python analysis service (pymzML). Large files may take several minutes.
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs hover:bg-accent">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button onClick={handleImport} disabled={importing || polling || !projectId} className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2 text-xs font-medium text-white disabled:opacity-50">
                {(importing || polling) ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {polling ? "Processing mzXML..." : "Importing..."}</> : <><Upload className="h-3.5 w-3.5" /> Import Dataset</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
