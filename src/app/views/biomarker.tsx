import { useState } from "react";
import { Play, Download, Settings2, Filter, Plus, Trash2, ChevronDown, X } from "lucide-react";
import { ConfigureDialog } from "../components/configure-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";

const biomarkerConfig = [
  {
    title: "Priority Scoring Weights",
    fields: [
      { label: "Fold Change weight", type: "number" as const, value: 30, unit: "%" },
      { label: "Statistical significance weight", type: "number" as const, value: 25, unit: "%" },
      { label: "VIP Score weight", type: "number" as const, value: 25, unit: "%" },
      { label: "Literature support weight", type: "number" as const, value: 20, unit: "%" },
    ],
  },
  {
    title: "Display Options",
    fields: [
      { label: "Show PubMed counts", type: "checkbox" as const, value: true },
      { label: "Link to HMDB", type: "checkbox" as const, value: true },
      { label: "Min priority score", type: "number" as const, value: 5.0, description: "Hide features below this score" },
    ],
  },
];

const defaultCriteria = [
  { id: 1, name: "Fold Change", operator: "≥", value: "1.5", passed: 87 },
  { id: 2, name: "Statistical Significance", operator: "<", value: "0.05 (FDR)", passed: 189 },
  { id: 3, name: "VIP Score", operator: ">", value: "1.0", passed: 124 },
  { id: 4, name: "Frequency", operator: ">", value: "80%", passed: 456 },
  { id: 5, name: "Pathway Involvement", operator: "In", value: "Amino Acid Metabolism", passed: 67 },
];

function CriteriaEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [criteria, setCriteria] = useState(defaultCriteria);

  function removeCriterion(id: number) {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  function addCriterion() {
    setCriteria((prev) => [
      ...prev,
      { id: Date.now(), name: "New Criterion", operator: ">", value: "0", passed: 0 },
    ]);
  }

  function handleSave() {
    onClose();
    toast.success("Criteria updated", {
      description: `${criteria.length} active filters applied`,
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-sm font-semibold">Edit Filtering Criteria</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                Define multi-criteria filters for biomarker candidates
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="overflow-auto max-h-[calc(85vh-130px)] p-5 space-y-3">
            {criteria.map((criterion, idx) => (
              <div key={criterion.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <div className="flex h-5 w-5 items-center justify-center rounded text-xs text-muted-foreground bg-muted flex-shrink-0">
                  {idx + 1}
                </div>
                <input
                  defaultValue={criterion.name}
                  className="flex-1 min-w-0 rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary/50"
                />
                <select
                  defaultValue={criterion.operator}
                  className="rounded border border-border bg-card px-2 py-1 text-xs outline-none"
                >
                  {[">", "<", "≥", "≤", "=", "In", "Not In"].map((op) => (
                    <option key={op}>{op}</option>
                  ))}
                </select>
                <input
                  defaultValue={criterion.value}
                  className="w-32 rounded border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => removeCriterion(criterion.id)}
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <button
              onClick={addCriterion}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add criterion
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
            >
              Save Criteria
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function BiomarkerView() {
  const [configOpen, setConfigOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  return (
    <div className="flex h-full">
      <ConfigureDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Configure Biomarker Lenses"
        groups={biomarkerConfig}
      />
      <CriteriaEditor open={criteriaOpen} onClose={() => setCriteriaOpen(false)} />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Biomarker Lenses</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Multi-criteria feature filtering and prioritization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCriteriaOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Filter className="h-3.5 w-3.5" />
              Edit Criteria
            </button>
            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configure
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
                  <Download className="h-3.5 w-3.5" />
                  Export Candidates
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                  sideOffset={4}
                  align="end"
                >
                  {["CSV (all data)", "Excel (.xlsx)", "PDF report", "JSON"].map((fmt) => (
                    <DropdownMenu.Item
                      key={fmt}
                      className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                      onSelect={() => toast.success(`Exported 34 candidates as ${fmt.split(" ")[0]}`)}
                    >
                      {fmt}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Candidates</p>
            <p className="mt-1 text-xl tabular-nums">34</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Criteria Passed</p>
            <p className="mt-1 text-xl tabular-nums">5/5</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">High Priority</p>
            <p className="mt-1 text-xl tabular-nums">12</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Literature Support</p>
            <p className="mt-1 text-xl tabular-nums">8</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Active Filtering Criteria</h3>
            <button
              onClick={() => setCriteriaOpen(true)}
              className="text-xs text-primary hover:underline"
            >
              Edit
            </button>
          </div>
          <div className="space-y-2">
            {defaultCriteria.map((criterion) => (
              <div
                key={criterion.id}
                className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>{criterion.name}</span>
                  <span className="text-muted-foreground">
                    {criterion.operator} {criterion.value}
                  </span>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {criterion.passed} features
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm">Biomarker Candidates</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sort by:</span>
              <select className="rounded border border-border bg-background px-2 py-1">
                <option>Priority Score</option>
                <option>Fold Change</option>
                <option>p-value</option>
                <option>VIP Score</option>
              </select>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="p-2 text-left font-medium">Feature</th>
                  <th className="p-2 text-right font-medium">log2FC</th>
                  <th className="p-2 text-right font-medium">adj. p</th>
                  <th className="p-2 text-right font-medium">VIP</th>
                  <th className="p-2 text-right font-medium">Priority</th>
                  <th className="p-2 text-left font-medium">Pathway</th>
                  <th className="p-2 text-center font-medium">PubMed</th>
                  <th className="p-2 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Glutamate", fc: 2.34, p: 3.4e-6, vip: 2.34, priority: 9.2, pathway: "Nitrogen metabolism", pubmed: 234 },
                  { name: "Leucine", fc: -1.87, p: 8.2e-5, vip: 2.12, priority: 8.8, pathway: "BCAA biosynthesis", pubmed: 187 },
                  { name: "Phenylalanine", fc: 1.92, p: 2.3e-4, vip: 1.89, priority: 8.5, pathway: "Aminoacyl-tRNA", pubmed: 156 },
                  { name: "Valine", fc: -1.65, p: 4.7e-4, vip: 1.76, priority: 8.1, pathway: "BCAA biosynthesis", pubmed: 143 },
                  { name: "Isoleucine", fc: -1.54, p: 8.9e-4, vip: 1.68, priority: 7.9, pathway: "BCAA biosynthesis", pubmed: 129 },
                  { name: "Arginine", fc: 1.73, p: 1.2e-3, vip: 1.54, priority: 7.6, pathway: "Arginine biosynthesis", pubmed: 201 },
                ].map((feature) => (
                  <tr key={feature.name} className="border-b border-border hover:bg-muted/50">
                    <td className="p-2 font-medium">{feature.name}</td>
                    <td className="p-2 text-right tabular-nums">{feature.fc.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums">{feature.p.toExponential(1)}</td>
                    <td className="p-2 text-right tabular-nums">{feature.vip.toFixed(2)}</td>
                    <td className="p-2 text-right">
                      <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 tabular-nums text-primary">
                        {feature.priority}
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground">{feature.pathway}</td>
                    <td className="p-2 text-center tabular-nums text-muted-foreground">{feature.pubmed}</td>
                    <td className="p-2 text-center">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="rounded px-1.5 py-0.5 text-xs hover:bg-accent">•••</button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            className="z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                            sideOffset={4}
                            align="end"
                          >
                            {[
                              "Add to watchlist",
                              "Search literature",
                              "View in HMDB",
                              "Copy feature ID",
                            ].map((action) => (
                              <DropdownMenu.Item
                                key={action}
                                className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                                onSelect={() => toast.info(`${action}: ${feature.name}`)}
                              >
                                {action}
                              </DropdownMenu.Item>
                            ))}
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
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
          <h3 className="text-xs text-muted-foreground mb-2">Priority Scoring</h3>
          <div className="space-y-2 text-xs">
            {[
              { label: "Fold Change", value: "30%", pct: 30, color: "bg-violet-500" },
              { label: "p-value", value: "25%", pct: 25, color: "bg-cyan-500" },
              { label: "VIP Score", value: "25%", pct: 25, color: "bg-emerald-500" },
              { label: "Literature", value: "20%", pct: 20, color: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="tabular-nums">{item.value}</span>
                </div>
                <div className="h-1 rounded-full bg-muted">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: item.value }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Quick Actions</h3>
          <div className="space-y-1.5">
            {[
              { label: "Add to watchlist", action: "3 selected items added to watchlist" },
              { label: "Generate report", action: "Report generated (PDF)" },
              { label: "Search literature", action: "Opening PubMed search..." },
              { label: "Compare to previous", action: "Opening comparison view..." },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => toast.info(item.action)}
                className="w-full rounded-md bg-card p-2 text-left text-xs hover:bg-accent"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Saved Lenses</h3>
          <div className="space-y-1.5">
            {["High Confidence", "Novel Candidates", "Known Biomarkers"].map((lens) => (
              <button
                key={lens}
                onClick={() => toast.info(`Loaded lens: ${lens}`)}
                className="w-full rounded-md bg-card p-2 text-left text-xs hover:bg-accent"
              >
                {lens}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border space-y-1.5">
          <button
            onClick={() => setCriteriaOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
          >
            <Filter className="h-3.5 w-3.5" />
            Edit Criteria
          </button>
          <button
            onClick={() => toast.success("Lens saved successfully")}
            className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <Play className="h-3.5 w-3.5" />
            Save This Lens
          </button>
        </div>
      </div>
    </div>
  );
}
