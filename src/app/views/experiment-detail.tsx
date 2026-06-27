import { useParams, useNavigate, Link } from "react-router";
import { ChartPlaceholder } from "../components/chart-placeholder";
import {
  ArrowLeft,
  Download,
  Share2,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronDown,
  BarChart3,
  FileText,
  Settings2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tabs from "@radix-ui/react-tabs";
import { toast } from "sonner";

const experiments: Record<
  string,
  {
    id: string;
    name: string;
    project: string;
    type: string;
    status: "completed" | "running" | "failed";
    created: string;
    duration: string;
    description: string;
    metrics: { label: string; value: string; color: string }[];
    chartType: string;
    chartHeight: string;
    parameters: { label: string; value: string }[];
    features: { name: string; stat1: string; stat2: string; stat3: string }[];
  }
> = {
  "1": {
    id: "1",
    name: "PCA - AD vs Control",
    project: "ADNI Metabolomics Study",
    type: "PCA",
    status: "completed",
    created: "3 hours ago",
    duration: "2m 14s",
    description:
      "Principal Component Analysis comparing Alzheimer's disease patients against age-matched controls. Pareto-scaled with KNN imputation.",
    metrics: [
      { label: "PC1 Variance", value: "42.3%", color: "text-violet-600 dark:text-violet-400" },
      { label: "PC2 Variance", value: "23.7%", color: "text-cyan-600 dark:text-cyan-400" },
      { label: "Total Explained", value: "66.0%", color: "text-emerald-600 dark:text-emerald-400" },
      { label: "Samples", value: "342", color: "text-amber-600 dark:text-amber-400" },
    ],
    chartType: "PCA Score Plot",
    chartHeight: "420px",
    parameters: [
      { label: "Scaling", value: "Pareto" },
      { label: "Components", value: "5" },
      { label: "Missing values", value: "KNN impute" },
      { label: "Log transform", value: "Yes" },
    ],
    features: [
      { name: "Glutamate", stat1: "PC1: 0.412", stat2: "PC2: 0.187", stat3: "Loading: 0.38" },
      { name: "Leucine", stat1: "PC1: 0.389", stat2: "PC2: 0.201", stat3: "Loading: 0.35" },
      { name: "Phenylalanine", stat1: "PC1: 0.341", stat2: "PC2: 0.156", stat3: "Loading: 0.31" },
    ],
  },
  "2": {
    id: "2",
    name: "Volcano Analysis - Plasma",
    project: "Cancer Biomarker Panel",
    type: "Volcano",
    status: "completed",
    created: "5 hours ago",
    duration: "1m 47s",
    description:
      "Differential abundance analysis between cancer and healthy control groups. t-test with FDR correction (BH).",
    metrics: [
      { label: "Upregulated", value: "87", color: "text-rose-600 dark:text-rose-400" },
      { label: "Downregulated", value: "102", color: "text-blue-600 dark:text-blue-400" },
      { label: "Not Significant", value: "1,058", color: "text-muted-foreground" },
      { label: "Total Features", value: "1,247", color: "text-violet-600 dark:text-violet-400" },
    ],
    chartType: "Volcano Plot",
    chartHeight: "420px",
    parameters: [
      { label: "Test", value: "t-test" },
      { label: "FC cutoff", value: "±1.5 (log2)" },
      { label: "p-value", value: "0.05" },
      { label: "Correction", value: "FDR (BH)" },
    ],
    features: [
      { name: "Glutamate", stat1: "FC: +2.34", stat2: "p: 1.2×10⁻⁸", stat3: "FDR: 3.4×10⁻⁶" },
      { name: "Leucine", stat1: "FC: −1.87", stat2: "p: 4.5×10⁻⁷", stat3: "FDR: 8.2×10⁻⁵" },
      { name: "Phenylalanine", stat1: "FC: +1.92", stat2: "p: 2.1×10⁻⁶", stat3: "FDR: 2.3×10⁻⁴" },
    ],
  },
  "3": {
    id: "3",
    name: "PLS-DA Classification",
    project: "ADNI Metabolomics Study",
    type: "PLS-DA",
    status: "running",
    created: "1 day ago",
    duration: "In progress...",
    description:
      "Supervised multivariate classification with 7-fold cross-validation and 1000 permutations.",
    metrics: [
      { label: "Accuracy", value: "—", color: "text-muted-foreground" },
      { label: "R²", value: "—", color: "text-muted-foreground" },
      { label: "Q²", value: "—", color: "text-muted-foreground" },
      { label: "Components", value: "3", color: "text-amber-600 dark:text-amber-400" },
    ],
    chartType: "PLS-DA Score Plot",
    chartHeight: "420px",
    parameters: [
      { label: "Components", value: "3" },
      { label: "CV Method", value: "7-fold" },
      { label: "Permutations", value: "1000" },
      { label: "Scaling", value: "Pareto" },
    ],
    features: [],
  },
  "4": {
    id: "4",
    name: "Pathway Enrichment - KEGG",
    project: "Diabetes Cohort 2024",
    type: "Pathway",
    status: "completed",
    created: "2 days ago",
    duration: "3m 02s",
    description:
      "Over-representation analysis using KEGG metabolic pathways with hypergeometric test.",
    metrics: [
      { label: "Enriched Pathways", value: "47", color: "text-violet-600 dark:text-violet-400" },
      { label: "Input Features", value: "189", color: "text-cyan-600 dark:text-cyan-400" },
      { label: "Mapped", value: "143", color: "text-emerald-600 dark:text-emerald-400" },
      { label: "Database", value: "KEGG", color: "text-amber-600 dark:text-amber-400" },
    ],
    chartType: "Dot Plot (p-value vs Count)",
    chartHeight: "420px",
    parameters: [
      { label: "Database", value: "KEGG" },
      { label: "Organism", value: "H. sapiens" },
      { label: "Method", value: "Hypergeometric" },
      { label: "FDR threshold", value: "0.05" },
    ],
    features: [
      { name: "Aminoacyl-tRNA biosynthesis", stat1: "Hits: 12/48", stat2: "p: 2.3×10⁻⁶", stat3: "FDR: 1.1×10⁻⁴" },
      { name: "BCAA biosynthesis", stat1: "Hits: 8/27", stat2: "p: 5.6×10⁻⁵", stat3: "FDR: 1.3×10⁻³" },
      { name: "Nitrogen metabolism", stat1: "Hits: 7/32", stat2: "p: 1.2×10⁻⁴", stat3: "FDR: 1.9×10⁻³" },
    ],
  },
  "5": {
    id: "5",
    name: "Hierarchical Clustering",
    project: "COVID-19 Severity Markers",
    type: "Clustering",
    status: "failed",
    created: "4 days ago",
    duration: "Failed at 0m 34s",
    description:
      "Hierarchical clustering with Ward linkage failed due to insufficient sample size after QC filtering.",
    metrics: [
      { label: "Error", value: "n < 10", color: "text-destructive" },
      { label: "Features loaded", value: "1,247", color: "text-muted-foreground" },
      { label: "Samples after QC", value: "8", color: "text-destructive" },
      { label: "Required minimum", value: "10", color: "text-muted-foreground" },
    ],
    chartType: "No results",
    chartHeight: "300px",
    parameters: [
      { label: "Distance", value: "Euclidean" },
      { label: "Linkage", value: "Ward" },
      { label: "Normalization", value: "Z-score" },
    ],
    features: [],
  },
};

function StatusBadge({ status }: { status: "completed" | "running" | "failed" }) {
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </span>
    );
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Running
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
      <AlertCircle className="h-3 w-3" />
      Failed
    </span>
  );
}

export function ExperimentDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const exp = experiments[id ?? "1"] ?? experiments["1"];

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate("/projects")}
              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{exp.name}</h2>
                <StatusBadge status={exp.status} />
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{exp.project}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {exp.created}
                </span>
                <span>·</span>
                <span>{exp.duration}</span>
              </div>
              <p className="mt-1.5 max-w-xl text-xs text-muted-foreground">{exp.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info("Sharing link copied to clipboard")}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
                  <Download className="h-3.5 w-3.5" />
                  Export
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                  sideOffset={4}
                  align="end"
                >
                  {["Full Report (PDF)", "Results (CSV)", "Figures (PNG)", "Raw Data (JSON)"].map((fmt) => (
                    <DropdownMenu.Item
                      key={fmt}
                      className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                      onSelect={() => toast.success(`Exported: ${fmt}`)}
                    >
                      {fmt}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-3">
          {exp.metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs.Root defaultValue="results">
          <Tabs.List className="flex border-b border-border gap-0">
            {[
              { value: "results", label: "Results", icon: BarChart3 },
              { value: "parameters", label: "Parameters", icon: Settings2 },
              { value: "log", label: "Run Log", icon: FileText },
            ].map(({ value, label, icon: Icon }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-xs text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="results" className="pt-4 space-y-4">
            {exp.status === "failed" ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
                <h3 className="text-sm font-medium text-destructive">Analysis Failed</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Insufficient samples after QC filtering (n=8, minimum required: 10).
                  <br />
                  Consider relaxing QC parameters or including additional samples.
                </p>
                <button
                  onClick={() => toast.info("Opening QC settings...")}
                  className="mt-4 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  Adjust QC Settings
                </button>
              </div>
            ) : exp.status === "running" ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-6 text-center">
                <Loader2 className="mx-auto h-8 w-8 text-amber-500 animate-spin mb-3" />
                <h3 className="text-sm font-medium">Analysis Running</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Currently in permutation testing phase (1000 iterations).<br />
                  Estimated completion in ~4 minutes.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm">{exp.type} — Primary Visualization</h3>
                    <button
                      onClick={() => toast.success("Figure exported as PNG")}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export PNG
                    </button>
                  </div>
                  <ChartPlaceholder type={exp.chartType} height={exp.chartHeight} />
                </div>

                {exp.features.length > 0 && (
                  <div className="rounded-lg border border-border bg-card">
                    <div className="border-b border-border p-4">
                      <h3 className="text-sm">Top Contributing Features</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {exp.features.map((f) => (
                        <div key={f.name} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                          <span className="text-sm font-medium">{f.name}</span>
                          <div className="flex items-center gap-6 text-xs text-muted-foreground">
                            <span>{f.stat1}</span>
                            <span>{f.stat2}</span>
                            <span>{f.stat3}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Tabs.Content>

          <Tabs.Content value="parameters" className="pt-4">
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {exp.parameters.map((p) => (
                <div key={p.label} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-medium">{p.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => toast.info("Re-running with same parameters...")}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                Re-run with these settings
              </button>
              <Link
                to={`/${exp.type.toLowerCase().replace("-da", "da").replace(" ", "")}`}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
              >
                Open {exp.type} module
              </Link>
            </div>
          </Tabs.Content>

          <Tabs.Content value="log" className="pt-4">
            <div className="rounded-lg border border-border bg-card font-mono text-xs">
              <div className="border-b border-border px-4 py-2 text-muted-foreground">Execution log</div>
              <div className="p-4 space-y-1 text-muted-foreground">
                {[
                  { time: "00:00.00", msg: `[INFO] Starting ${exp.name}` },
                  { time: "00:00.12", msg: "[INFO] Loading dataset: Plasma Samples (n=342, p=1247)" },
                  { time: "00:00.45", msg: "[INFO] Applying Pareto scaling" },
                  { time: "00:01.02", msg: "[INFO] KNN imputation complete (0 missing values)" },
                  { time: "00:01.14", msg: `[INFO] Running ${exp.type} algorithm` },
                  {
                    time: "00:02.01",
                    msg:
                      exp.status === "failed"
                        ? "[ERROR] Insufficient samples after QC: n=8 (minimum: 10)"
                        : exp.status === "running"
                          ? "[INFO] Permutation test: 423/1000 complete..."
                          : "[INFO] Analysis complete",
                  },
                  ...(exp.status === "completed"
                    ? [
                        { time: "00:02.08", msg: "[INFO] Generating visualizations" },
                        { time: "00:02.14", msg: "[INFO] Results saved to experiment store" },
                        { time: "00:02.14", msg: "[SUCCESS] Experiment completed successfully" },
                      ]
                    : []),
                ].map((line, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="flex-shrink-0 tabular-nums text-muted-foreground/60">
                      {line.time}
                    </span>
                    <span
                      className={
                        line.msg.includes("[ERROR]")
                          ? "text-destructive"
                          : line.msg.includes("[SUCCESS]")
                            ? "text-emerald-500"
                            : ""
                      }
                    >
                      {line.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
