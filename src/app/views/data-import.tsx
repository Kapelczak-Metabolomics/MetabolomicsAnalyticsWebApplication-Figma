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
import {
  type ColumnRole,
  type ParsedTable,
  autoSampleGroups,
  collectUniqueGroups,
  guessColumnRoles,
  guessGroupFromSampleId,
  parseDelimitedTable,
} from "../../lib/csv-parse";

const csvSteps = ["Upload File", "Map Columns", "Validate", "Import"];
const mzxmlSteps = ["Upload mzXML", "Sample Groups", "Import"];

type ImportFormat = "csv" | "mzxml";

interface MzxmlSampleRow {
  filename: string;
  sampleId: string;
}

export function DataImportView() {
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [mzxmlFiles, setMzxmlFiles] = useState<File[]>([]);
  const [mzxmlSamples, setMzxmlSamples] = useState<MzxmlSampleRow[]>([]);
  const [mzxmlPreviewLoading, setMzxmlPreviewLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [groupMappings, setGroupMappings] = useState<Record<string, string>>({});
  const [columnRoles, setColumnRoles] = useState<Record<string, ColumnRole>>({});
  const [sampleGroups, setSampleGroups] = useState<Record<string, string>>({});
  const [customGroups, setCustomGroups] = useState<string[]>([]);
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

  const table: ParsedTable = useMemo(() => parseDelimitedTable(csvContent), [csvContent]);

  const sampleColumn = useMemo(
    () => Object.entries(columnRoles).find(([, role]) => role === "sample")?.[0] ?? "",
    [columnRoles]
  );

  const groupColumn = useMemo(
    () => Object.entries(columnRoles).find(([, role]) => role === "group")?.[0] ?? null,
    [columnRoles]
  );

  const featureCount = useMemo(
    () => Object.values(columnRoles).filter((r) => r === "feature").length,
    [columnRoles]
  );

  const resolvedSampleGroups = useMemo(() => {
    if (!sampleColumn) return {};
    if (Object.keys(sampleGroups).length) return sampleGroups;
    return autoSampleGroups(table, sampleColumn);
  }, [sampleColumn, sampleGroups, table]);

  const detectedGroups = useMemo(() => {
    if (groupColumn) return collectUniqueGroups(table, sampleColumn, groupColumn, {});
    return [...new Set(Object.values(resolvedSampleGroups).filter(Boolean))];
  }, [table, sampleColumn, groupColumn, resolvedSampleGroups]);

  const allMzxmlGroups = useMemo(() => {
    const defaults = ["Control", "Treatment", "Group1", "Group2", "AD"];
    return [...new Set([...defaults, ...customGroups, ...Object.values(groupMappings)])];
  }, [groupMappings, customGroups]);

  const validationResults = useMemo(() => {
    if (format !== "csv" || !csvContent) return [];
    const results: Array<{ type: "success" | "warning"; message: string }> = [];
    if (table.rows.length > 0) results.push({ type: "success", message: `${table.rows.length} samples detected` });
    if (featureCount > 0) results.push({ type: "success", message: `${featureCount} metabolite features mapped` });
    if (detectedGroups.length) {
      results.push({ type: "success", message: `${detectedGroups.length} sample groups: ${detectedGroups.join(", ")}` });
    }
    if (!sampleColumn) results.push({ type: "warning", message: "Select which column contains sample IDs" });
    if (!groupColumn && !sampleColumn) {
      results.push({ type: "warning", message: "No group column — groups will be guessed from sample IDs" });
    }
    return results;
  }, [csvContent, table.rows.length, featureCount, detectedGroups, sampleColumn, groupColumn, sampleGroups, format]);

  const canProceedCsvValidate = Boolean(sampleColumn) && (Boolean(groupColumn) || table.rows.length > 0);

  function resetForFormat(f: ImportFormat) {
    setFormat(f);
    setStep(0);
    setFileName(null);
    setCsvContent("");
    setMzxmlFiles([]);
    setMzxmlSamples([]);
    setGroupMappings({});
    setColumnRoles({});
    setSampleGroups({});
    setCustomGroups([]);
    setDatasetName("");
  }

  function initColumnMapping(parsed: ParsedTable) {
    const roles = guessColumnRoles(parsed.headers);
    setColumnRoles(roles);
    const sampleCol = Object.entries(roles).find(([, r]) => r === "sample")?.[0];
    if (sampleCol && !Object.entries(roles).some(([, r]) => r === "group")) {
      setSampleGroups(autoSampleGroups(parsed, sampleCol));
    } else {
      setSampleGroups({});
    }
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseDelimitedTable(text);
      setCsvContent(text);
      setFileName(file.name);
      setDatasetName(file.name.replace(/\.[^.]+$/, ""));
      initColumnMapping(parsed);
      setStep(1);
    };
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsText(file);
  }

  async function loadMzxmlPreview(files: File[]) {
    setMzxmlPreviewLoading(true);
    try {
      const preview = await api.previewMzxml(files);
      const samples = preview.samples.length
        ? preview.samples
        : files.map((f) => ({
            filename: f.name,
            sampleId: f.name.replace(/\.(mzxml|xml|zip)$/i, ""),
          }));

      const mappings: Record<string, string> = {};
      samples.forEach((s) => {
        mappings[s.sampleId] = guessGroupFromSampleId(s.sampleId);
        mappings[s.filename] = mappings[s.sampleId];
      });

      setMzxmlSamples(samples);
      setGroupMappings(mappings);
      setStep(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read mzXML files");
      const fallback = files.map((f) => ({
        filename: f.name,
        sampleId: f.name.replace(/\.(mzxml|xml|zip)$/i, ""),
      }));
      const mappings: Record<string, string> = {};
      fallback.forEach((s) => {
        mappings[s.sampleId] = guessGroupFromSampleId(s.sampleId);
        mappings[s.filename] = mappings[s.sampleId];
      });
      setMzxmlSamples(fallback);
      setGroupMappings(mappings);
      setStep(1);
    } finally {
      setMzxmlPreviewLoading(false);
    }
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
    void loadMzxmlPreview(files);
  }

  function handleFileSelect(input?: HTMLInputElement | null) {
    const file = input?.files?.[0];
    if (!file) return;
    if (format === "csv") handleCsvFile(file);
    else if (input?.files) handleMzxmlFiles(input.files);
  }

  function setColumnRole(header: string, role: ColumnRole) {
    setColumnRoles((prev) => {
      const next = { ...prev, [header]: role };
      if (role === "sample") {
        for (const h of Object.keys(next)) {
          if (h !== header && next[h] === "sample") next[h] = "feature";
        }
      }
      if (role === "group") {
        for (const h of Object.keys(next)) {
          if (h !== header && next[h] === "group") next[h] = "feature";
        }
      }
      return next;
    });

    if (role === "sample" && table.headers.length) {
      const hasGroup = Object.entries(columnRoles).some(([h, r]) => r === "group" && h !== header) || role === "group";
      if (!hasGroup) setSampleGroups(autoSampleGroups(table, header));
    }
    if (role === "group") {
      setSampleGroups({});
    }
  }

  function addCustomGroup(name: string) {
    const g = name.trim();
    if (!g) return;
    setCustomGroups((prev) => (prev.includes(g) ? prev : [...prev, g]));
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
        toast.error(status.error?.trim() || "mzXML import failed — check that the Python analysis service is running");
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
        if (!csvContent.trim() || !sampleColumn) {
          toast.error("CSV content and sample column are required");
          return;
        }
        const featureColumns = Object.entries(columnRoles)
          .filter(([, role]) => role === "feature")
          .map(([h]) => h);

        const result = await api.importDataset({
          projectId,
          name: datasetName.trim(),
          csv: csvContent,
          sampleColumn,
          groupColumn: groupColumn || null,
          featureColumns,
          sampleGroups: groupColumn ? undefined : resolvedSampleGroups,
        });
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
      toast.error(e instanceof Error && e.message.trim() ? e.message : "Import failed");
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
                  <p className="mt-1 text-xs text-muted-foreground">Sample ID and group columns are auto-detected; you can map them manually in the next step</p>
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
                    <div><p className="text-xs font-medium">Flexible columns</p><p className="text-xs text-muted-foreground">Map sample, group, and features manually</p></div>
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
              <span><strong>{fileName}</strong> loaded — {table.rows.length} rows, {table.headers.length} columns</span>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b bg-muted/30 px-4 py-2">
                <p className="text-xs font-medium">Column mapping</p>
                <p className="text-xs text-muted-foreground">Assign each column a role. If no group column exists, assign groups per sample below.</p>
              </div>
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/20">
                  <tr>
                    <th className="p-3 text-left">Column</th>
                    <th className="p-3 text-left">Preview</th>
                    <th className="p-3 text-left">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {table.headers.map((header, colIdx) => (
                    <tr key={header} className="border-b border-border">
                      <td className="p-3 font-medium">{header}</td>
                      <td className="p-3 text-muted-foreground font-mono">{table.rows[0]?.[colIdx] ?? "—"}</td>
                      <td className="p-3">
                        <select
                          value={columnRoles[header] ?? "feature"}
                          onChange={(e) => setColumnRole(header, e.target.value as ColumnRole)}
                          className="rounded border border-border bg-background px-2 py-1"
                        >
                          <option value="sample">Sample ID</option>
                          <option value="group">Group</option>
                          <option value="feature">Feature</option>
                          <option value="skip">Skip</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sampleColumn && !groupColumn && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-2">
                  <p className="text-xs font-medium">Per-sample groups</p>
                  <p className="text-xs text-muted-foreground">Groups were guessed from sample IDs — adjust as needed.</p>
                </div>
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/20">
                    <tr><th className="p-3 text-left">Sample ID</th><th className="p-3 text-left">Group</th></tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => {
                      const sid = row[table.headers.indexOf(sampleColumn)] ?? "";
                      if (!sid) return null;
                      const resolved = sampleGroups[sid] ?? resolvedSampleGroups[sid] ?? guessGroupFromSampleId(sid);
                      const groupOptions = [...new Set([...detectedGroups, resolved, "Control", "Treatment", "Group1", "Group2"])];
                      return (
                        <tr key={sid} className="border-b border-border">
                          <td className="p-3 font-mono">{sid}</td>
                          <td className="p-3">
                            <input
                              list={`groups-${sid}`}
                              value={resolved}
                              onChange={(e) => setSampleGroups((g) => ({ ...g, [sid]: e.target.value }))}
                              className="w-full rounded border border-border bg-background px-2 py-1"
                            />
                            <datalist id={`groups-${sid}`}>
                              {groupOptions.map((g) => <option key={g} value={g} />)}
                            </datalist>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs hover:bg-accent">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!sampleColumn}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
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
              <button onClick={() => setStep(3)} disabled={!canProceedCsvValidate} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Proceed to Import <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {format === "mzxml" && step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
              {mzxmlPreviewLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Reading mzXML files...</>
              ) : (
                <><Check className="h-4 w-4 flex-shrink-0" /><span><strong>{fileName}</strong> — {mzxmlSamples.length} sample(s) detected</span></>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/30"><tr><th className="p-3 text-left">File</th><th className="p-3 text-left">Sample ID</th><th className="p-3 text-left">Group</th></tr></thead>
                <tbody>
                  {mzxmlSamples.map((s) => (
                    <tr key={s.filename} className="border-b border-border">
                      <td className="p-3 font-mono text-muted-foreground">{s.filename}</td>
                      <td className="p-3">{s.sampleId}</td>
                      <td className="p-3">
                        <input
                          list={`mz-groups-${s.sampleId}`}
                          value={groupMappings[s.sampleId] ?? guessGroupFromSampleId(s.sampleId)}
                          onChange={(e) => setGroupMappings((m) => ({ ...m, [s.sampleId]: e.target.value, [s.filename]: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-2 py-1"
                        />
                        <datalist id={`mz-groups-${s.sampleId}`}>
                          {allMzxmlGroups.map((g) => <option key={g} value={g} />)}
                        </datalist>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="mzxml-custom-group"
                placeholder="Add custom group name"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addCustomGroup((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("mzxml-custom-group") as HTMLInputElement | null;
                  if (el) {
                    addCustomGroup(el.value);
                    el.value = "";
                  }
                }}
                className="rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
              >
                Add
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} disabled={mzxmlPreviewLoading || !mzxmlSamples.length} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
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
