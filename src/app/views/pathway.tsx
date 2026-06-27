import { useState } from "react";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { Play, Download, Settings2, ExternalLink, ChevronDown } from "lucide-react";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { ConfigureDialog } from "../components/configure-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";

const pathwayStages = [
  "Loading feature list",
  "Mapping features to KEGG IDs",
  "Running hypergeometric test",
  "Applying FDR correction",
  "Generating enrichment plots",
];

const pathwayConfig = [
  {
    title: "Database",
    fields: [
      { label: "Pathway Database", type: "select" as const, value: "KEGG", options: ["KEGG", "Reactome", "MetaCyc", "GO Biological Process"] },
      { label: "Organism", type: "select" as const, value: "Homo sapiens", options: ["Homo sapiens", "Mus musculus", "Rattus norvegicus"] },
      { label: "ID type", type: "select" as const, value: "HMDB", options: ["HMDB", "KEGG", "PubChem", "ChEBI"] },
    ],
  },
  {
    title: "Statistical Method",
    fields: [
      { label: "Test Method", type: "select" as const, value: "Hypergeometric", options: ["Hypergeometric", "Fisher's Exact", "GSEA"] },
      { label: "Multiple testing correction", type: "select" as const, value: "FDR (BH)", options: ["FDR (BH)", "Bonferroni", "None"] },
      { label: "p-value threshold", type: "number" as const, value: 0.05 },
    ],
  },
  {
    title: "Background",
    fields: [
      { label: "Use custom background", type: "checkbox" as const, value: false, description: "Use all detected metabolites as background" },
      { label: "Min pathway size", type: "number" as const, value: 3 },
      { label: "Max pathway size", type: "number" as const, value: 500 },
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

export function PathwayView() {
  const [runOpen, setRunOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div className="flex h-full">
      <RunAnalysisDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        analysisName="Pathway Enrichment Analysis"
        stages={pathwayStages}
      />
      <ConfigureDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Configure Pathway Enrichment"
        groups={pathwayConfig}
      />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Pathway Enrichment Analysis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Functional annotation and over-representation
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
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Enriched Pathways</p>
            <p className="mt-1 text-xl tabular-nums">47</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Input Features</p>
            <p className="mt-1 text-xl tabular-nums">189</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Mapped Features</p>
            <p className="mt-1 text-xl tabular-nums">143</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Database</p>
            <p className="mt-1 text-base">KEGG</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Enrichment Overview</h3>
            <ExportMenu />
          </div>
          <ChartPlaceholder type="Dot Plot (p-value vs Count)" height="400px" />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm">Top Enriched Pathways</h3>
            <ExportMenu />
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="p-2 text-left font-medium">Pathway</th>
                  <th className="p-2 text-right font-medium">Hits</th>
                  <th className="p-2 text-right font-medium">Total</th>
                  <th className="p-2 text-right font-medium">p-value</th>
                  <th className="p-2 text-right font-medium">FDR</th>
                  <th className="p-2 text-center font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Aminoacyl-tRNA biosynthesis", hits: 12, total: 48, p: 2.3e-6, fdr: 1.1e-4, id: "00970" },
                  { name: "Valine, leucine, isoleucine biosynthesis", hits: 8, total: 27, p: 5.6e-5, fdr: 1.3e-3, id: "00290" },
                  { name: "Nitrogen metabolism", hits: 7, total: 32, p: 1.2e-4, fdr: 1.9e-3, id: "00910" },
                  { name: "Arginine biosynthesis", hits: 9, total: 41, p: 2.8e-4, fdr: 3.2e-3, id: "00220" },
                  { name: "Glutathione metabolism", hits: 6, total: 29, p: 4.5e-4, fdr: 4.1e-3, id: "00480" },
                ].map((pathway) => (
                  <tr key={pathway.name} className="border-b border-border hover:bg-muted/50">
                    <td className="p-2">{pathway.name}</td>
                    <td className="p-2 text-right tabular-nums">{pathway.hits}</td>
                    <td className="p-2 text-right tabular-nums">{pathway.total}</td>
                    <td className="p-2 text-right tabular-nums">{pathway.p.toExponential(1)}</td>
                    <td className="p-2 text-right tabular-nums">{pathway.fdr.toExponential(1)}</td>
                    <td className="p-2 text-center">
                      <button
                        className="inline-flex items-center text-primary hover:underline"
                        onClick={() => toast.info(`Opening KEGG pathway hsa${pathway.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
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
          <h3 className="text-xs text-muted-foreground mb-2">Analysis Settings</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Database</span>
              <span>KEGG</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Organism</span>
              <span>H. sapiens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span>Hypergeometric</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Correction</span>
              <span>FDR (BH)</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Pathway Categories</h3>
          <div className="space-y-1.5">
            {[
              { name: "Amino Acid Metabolism", count: 18 },
              { name: "Carbohydrate Metabolism", count: 12 },
              { name: "Lipid Metabolism", count: 9 },
              { name: "Energy Metabolism", count: 8 },
            ].map((category) => (
              <div
                key={category.name}
                className="rounded-md bg-card p-2 text-xs hover:bg-accent cursor-pointer"
                onClick={() => toast.info(`Filter: ${category.name}`)}
              >
                <div className="flex justify-between">
                  <span className="line-clamp-1">{category.name}</span>
                  <span className="tabular-nums text-muted-foreground">{category.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Alternative Databases</h3>
          <div className="space-y-1.5">
            {["Reactome", "GO Biological Process", "MetaCyc"].map((db) => (
              <button
                key={db}
                className="w-full rounded-md bg-card p-2 text-left text-xs hover:bg-accent"
                onClick={() => toast.info(`Switching database to ${db}`)}
              >
                {db}
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
