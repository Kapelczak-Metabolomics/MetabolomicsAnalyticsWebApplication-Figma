import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import type { PCAScore } from "../components/plots/pca-plot";
import type { VolcanoPoint } from "../components/plots/volcano-plot";

export function ExperimentDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [exp, setExp] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getExperiment(parseInt(id, 10))
      .then(setExp)
      .catch(() => navigate("/projects"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading || !exp) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const results = exp.results as Record<string, unknown> | null;
  const status = String(exp.status);
  const type = String(exp.type);

  const StatusIcon = status === "completed" ? CheckCircle2 : status === "running" ? Loader2 : AlertCircle;
  const statusColor = status === "completed" ? "text-emerald-500" : status === "running" ? "text-amber-500 animate-spin" : "text-destructive";

  let chartType = `${type} Plot`;
  if (type === "PCA") chartType = "PCA Score Plot";
  if (type === "Pathway") chartType = "Pathway Enrichment";

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{String(exp.name)}</h2>
            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
            <span className="text-xs capitalize text-muted-foreground">{status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{String(exp.projectName)} · {String(exp.datasetName ?? "—")}</p>
          {exp.errorMessage && <p className="text-sm text-destructive mt-2">{String(exp.errorMessage)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Samples</p><p className="text-lg font-semibold">{String(exp.samplesCount ?? "—")}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Features</p><p className="text-lg font-semibold">{String(exp.featuresCount ?? "—")}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Duration</p><p className="text-lg font-semibold">{String(exp.duration ?? "—")}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Run by</p><p className="text-lg font-semibold">{String(exp.userName ?? "—")}</p></div>
      </div>

      {status === "completed" && results && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm mb-3">Results</h3>
          <ChartPlaceholder
            type={chartType}
            height="420px"
            pcaScores={type === "PCA" ? (results.scores as PCAScore[]) : undefined}
            explainedVariance={type === "PCA" ? (results.explainedVariance as number[]) : undefined}
            volcanoFeatures={type === "Volcano" ? (results.features as VolcanoPoint[]) : undefined}
            plsdaScores={type === "PLS-DA" ? (results.scores as Array<{ comp1: number; comp2: number; group: string }>) : undefined}
            pathways={type === "Pathway" ? (results.pathways as Array<{ name: string; genes: number; negLogP?: number }>) : undefined}
          />
        </div>
      )}

      {status === "failed" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          This experiment failed. Adjust parameters or add more samples and re-run from the analysis view.
        </div>
      )}
    </div>
  );
}
