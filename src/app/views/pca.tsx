import { useState } from "react";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { Play, Download, Settings2, ChevronDown } from "lucide-react";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { ConfigureDialog } from "../components/configure-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";

const pcaStages = [
  "Loading dataset into memory",
  "Applying Pareto scaling",
  "Computing covariance matrix",
  "Running SVD decomposition",
  "Generating score & loading plots",
];

const pcaConfig = [
  {
    title: "Preprocessing",
    fields: [
      { label: "Scaling Method", type: "select" as const, value: "Pareto", options: ["Pareto", "Auto", "Range", "Vast", "None"] },
      { label: "Missing Value Imputation", type: "select" as const, value: "KNN", options: ["KNN", "Half-minimum", "Median", "BPCA", "PPCA"] },
      { label: "Log Transformation", type: "checkbox" as const, value: true },
    ],
  },
  {
    title: "Analysis Parameters",
    fields: [
      { label: "Number of Components", type: "number" as const, value: 5 },
      { label: "Show Confidence Ellipses", type: "checkbox" as const, value: true, description: "95% confidence ellipses per group" },
      { label: "Color by Group", type: "checkbox" as const, value: true },
    ],
  },
  {
    title: "Outlier Detection",
    fields: [
      { label: "Hotelling T² threshold", type: "number" as const, value: 0.95, unit: "α" },
      { label: "Q-residuals threshold", type: "number" as const, value: 0.95, unit: "α" },
      { label: "Flag outliers", type: "checkbox" as const, value: true },
    ],
  },
];

function ExportMenu({ label = "Export" }: { label?: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" />
          {label}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
          sideOffset={4}
          align="end"
        >
          {["PNG (high-res)", "SVG (vector)", "PDF", "CSV (data)"].map((fmt) => (
            <DropdownMenu.Item
              key={fmt}
              className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
              onSelect={() => toast.success(`Exported as ${fmt.split(" ")[0]}`)}
            >
              {fmt}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function PCAView() {
  const [runOpen, setRunOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className="flex h-full">
      <RunAnalysisDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        analysisName="Principal Component Analysis"
        stages={pcaStages}
      />
      <ConfigureDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Configure PCA"
        groups={pcaConfig}
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Principal Component Analysis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unsupervised dimensionality reduction
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configure
            </button>
            <button
              onClick={() => setRunOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-3.5 w-3.5" />
              Run Analysis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-violet-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">PC1 Variance</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">42.3%</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-cyan-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">PC2 Variance</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">23.7%</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Total Explained</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">66.0%</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Score Plot (PC1 vs PC2)</h3>
            <ExportMenu />
          </div>
          <ChartPlaceholder type="PCA Score Plot" height="450px" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm">Scree Plot</h3>
              <ExportMenu />
            </div>
            <ChartPlaceholder type="Variance Explained" height="280px" />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm">Loadings Plot</h3>
              <ExportMenu />
            </div>
            <ChartPlaceholder type="PC1 Loadings" height="280px" />
          </div>
        </div>
      </div>

      <div className="w-64 border-l border-border bg-muted/30 p-4 space-y-4 overflow-auto">
        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Analysis Settings</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scaling</span>
              <span>Pareto</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Components</span>
              <span>5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Missing values</span>
              <span>KNN impute</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Top Contributing Features</h3>
          <div className="space-y-1.5">
            {["Glutamate", "Leucine", "Phenylalanine", "Valine", "Isoleucine"].map((feature) => (
              <div
                key={feature}
                className="rounded-md bg-card p-2 text-xs hover:bg-accent cursor-pointer"
                onClick={() => toast.info(`${feature} — view metabolite details`)}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Sample Groups</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full bg-chart-1" />
              <span>AD (n=178)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2.5 w-2.5 rounded-full bg-chart-2" />
              <span>Control (n=164)</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <button
            onClick={() => setRunOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <Play className="h-3.5 w-3.5" />
            Re-run Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
