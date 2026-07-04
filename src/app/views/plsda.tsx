import { useState } from "react";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { Play, Settings2 } from "lucide-react";
import { RunAnalysisDialog } from "../components/run-analysis-dialog";
import { ConfigureDialog } from "../components/configure-dialog";
import { AnalysisExportMenu } from "../components/analysis-export-menu";
import { useAnalysisPage } from "../../hooks/use-analysis-page";
import { useApp } from "../../contexts/app-context";
import { plsdaConfig } from "../../lib/analysis-config";

const plsdaStages = [
  "Loading dataset into memory",
  "Applying scaling & normalization",
  "Building PLS-DA model",
  "Running cross-validation (7-fold)",
  "Permutation testing (1000 iterations)",
  "Computing VIP scores",
];

export function PLSDAView() {
  const [runOpen, setRunOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { saveAnalysisConfig, getAnalysisConfig } = useApp();
  const { dataset, results, loading, error, refresh, experimentId } = useAnalysisPage("PLS-DA");

  const scores = (results?.scores as Array<{ comp1: number; comp2: number; group: string }>) ?? [];
  const vipFeatures = (results?.vipFeatures as Array<{ name: string; vip: number }>) ?? [];
  const permScores = (results?.permScores as Array<{ iteration: number; r2: number; q2: number }>) ?? [];
  const accuracy = (results?.accuracy as number) ?? 0;
  const auc = (results?.auc as number) ?? 0;
  const sensitivity = (results?.sensitivity as number) ?? 0;
  const specificity = (results?.specificity as number) ?? 0;
  const r2 = (results?.r2 as number) ?? 0;
  const q2 = (results?.q2 as number) ?? 0;
  const folds = (results?.folds as number) ?? 7;
  const samplesProcessed = (results?.samplesProcessed as number) ?? dataset?.samples_count ?? 0;

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="flex h-full">
      <RunAnalysisDialog
        open={runOpen}
        onClose={() => { setRunOpen(false); refresh(); }}
        analysisName="PLS-DA Classification"
        analysisType="PLS-DA"
        projectId={dataset?.project_id}
        datasetId={dataset?.id}
        stages={plsdaStages}
        onComplete={refresh}
      />
      <ConfigureDialog open={configOpen} onClose={() => setConfigOpen(false)} title="Configure PLS-DA" groups={plsdaConfig} initialValues={getAnalysisConfig("PLS-DA")} onSave={(c) => saveAnalysisConfig("PLS-DA", c)} />

      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Partial Least Squares - DA</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dataset ? `${dataset.project_name} · ${dataset.name}` : "No dataset"}
            </p>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
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
              disabled={!dataset}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Run Analysis
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Accuracy</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{accuracy ? `${accuracy}%` : "—"}</p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-violet-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">AUC</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-violet-600 dark:text-violet-400">{auc ? auc.toFixed(3) : "—"}</p>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-cyan-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">CV Folds</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">{folds}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-600/10 p-3">
            <p className="text-xs font-medium text-muted-foreground">Samples</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{samplesProcessed}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm">Score Plot (LV1 vs LV2)</h3>
            <AnalysisExportMenu experimentId={experimentId} results={results} analysisType="PLS-DA" filename="plsda" />
          </div>
          <ChartPlaceholder type="PLS-DA Score Plot" height="450px" plsdaScores={scores} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm">VIP Scores</h3>
              <AnalysisExportMenu experimentId={experimentId} results={results} analysisType="PLS-DA" filename="plsda" />
            </div>
            <ChartPlaceholder type="Variable Importance in Projection" height="280px" vipFeatures={vipFeatures} />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm">Permutation Test</h3>
              <AnalysisExportMenu experimentId={experimentId} results={results} analysisType="PLS-DA" filename="plsda" />
            </div>
            <ChartPlaceholder type="Model Validation" height="280px" permScores={permScores} />
          </div>
        </div>
      </div>

      <div className="w-64 border-l border-border bg-muted/30 p-4 space-y-4 overflow-auto">
        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Model Performance</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sensitivity</span>
              <span className="tabular-nums">{sensitivity}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Specificity</span>
              <span className="tabular-nums">{specificity}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AUC</span>
              <span className="tabular-nums">{auc.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">R²</span>
              <span className="tabular-nums">{r2.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Q²</span>
              <span className="tabular-nums">{q2.toFixed(3)}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs text-muted-foreground mb-2">Top VIP Features</h3>
          <div className="space-y-1.5">
            {(vipFeatures.length ? vipFeatures.slice(0, 5) : []).map((feature) => (
              <div key={feature.name} className="rounded-md bg-card p-2 text-xs hover:bg-accent cursor-pointer">
                <div className="flex justify-between">
                  <span>{feature.name}</span>
                  <span className="tabular-nums text-muted-foreground">{feature.vip}</span>
                </div>
              </div>
            ))}
            {!vipFeatures.length && <p className="text-xs text-muted-foreground">Run PLS-DA to see VIP features</p>}
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
