import { useState } from "react";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { Play, Download, Settings2, Filter, ChevronDown } from "lucide-react";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { ConfigureDialog } from "../components/configure-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";

const volcanoStages = [
  "Loading dataset",
  "Computing fold changes",
  "Running statistical tests",
  "Applying FDR correction",
  "Generating volcano plot",
];

const volcanoConfig = [
  {
    title: "Statistical Test",
    fields: [
      { label: "Test Method", type: "select" as const, value: "t-test", options: ["t-test", "Wilcoxon", "ANOVA", "Limma"] },
      { label: "Assume equal variance", type: "checkbox" as const, value: true },
      { label: "Paired test", type: "checkbox" as const, value: false },
    ],
  },
  {
    title: "Thresholds",
    fields: [
      { label: "p-value cutoff", type: "number" as const, value: 0.05 },
      { label: "Fold change cutoff (log2)", type: "number" as const, value: 1.5 },
      { label: "Multiple testing correction", type: "select" as const, value: "FDR (BH)", options: ["FDR (BH)", "Bonferroni", "Holm", "None"] },
    ],
  },
  {
    title: "Visualization",
    fields: [
      { label: "Label top N features", type: "number" as const, value: 20 },
      { label: "Color by regulation", type: "checkbox" as const, value: true },
      { label: "Show threshold lines", type: "checkbox" as const, value: true },
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

export function VolcanoView() {
  const [runOpen, setRunOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  return (
    <div className="flex h-full">
      <RunAnalysisDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        analysisName="Volcano Plot Analysis"
        stages={volcanoStages}
      />
      <ConfigureDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Configure Volcano Plot"
        groups={volcanoConfig}
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Volcano Plot Analysis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Differential abundance with fold-change and significance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
                  <Filter className="h-3.5 w-3.5" />
                  {activeFilter ?? "Filters"}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[180px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                  sideOffset={4}
                >
                  {["All features", "Upregulated only", "Downregulated only", "Top 50 by p-value"].map((f) => (
                    <DropdownMenu.Item
                      key={f}
                      className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                      onSelect={() => {
                        setActiveFilter(f === "All features" ? null : f);
                        toast.info(`Filter: ${f}`);
                      }}
                    >
                      {f}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
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
          <div className="rounded-lg border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-rose-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Upregulated</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">87</p>
          </div>
          <div className="rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Downregulated</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">102</p>
          </div>
          <div className="rounded-lg border border-border bg-gradient-to-br from-muted/30 to-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">Not Significant</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">1,058</p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-violet-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Total Features</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">1,247</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Volcano Plot (log2FC vs -log10 p-value)</h3>
            <ExportMenu />
          </div>
          <ChartPlaceholder type="Volcano Plot" height="500px" />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm">Significant Features</h3>
            <ExportMenu />
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="p-2 text-left font-medium">Feature</th>
                  <th className="p-2 text-right font-medium">log2FC</th>
                  <th className="p-2 text-right font-medium">p-value</th>
                  <th className="p-2 text-right font-medium">adj. p-value</th>
                  <th className="p-2 text-left font-medium">Regulation</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Glutamate", fc: 2.34, p: 1.2e-8, adj: 3.4e-6, reg: "Up" },
                  { name: "Leucine", fc: -1.87, p: 4.5e-7, adj: 8.2e-5, reg: "Down" },
                  { name: "Phenylalanine", fc: 1.92, p: 2.1e-6, adj: 2.3e-4, reg: "Up" },
                  { name: "Valine", fc: -1.65, p: 5.6e-6, adj: 4.7e-4, reg: "Down" },
                  { name: "Isoleucine", fc: -1.54, p: 1.2e-5, adj: 8.9e-4, reg: "Down" },
                ].map((feature) => (
                  <tr key={feature.name} className="border-b border-border hover:bg-muted/50 cursor-pointer">
                    <td className="p-2">{feature.name}</td>
                    <td className="p-2 text-right tabular-nums">{feature.fc.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums">{feature.p.toExponential(1)}</td>
                    <td className="p-2 text-right tabular-nums">{feature.adj.toExponential(1)}</td>
                    <td className="p-2">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 ${
                          feature.reg === "Up"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {feature.reg}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="w-64 border-l border-border bg-muted/30 p-4 space-y-4 overflow-auto">
        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Threshold Settings</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">FC cutoff</span>
              <span className="tabular-nums">±1.5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">p-value</span>
              <span className="tabular-nums">0.05</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Correction</span>
              <span>FDR (BH)</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Statistical Test</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span>t-test</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Variance</span>
              <span>Equal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paired</span>
              <span>No</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Quick Filters</h3>
          <div className="space-y-1.5">
            {["Show upregulated only", "Show downregulated only", "Top 50 by p-value"].map((f) => (
              <button
                key={f}
                onClick={() => toast.info(`Filter: ${f}`)}
                className="w-full rounded-md bg-card p-2 text-left text-xs hover:bg-accent"
              >
                {f}
              </button>
            ))}
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
