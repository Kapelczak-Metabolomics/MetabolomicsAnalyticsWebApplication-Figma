import { useEffect, useState } from "react";
import { KPICard } from "../components/kpi-card";
import { AnalysisCard } from "../components/analysis-card";
import {
  Beaker,
  Users,
  Flame,
  TrendingUp,
  ScatterChart,
  Network,
  Route,
  Target,
} from "lucide-react";
import { api } from "../../lib/api";

const analysisDescriptions: Record<string, { description: string; icon: typeof ScatterChart }> = {
  PCA: { description: "Unsupervised dimensionality reduction for exploratory data analysis and pattern discovery", icon: ScatterChart },
  "PLS-DA": { description: "Supervised classification with feature selection for biomarker discovery", icon: TrendingUp },
  Volcano: { description: "Differential abundance testing with fold-change and statistical significance", icon: Flame },
  Clustering: { description: "Sample and feature grouping based on similarity metrics", icon: Network },
  Pathway: { description: "Functional annotation and over-representation analysis", icon: Route },
  Biomarker: { description: "Multi-criteria feature filtering and candidate prioritization", icon: Target },
};

export function Dashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="p-4 space-y-6 bg-gradient-to-br from-background via-background to-muted/20 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Project Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            {data?.projectName} · {data?.datasetName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">
              {data?.status === "ready" ? "Analysis Ready" : "No Data"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Metabolites"
          value={kpis?.totalMetabolites.toLocaleString() ?? "0"}
          icon={Beaker}
          change="From active dataset"
          changeType="neutral"
        />
        <KPICard
          title="Samples Analyzed"
          value={kpis?.samplesAnalyzed.toLocaleString() ?? "0"}
          icon={Users}
          change={data?.status === "ready" ? "Dataset ready" : "Import data to begin"}
          changeType="neutral"
        />
        <KPICard
          title="Significant Features"
          value={kpis?.significantFeatures.toLocaleString() ?? "0"}
          icon={Flame}
          change="p < 0.05, FDR adjusted"
          changeType="neutral"
        />
        <KPICard
          title="Model Accuracy"
          value={`${kpis?.modelAccuracy ?? 0}%`}
          icon={TrendingUp}
          change="From latest PLS-DA"
          changeType="positive"
        />
      </div>

      <div>
        <h3 className="text-sm mb-3">Recent Analyses</h3>
        <div className="grid grid-cols-2 gap-3">
          {(data?.recentAnalyses ?? []).map((analysis) => {
            const meta = analysisDescriptions[analysis.type] ?? analysisDescriptions.PCA;
            return (
              <AnalysisCard
                key={analysis.type}
                title={analysis.title}
                description={meta.description}
                icon={meta.icon}
                href={analysis.href}
                lastRun={analysis.lastRun}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
