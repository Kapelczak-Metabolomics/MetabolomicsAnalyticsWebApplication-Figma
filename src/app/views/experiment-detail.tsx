import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChartPlaceholder } from "../components/chart-placeholder";
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/auth-context";
import type { PCAScore } from "../components/plots/pca-plot";
import type { VolcanoPoint } from "../components/plots/volcano-plot";
import type { DendrogramMerge } from "../components/plots/dendrogram-plot";

export function ExperimentDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [exp, setExp] = useState<Record<string, unknown> | null>(null);
  const [heatmap, setHeatmap] = useState<{ matrix: (number | null)[][]; sampleLabels: string[]; featureLabels: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getExperiment(parseInt(id, 10))
      .then(setExp)
      .catch(() => navigate("/projects"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const datasetId = exp?.datasetId as number | undefined;
  const type = String(exp?.type ?? "");
  const results = exp?.results as Record<string, unknown> | null;

  useEffect(() => {
    if (type !== "Clustering" || !datasetId) return;
    api.getDatasetMatrix(datasetId, true).then(setHeatmap).catch(() => setHeatmap(null));
  }, [type, datasetId]);

  if (loading || !exp) {
    return <div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const status = String(exp.status);
  const canDelete = Boolean(exp.canDelete) || isAdmin;
  const StatusIcon = status === "completed" ? CheckCircle2 : status === "running" ? Loader2 : AlertCircle;
  const statusColor = status === "completed" ? "text-emerald-500" : status === "running" ? "text-amber-500 animate-spin" : "text-destructive";

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm(`Delete analysis run "${String(exp.name)}"? This cannot be undone.`)) return;
    try {
      if (isAdmin && (status === "running" || status === "pending")) {
        await api.admin.deleteRun(parseInt(id, 10));
      } else {
        await api.deleteExperiment(parseInt(id, 10));
      }
      toast.success("Analysis run deleted");
      navigate("/projects");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete run");
    }
  }

  const chartProps = {
    pcaScores: type === "PCA" ? (results?.scores as PCAScore[]) : undefined,
    explainedVariance: type === "PCA" ? (results?.explainedVariance as number[]) : undefined,
    volcanoFeatures: type === "Volcano" ? (results?.features as VolcanoPoint[]) : undefined,
    plsdaScores: type === "PLS-DA" ? (results?.scores as Array<{ comp1: number; comp2: number; group: string }>) : undefined,
    vipFeatures: type === "PLS-DA" ? (results?.vipFeatures as Array<{ name: string; vip: number }>) : undefined,
    permScores: type === "PLS-DA" ? (results?.permScores as Array<{ iteration: number; r2: number; q2: number }>) : undefined,
    observedR2: type === "PLS-DA" ? (results?.r2 as number) : undefined,
    observedQ2: type === "PLS-DA" ? (results?.q2 as number) : undefined,
    pathways: type === "Pathway" ? (results?.pathways as Array<{ name: string; genes: number; negLogP?: number }>) : undefined,
    heatmap: type === "Clustering" && heatmap ? heatmap : undefined,
    heatmapOrientation: type === "Clustering"
      ? ((results?.config as { heatmapOrientation?: "samples-y" | "samples-x" })?.heatmapOrientation ?? "samples-y")
      : undefined,
    dendrogram: type === "Clustering" ? (results?.dendrogram as DendrogramMerge[]) : undefined,
    dendrogramLabels: type === "Clustering" ? ((results?.sampleOrder as string[]) ?? heatmap?.sampleLabels) : undefined,
    silhouette: type === "Clustering" ? (results?.silhouette as number) : undefined,
    biomarkerCandidates: type === "Biomarker" ? (results?.candidates as Array<{ name: string; score: number; log2fc: number; pValue: number }>) : undefined,
  };

  const chartType =
    type === "PCA" ? "PCA Score Plot"
    : type === "Volcano" ? "Volcano Plot"
    : type === "PLS-DA" ? "PLS-DA Score Plot"
    : type === "Pathway" ? "Pathway Enrichment"
    : type === "Clustering" ? "Clustered Heatmap"
    : type === "Biomarker" ? "Biomarker Discovery Plot"
    : `${type} Plot`;

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{String(exp.name)}</h2>
            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
            <span className="text-xs capitalize text-muted-foreground">{status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{String(exp.projectName)} · {String(exp.datasetName ?? "—")}</p>
          {exp.errorMessage && <p className="text-sm text-destructive mt-2">{String(exp.errorMessage)}</p>}
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete run
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Samples</p><p className="text-lg font-semibold">{String(exp.samplesCount ?? "—")}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Features</p><p className="text-lg font-semibold">{String(exp.featuresCount ?? "—")}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Duration</p><p className="text-lg font-semibold">{String(exp.duration ?? "—")}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Run by</p><p className="text-lg font-semibold">{String(exp.userName ?? "—")}</p></div>
      </div>

      {status === "completed" && results && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm mb-3">Primary Result</h3>
            <ChartPlaceholder type={chartType} height="420px" {...chartProps} />
          </div>
          {type === "PLS-DA" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm mb-3">VIP Scores</h3>
                <ChartPlaceholder type="Variable Importance in Projection" height="280px" vipFeatures={chartProps.vipFeatures} />
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm mb-3">Permutation Test</h3>
                <ChartPlaceholder type="Model Validation" height="280px" permScores={chartProps.permScores} observedR2={chartProps.observedR2} observedQ2={chartProps.observedQ2} />
              </div>
            </div>
          )}
          {type === "Clustering" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm mb-3">Sample Dendrogram</h3>
                <ChartPlaceholder type="Hierarchical Tree" height="280px" dendrogram={chartProps.dendrogram} dendrogramLabels={chartProps.dendrogramLabels} />
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm mb-3">Cluster Quality</h3>
                <ChartPlaceholder type="Cluster Quality" height="280px" silhouette={chartProps.silhouette} />
              </div>
            </div>
          )}
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
