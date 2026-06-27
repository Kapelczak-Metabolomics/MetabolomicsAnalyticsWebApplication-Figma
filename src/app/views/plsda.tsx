import { useState } from "react";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { Play, Download, Settings2, ChevronDown } from "lucide-react";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { ConfigureDialog } from "../components/configure-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";

const plsdaStages = [
  "Loading dataset into memory",
  "Applying scaling & normalization",
  "Building PLS-DA model",
  "Running cross-validation (7-fold)",
  "Permutation testing (1000 iterations)",
  "Computing VIP scores",
];

const plsdaConfig = [
  {
    title: "Model Parameters",
    fields: [
      { label: "Number of Components", type: "number" as const, value: 3 },
      { label: "Scaling Method", type: "select" as const, value: "Pareto", options: ["Pareto", "Auto", "Range", "None"] },
      { label: "Log Transformation", type: "checkbox" as const, value: true },
    ],
  },
  {
    title: "Cross-Validation",
    fields: [
      { label: "CV Method", type: "select" as const, value: "7-fold", options: ["7-fold", "5-fold", "10-fold", "LOO"] },
      { label: "Permutations", type: "number" as const, value: 1000 },
      { label: "Seed", type: "number" as const, value: 42 },
    ],
  },
  {
    title: "Feature Selection",
    fields: [
      { label: "VIP threshold", type: "number" as const, value: 1.0 },
      { label: "Apply feature selection", type: "checkbox" as const, value: false, description: "Retain only features with VIP > threshold" },
    ],
  },
];

function ExportMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" />
          Export
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

export function PLSDAView() {
  const [runOpen, setRunOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className="flex h-full">
      <RunAnalysisDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        analysisName="PLS-DA Classification"
        stages={plsdaStages}
      />
      <ConfigureDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Configure PLS-DA"
        groups={plsdaConfig}
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Partial Least Squares - DA</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supervised classification and biomarker discovery
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

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Accuracy</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">87.3%</p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-violet-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">R² (cumulative)</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">0.714</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-cyan-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Q² (CV)</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">0.658</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Components</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">3</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Score Plot (LV1 vs LV2)</h3>
            <ExportMenu />
          </div>
          <ChartPlaceholder type="PLS-DA Score Plot" height="450px" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm">VIP Scores</h3>
              <ExportMenu />
            </div>
            <ChartPlaceholder type="Variable Importance in Projection" height="280px" />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm">Permutation Test</h3>
              <ExportMenu />
            </div>
            <ChartPlaceholder type="Model Validation" height="280px" />
          </div>
        </div>
      </div>

      <div className="w-64 border-l border-border bg-muted/30 p-4 space-y-4 overflow-auto">
        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Model Performance</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sensitivity</span>
              <span className="tabular-nums">89.2%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Specificity</span>
              <span className="tabular-nums">85.4%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AUC</span>
              <span className="tabular-nums">0.923</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Top VIP Features</h3>
          <div className="space-y-1.5">
            {[
              { name: "Glutamate", vip: 2.34 },
              { name: "Leucine", vip: 2.12 },
              { name: "Phenylalanine", vip: 1.89 },
              { name: "Valine", vip: 1.76 },
              { name: "Isoleucine", vip: 1.68 },
            ].map((feature) => (
              <div
                key={feature.name}
                className="rounded-md bg-card p-2 text-xs hover:bg-accent cursor-pointer"
                onClick={() => toast.info(`${feature.name} — VIP: ${feature.vip}`)}
              >
                <div className="flex justify-between">
                  <span>{feature.name}</span>
                  <span className="tabular-nums text-muted-foreground">{feature.vip}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Cross-Validation</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span>7-fold CV</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Permutations</span>
              <span>1000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">p-value</span>
              <span className="tabular-nums">&lt; 0.001</span>
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
