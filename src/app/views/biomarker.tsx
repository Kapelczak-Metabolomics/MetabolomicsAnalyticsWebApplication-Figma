import { useEffect, useMemo, useState } from "react";
import { Play, Settings2, Filter, Plus, Trash2, X } from "lucide-react";
import { ConfigureDialog } from "../components/configure-dialog";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { AnalysisExportMenu } from "../components/analysis-export-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { useAnalysisPage } from "../../hooks/use-analysis-page";
import { useApp } from "../../contexts/app-context";
import { biomarkerConfig } from "../../lib/analysis-config";
import { api } from "../../lib/api";

interface Criterion {
  id: number;
  name: string;
  operator: string;
  value: string;
}

interface Lens {
  id: number;
  name: string;
  criteria: Criterion[];
  weights?: Record<string, number>;
}

function CriteriaEditor({ open, onClose, criteria, onSave }: {
  open: boolean; onClose: () => void; criteria: Criterion[];
  onSave: (criteria: Criterion[]) => void;
}) {
  const [local, setLocal] = useState(criteria);

  useEffect(() => { if (open) setLocal(criteria); }, [open, criteria]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">Edit Filtering Criteria</Dialog.Title>
            <Dialog.Close asChild><button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button></Dialog.Close>
          </div>
          <div className="overflow-auto max-h-[calc(85vh-130px)] p-5 space-y-3">
            {local.map((criterion, idx) => (
              <div key={criterion.id} className="flex items-center gap-2 rounded-lg border border-border bg-background p-3">
                <div className="flex h-5 w-5 items-center justify-center rounded text-xs text-muted-foreground bg-muted">{idx + 1}</div>
                <input value={criterion.name} onChange={(e) => setLocal((p) => p.map((c) => c.id === criterion.id ? { ...c, name: e.target.value } : c))}
                  className="flex-1 min-w-0 rounded border border-border bg-card px-2 py-1 text-xs outline-none" />
                <select value={criterion.operator} onChange={(e) => setLocal((p) => p.map((c) => c.id === criterion.id ? { ...c, operator: e.target.value } : c))}
                  className="rounded border border-border bg-card px-2 py-1 text-xs outline-none">
                  {[">", "<", "≥", "≤", "=", "In", "Not In"].map((op) => <option key={op}>{op}</option>)}
                </select>
                <input value={criterion.value} onChange={(e) => setLocal((p) => p.map((c) => c.id === criterion.id ? { ...c, value: e.target.value } : c))}
                  className="w-32 rounded border border-border bg-card px-2 py-1 text-xs outline-none" />
                <button onClick={() => setLocal((p) => p.filter((c) => c.id !== criterion.id))}
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button onClick={() => setLocal((p) => [...p, { id: Date.now(), name: "New Criterion", operator: ">", value: "0" }])}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:border-primary/50">
              <Plus className="h-3.5 w-3.5" /> Add criterion
            </button>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
            <button onClick={() => { onSave(local); onClose(); toast.success("Criteria updated"); }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">Save Criteria</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const defaultCriteria: Criterion[] = [
  { id: 1, name: "Fold Change", operator: "≥", value: "0.58" },
  { id: 2, name: "Statistical Significance", operator: "<", value: "0.05" },
  { id: 3, name: "VIP Score", operator: ">", value: "1.0" },
];

export function BiomarkerView() {
  const [configOpen, setConfigOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>(defaultCriteria);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [sortBy, setSortBy] = useState("score");
  const { saveAnalysisConfig, getAnalysisConfig } = useApp();
  const { dataset, results, loading, error, refresh, experimentId } = useAnalysisPage("Biomarker");

  const allCandidates = (results?.candidates as Array<{
    name: string; featureId: string; score: number; log2fc: number; pValue: number; vip: number; pathway?: string; literatureScore?: number;
  }>) ?? [];

  useEffect(() => {
    api.getLenses().then((data) => setLenses(data.map((l) => ({
      id: l.id,
      name: l.name,
      criteria: (l.criteria as Criterion[]) ?? defaultCriteria,
      weights: l.weights as Record<string, number> | undefined,
    })))).catch(console.error);
  }, []);

  const candidates = useMemo(() => {
    const sorted = [...allCandidates];
    if (sortBy === "log2fc") sorted.sort((a, b) => Math.abs(b.log2fc) - Math.abs(a.log2fc));
    else if (sortBy === "pValue") sorted.sort((a, b) => a.pValue - b.pValue);
    else if (sortBy === "vip") sorted.sort((a, b) => b.vip - a.vip);
    else sorted.sort((a, b) => b.score - a.score);
    return sorted;
  }, [allCandidates, sortBy]);

  const config = getAnalysisConfig("Biomarker");
  const weights = [
    { label: "Fold Change", value: `${config.weightFoldChange ?? 30}%`, pct: Number(config.weightFoldChange ?? 30), color: "bg-violet-500" },
    { label: "p-value", value: `${config.weightPValue ?? 25}%`, pct: Number(config.weightPValue ?? 25), color: "bg-cyan-500" },
    { label: "VIP Score", value: `${config.weightVip ?? 25}%`, pct: Number(config.weightVip ?? 25), color: "bg-emerald-500" },
    { label: "Literature", value: `${config.weightLiterature ?? 20}%`, pct: Number(config.weightLiterature ?? 20), color: "bg-amber-500" },
  ];

  async function saveLens() {
    const name = prompt("Lens name:");
    if (!name?.trim()) return;
    try {
      const { id } = await api.saveLens({ name: name.trim(), criteria, weights: config });
      setLenses((prev) => [{ id, name: name.trim(), criteria, weights: config }, ...prev]);
      toast.success("Lens saved successfully");
    } catch {
      toast.error("Failed to save lens");
    }
  }

  function loadLens(lens: Lens) {
    setCriteria(lens.criteria);
    if (lens.weights) saveAnalysisConfig("Biomarker", lens.weights);
    toast.success(`Loaded lens: ${lens.name}`);
  }

  async function addToWatchlist(feature: { name: string; featureId: string }) {
    try {
      await api.addToWatchlist({ featureName: feature.name, featureId: feature.featureId, datasetId: dataset?.id });
      toast.success(`Added ${feature.name} to watchlist`);
    } catch {
      toast.error("Failed to add to watchlist");
    }
  }

  function biomarkerRunConfig() {
    const base = getAnalysisConfig("Biomarker");
    const fcCrit = criteria.find((c) => /fold/i.test(c.name));
    const pCrit = criteria.find((c) => /significance|p-value|p value/i.test(c.name));
    const vipCrit = criteria.find((c) => /vip/i.test(c.name));
    return {
      ...base,
      minFoldChange: fcCrit ? parseFloat(fcCrit.value) || base.minFoldChange : base.minFoldChange,
      maxPValue: pCrit ? parseFloat(pCrit.value) || base.maxPValue : base.maxPValue,
      minVip: vipCrit ? parseFloat(vipCrit.value) || base.minVip : base.minVip,
    };
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="flex h-full">
      <RunAnalysisDialog open={runOpen} onClose={() => { setRunOpen(false); refresh(); }} analysisName="Biomarker Discovery" analysisType="Biomarker"
        projectId={dataset?.project_id} datasetId={dataset?.id} config={biomarkerRunConfig()} onComplete={refresh} />
      <ConfigureDialog open={configOpen} onClose={() => setConfigOpen(false)} title="Configure Biomarker Lenses"
        groups={biomarkerConfig} initialValues={config} onSave={(c) => saveAnalysisConfig("Biomarker", c)} />
      <CriteriaEditor open={criteriaOpen} onClose={() => setCriteriaOpen(false)} criteria={criteria} onSave={(next) => {
        setCriteria(next);
        saveAnalysisConfig("Biomarker", { ...getAnalysisConfig("Biomarker"), criteria: next });
      }} />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Biomarker Lenses</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{dataset ? `${dataset.project_name} · ${dataset.name}` : "No dataset"}</p>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCriteriaOpen(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Filter className="h-3.5 w-3.5" /> Edit Criteria
            </button>
            <button onClick={() => setConfigOpen(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Settings2 className="h-3.5 w-3.5" /> Configure
            </button>
            <button onClick={() => setRunOpen(true)} disabled={!dataset} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Play className="h-3.5 w-3.5" /> Run Discovery
            </button>
            <AnalysisExportMenu experimentId={experimentId} results={results} analysisType="Biomarker" filename="biomarker-candidates" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Candidates</p><p className="mt-1 text-xl tabular-nums">{candidates.length}</p></div>
          <div className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Significant (p&lt;0.05)</p><p className="mt-1 text-xl tabular-nums">{candidates.filter((c) => c.pValue < 0.05).length}</p></div>
          <div className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">High VIP (&gt;1.5)</p><p className="mt-1 text-xl tabular-nums">{candidates.filter((c) => c.vip > 1.5).length}</p></div>
          <div className="rounded-md border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Top Score</p><p className="mt-1 text-xl tabular-nums">{candidates[0]?.score.toFixed(1) ?? "—"}</p></div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Active Filtering Criteria</h3>
            <button onClick={() => setCriteriaOpen(true)} className="text-xs text-primary hover:underline">Edit</button>
          </div>
          <div className="space-y-2">
            {criteria.map((criterion) => (
              <div key={criterion.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>{criterion.name}</span>
                  <span className="text-muted-foreground">{criterion.operator} {criterion.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Candidate Overview</h3>
            <AnalysisExportMenu experimentId={experimentId} results={results} analysisType="Biomarker" filename="biomarker-plot" plotContainerId="plot-biomarker-main" />
          </div>
          <ChartPlaceholder type="Biomarker Discovery Plot" height="400px" exportId="plot-biomarker-main" biomarkerCandidates={candidates} />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm">Biomarker Candidates</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sort by:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded border border-border bg-background px-2 py-1">
                <option value="score">Priority Score</option>
                <option value="log2fc">Fold Change</option>
                <option value="pValue">p-value</option>
                <option value="vip">VIP Score</option>
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
                  <th className="p-2 text-center font-medium">Lit.</th>
                  <th className="p-2 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Run biomarker discovery to see candidates</td></tr>
                ) : candidates.map((feature) => (
                  <tr key={feature.featureId} className="border-b border-border hover:bg-muted/50">
                    <td className="p-2 font-medium">{feature.name}</td>
                    <td className="p-2 text-right tabular-nums">{feature.log2fc.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums">{feature.pValue.toExponential(1)}</td>
                    <td className="p-2 text-right tabular-nums">{feature.vip.toFixed(2)}</td>
                    <td className="p-2 text-right"><span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 tabular-nums text-primary">{feature.score}</span></td>
                    <td className="p-2 text-muted-foreground">{feature.pathway ?? "—"}</td>
                    <td className="p-2 text-center tabular-nums text-muted-foreground">{feature.literatureScore != null ? feature.literatureScore.toFixed(2) : "—"}</td>
                    <td className="p-2 text-center">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild><button className="rounded px-1.5 py-0.5 text-xs hover:bg-accent">•••</button></DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className="z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
                            <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                              onSelect={() => addToWatchlist(feature)}>Add to watchlist</DropdownMenu.Item>
                            <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                              onSelect={() => window.open(`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(feature.name)}`, "_blank")}>Search literature</DropdownMenu.Item>
                            <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                              onSelect={() => window.open(`https://hmdb.ca/metabolites/${feature.featureId}`, "_blank")}>View in HMDB</DropdownMenu.Item>
                            <DropdownMenu.Item className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                              onSelect={() => { navigator.clipboard.writeText(feature.featureId); toast.success("Feature ID copied"); }}>Copy feature ID</DropdownMenu.Item>
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
            {weights.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between mb-1"><span className="text-muted-foreground">{item.label}</span><span className="tabular-nums">{item.value}</span></div>
                <div className="h-1 rounded-full bg-muted"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Saved Lenses</h3>
          <div className="space-y-1.5">
            {lenses.length === 0 ? <p className="text-xs text-muted-foreground">No saved lenses yet</p> : lenses.map((lens) => (
              <button key={lens.id} onClick={() => loadLens(lens)} className="w-full rounded-md bg-card p-2 text-left text-xs hover:bg-accent">{lens.name}</button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border space-y-1.5">
          <button onClick={() => setCriteriaOpen(true)} className="w-full flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent">
            <Filter className="h-3.5 w-3.5" /> Edit Criteria
          </button>
          <button onClick={saveLens} className="w-full flex items-center justify-center gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20">
            <Play className="h-3.5 w-3.5" /> Save This Lens
          </button>
        </div>
      </div>
    </div>
  );
}
