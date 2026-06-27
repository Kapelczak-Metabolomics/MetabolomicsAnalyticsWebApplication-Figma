import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Upload,
  FileSpreadsheet,
  ChevronRight,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

const steps = ["Upload File", "Map Columns", "Validate", "Import"];

const sampleColumns = [
  { col: "sample_id", detected: "Sample ID", required: true, mapped: "Sample ID" },
  { col: "group", detected: "Group/Class", required: true, mapped: "Group" },
  { col: "age", detected: "Age (years)", required: false, mapped: "Age" },
  { col: "sex", detected: "Sex", required: false, mapped: "Sex" },
  { col: "batch", detected: "Batch", required: false, mapped: "Batch" },
];

const validationResults = [
  { type: "success", message: "342 samples detected" },
  { type: "success", message: "1,247 metabolite features detected" },
  { type: "success", message: "2 sample groups identified: AD (178), Control (164)" },
  { type: "warning", message: "3.2% missing values — will be imputed by KNN" },
  { type: "warning", message: "14 features below 80% detection frequency" },
  { type: "success", message: "No duplicate sample IDs detected" },
  { type: "success", message: "Batch information available for correction" },
];

export function DataImportView() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  function handleFileSelect() {
    setFile("plasma_metabolomics_ADNI_v3.csv");
    setTimeout(() => setStep(1), 300);
  }

  function handleImport() {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      toast.success("Dataset imported successfully", {
        description: "342 samples · 1,247 features · ready for analysis",
      });
      navigate("/data");
    }, 2000);
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/data")}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold">Import Dataset</h2>
            <p className="text-xs text-muted-foreground">Add a new dataset to your project</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl p-6 space-y-6">
        {/* Stepper */}
        <div className="flex items-center gap-0">
          {steps.map((s, idx) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => idx < step && setStep(idx)}
                className="flex items-center gap-2"
                disabled={idx > step}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    idx < step
                      ? "bg-emerald-500 text-white"
                      : idx === step
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx < step ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    idx === step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s}
                </span>
              </button>
              {idx < steps.length - 1 && (
                <div className="flex-1 h-px mx-3 bg-border" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 0 && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(); }}
              onClick={handleFileSelect}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                isDragging
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-muted/30"
              }`}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-sm font-medium">Drop your file here</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                or click to browse — CSV, Excel (.xlsx), mzML, mzXML supported
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button className="rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90">
                  Browse Files
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Supported formats</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { fmt: "CSV / TSV", desc: "Comma or tab separated values" },
                  { fmt: "Excel (.xlsx)", desc: "Microsoft Excel workbook" },
                  { fmt: "mzML / mzXML", desc: "Mass spectrometry data" },
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
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
              <Check className="h-4 w-4 flex-shrink-0" />
              <span>
                <strong>{file}</strong> loaded successfully — 342 rows, 1,250 columns detected
              </span>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Column Mapping</h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="p-3 text-left font-medium">File Column</th>
                      <th className="p-3 text-left font-medium">Detected As</th>
                      <th className="p-3 text-left font-medium">Map to Field</th>
                      <th className="p-3 text-center font-medium">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleColumns.map((col) => (
                      <tr key={col.col} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-mono text-muted-foreground">{col.col}</td>
                        <td className="p-3">{col.detected}</td>
                        <td className="p-3">
                          <select
                            defaultValue={col.mapped}
                            className="rounded border border-border bg-background px-2 py-1 text-xs outline-none"
                          >
                            <option>Sample ID</option>
                            <option>Group</option>
                            <option>Age</option>
                            <option>Sex</option>
                            <option>Batch</option>
                            <option>Skip</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          {col.required ? (
                            <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              Required
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Optional</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                1,247 metabolite columns will be imported as features
              </p>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90"
              >
                Validate Data
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Validation Results</h3>
              <div className="space-y-2">
                {validationResults.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                      r.type === "success"
                        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                        : "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {r.type === "success" ? (
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    )}
                    {r.message}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="text-xs font-medium mb-3">Import Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Samples</p>
                  <p className="text-lg font-semibold tabular-nums mt-0.5">342</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Features</p>
                  <p className="text-lg font-semibold tabular-nums mt-0.5">1,247</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Groups</p>
                  <p className="text-lg font-semibold tabular-nums mt-0.5">2</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs hover:bg-accent"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90"
              >
                Proceed to Import
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-medium">Import Configuration</h3>
              <div className="space-y-3">
                {[
                  { label: "Dataset name", defaultValue: "Plasma Samples (ADNI v3)", type: "text" },
                  { label: "Description", defaultValue: "ADNI metabolomics plasma dataset, negative mode LC-MS", type: "text" },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                    <input
                      type={field.type}
                      defaultValue={field.defaultValue}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Project", defaultValue: "ADNI Metabolomics Study" },
                    { label: "Sample type", defaultValue: "Plasma" },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                      <select className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none">
                        <option>{field.defaultValue}</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs hover:bg-accent"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2 text-xs font-medium text-white shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Import Dataset
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
