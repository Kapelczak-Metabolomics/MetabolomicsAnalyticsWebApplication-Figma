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

export function Dashboard() {
  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Project Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            ADNI Metabolomics Study · Plasma Samples
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">
              Analysis Ready
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Total Metabolites"
          value="1,247"
          icon={Beaker}
          change="24 identified this week"
          changeType="positive"
        />
        <KPICard
          title="Samples Analyzed"
          value="342"
          icon={Users}
          change="100% complete"
          changeType="neutral"
        />
        <KPICard
          title="Significant Features"
          value="189"
          icon={Flame}
          change="p < 0.05, FDR adjusted"
          changeType="neutral"
        />
        <KPICard
          title="Model Accuracy"
          value="87.3%"
          icon={TrendingUp}
          change="+3.2% from baseline"
          changeType="positive"
        />
      </div>

      <div>
        <h3 className="text-sm mb-3">Recent Analyses</h3>
        <div className="grid grid-cols-2 gap-3">
          <AnalysisCard
            title="Principal Component Analysis"
            description="Unsupervised dimensionality reduction for exploratory data analysis and pattern discovery"
            icon={ScatterChart}
            href="/pca"
            lastRun="2 hours ago"
          />
          <AnalysisCard
            title="Partial Least Squares - DA"
            description="Supervised classification with feature selection for biomarker discovery"
            icon={TrendingUp}
            href="/plsda"
            lastRun="5 hours ago"
          />
          <AnalysisCard
            title="Volcano Plot Analysis"
            description="Differential abundance testing with fold-change and statistical significance"
            icon={Flame}
            href="/volcano"
            lastRun="1 day ago"
          />
          <AnalysisCard
            title="Hierarchical Clustering"
            description="Sample and feature grouping based on similarity metrics"
            icon={Network}
            href="/clustering"
            lastRun="1 day ago"
          />
          <AnalysisCard
            title="Pathway Enrichment"
            description="Functional annotation and over-representation analysis"
            icon={Route}
            href="/pathway"
            lastRun="3 days ago"
          />
          <AnalysisCard
            title="Biomarker Lenses"
            description="Multi-criteria feature filtering and candidate prioritization"
            icon={Target}
            href="/biomarker"
            lastRun="1 week ago"
          />
        </div>
      </div>
    </div>
  );
}
