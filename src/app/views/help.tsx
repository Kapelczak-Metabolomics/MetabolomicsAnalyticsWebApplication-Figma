import { useState } from "react";
import {
  Search, BookOpen, Video, ChevronRight, ExternalLink,
  ChevronDown, ChevronUp, Beaker, ScatterChart, TrendingUp,
  Flame, Network, Route, Target, Database, Upload,
  FileText, Lightbulb, AlertTriangle, CheckCircle2, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";

// ─── Article content library ─────────────────────────────────────────────────

interface ArticleSection {
  type: "para" | "steps" | "tip" | "warning" | "code" | "table";
  heading?: string;
  text?: string;
  items?: string[];
  rows?: [string, string][];
  code?: string;
}

interface Article {
  id: string;
  title: string;
  category: string;
  readTime: string;
  sections: ArticleSection[];
}

const articles: Record<string, Article> = {
  "import-dataset": {
    id: "import-dataset", title: "Importing Your First Dataset", category: "Getting Started", readTime: "5 min read",
    sections: [
      { type: "para", text: "MetaboAnalytics accepts metabolomics data in several formats. The most common is a sample × feature matrix where rows are samples and columns are metabolite features, with an additional metadata column identifying the sample group." },
      { type: "steps", heading: "Step-by-step import", items: [
        "Navigate to Data Table → click Import Dataset (or go directly to /data/import).",
        "Drag your file onto the upload zone, or click Browse Files to select it from disk.",
        "On the Map Columns screen, confirm that the sample ID column, group/class column, and any covariates (age, sex, batch) are correctly mapped.",
        "Review the Validation Results — warnings about missing values or low-detection features are normal and can be handled during analysis.",
        "Give your dataset a descriptive name and assign it to a project, then click Import Dataset.",
      ]},
      { type: "tip", text: "For the cleanest import, pre-format your CSV so that column 1 is a unique sample identifier, column 2 is the group label, and columns 3 onward are metabolite intensities. Headers in row 1." },
      { type: "table", heading: "Supported file formats", rows: [
        ["CSV / TSV", "Comma- or tab-separated matrix. Most common for processed data."],
        ["Excel (.xlsx)", "Workbook with data on the first sheet."],
        ["mzML / mzXML", "Raw mass-spectrometry data; features are extracted automatically."],
        ["Metabolon export", "Direct export from Metabolon CDT — auto-mapped."],
      ]},
      { type: "warning", text: "Files larger than 500 MB may time out on slower connections. Split very large datasets by batch and import each separately, then merge inside the platform." },
    ],
  },
  "sample-groups": {
    id: "sample-groups", title: "Sample Groups and Lenses", category: "Getting Started", readTime: "3 min read",
    sections: [
      { type: "para", text: "A Lens defines which comparison is active — for example 'AD vs Control' or 'Treatment vs Placebo'. Every analysis runs within the active lens context, so changing the lens instantly re-scopes all visualisations." },
      { type: "steps", heading: "Creating a lens", items: [
        "Open the Lens dropdown in the top bar and choose the active comparison.",
        "To create a new lens, go to Project Settings → Lenses → Add Lens.",
        "Assign sample groups from your metadata: each group maps to one arm of the comparison.",
        "Multi-class lenses (3+ groups) are supported by PLS-DA and Clustering.",
      ]},
      { type: "tip", text: "Give lenses descriptive names like 'Early AD vs MCI vs Control' rather than 'Lens 3'. All exported figures and reports inherit the lens name." },
    ],
  },
  "first-analysis": {
    id: "first-analysis", title: "Running Your First Analysis", category: "Getting Started", readTime: "4 min read",
    sections: [
      { type: "para", text: "Start with PCA to get an unsupervised overview of your data before committing to a supervised method. PCA will reveal whether your groups separate naturally, flag outliers, and expose batch effects." },
      { type: "steps", heading: "Quick start", items: [
        "Select your project and dataset in the top bar.",
        "Set the active lens (comparison) you want to investigate.",
        "Click PCA in the sidebar.",
        "Review the default settings (Pareto scaling, KNN imputation) — these are sensible for most LC-MS data.",
        "Click Run Analysis and wait ~30 seconds for the score plot to render.",
        "If groups cluster apart on PC1/PC2 you have a strong signal. If they overlap, check for batch effects before proceeding.",
      ]},
      { type: "tip", text: "A total explained variance below 40% on PC1+PC2 is common and not a problem — it simply means the data is high-dimensional. Look at the shape of the clusters, not just the % variance." },
    ],
  },
  "pca-guide": {
    id: "pca-guide", title: "PCA — Principal Component Analysis", category: "Analysis Modules", readTime: "8 min read",
    sections: [
      { type: "para", text: "Principal Component Analysis (PCA) is an unsupervised dimensionality-reduction technique. It transforms the original feature space into a set of orthogonal components ordered by decreasing variance, allowing you to visualise high-dimensional data in 2D or 3D." },
      { type: "steps", heading: "Interpreting the score plot", items: [
        "Each point is one sample. Points that are close together are metabolically similar.",
        "Tight, separated clusters indicate a strong group effect.",
        "Outliers appear far from the main cloud — investigate before excluding them.",
        "Ellipses show the 95% confidence region for each group under a multivariate normal assumption.",
      ]},
      { type: "table", heading: "Key output metrics", rows: [
        ["PC1 Variance", "Fraction of total variance explained by the first component. Higher = stronger single driver."],
        ["PC2 Variance", "Same for the second component."],
        ["Total Explained", "Sum for all plotted components — aim for >50% for a meaningful 2D view."],
        ["Hotelling T²", "Multivariate distance from the centroid — used for outlier detection."],
        ["Q-residuals", "Variation not captured by the model — high Q indicates a sample doesn't fit the structure."],
      ]},
      { type: "steps", heading: "Scaling options", items: [
        "Pareto: divides each variable by the square root of its standard deviation. Good balance between emphasising signal and avoiding noise amplification. Recommended default.",
        "Auto (UV): divides by the standard deviation. All variables get equal weight. Use when you want to eliminate the effect of concentration differences.",
        "Range: divides by (max – min). Useful for data with natural range differences.",
        "None: raw intensities. Only use if data is already pre-scaled.",
      ]},
      { type: "tip", text: "If you see a strong batch effect (samples from the same batch cluster together rather than by group), apply batch correction under Dataset Settings before re-running PCA." },
    ],
  },
  "plsda-guide": {
    id: "plsda-guide", title: "PLS-DA — Supervised Classification", category: "Analysis Modules", readTime: "10 min read",
    sections: [
      { type: "para", text: "Partial Least Squares Discriminant Analysis (PLS-DA) is a supervised method that finds the linear combination of features maximising the separation between predefined groups. Unlike PCA, it uses class labels during model fitting, making it more powerful for biomarker discovery but also more prone to overfitting." },
      { type: "warning", text: "Always validate a PLS-DA model with cross-validation (Q²) and permutation testing before reporting results. A high R² with a low Q² or non-significant permutation p-value indicates overfitting." },
      { type: "table", heading: "Performance metrics explained", rows: [
        ["Accuracy", "Correct classifications / total samples in cross-validation."],
        ["R² (cumulative)", "Variance in Y (class labels) explained by the model. Should be high."],
        ["Q² (CV)", "Cross-validated R². Must be close to R² to avoid overfitting."],
        ["AUC", "Area under the ROC curve. >0.9 = excellent, 0.7–0.9 = good, <0.7 = poor."],
        ["Permutation p", "Fraction of permuted models that score ≥ the real model. p < 0.05 is significant."],
      ]},
      { type: "steps", heading: "Selecting the number of components", items: [
        "Start with 2 components and look at Q².",
        "Add components while Q² keeps increasing.",
        "Stop when Q² starts to decrease — that is your optimal component count.",
        "Typical metabolomics datasets rarely need more than 5 components.",
      ]},
      { type: "steps", heading: "Using VIP scores for feature selection", items: [
        "VIP (Variable Importance in Projection) > 1.0 is the standard threshold for discriminant features.",
        "Features with VIP > 1.5 are strong candidates for follow-up.",
        "Combine VIP with fold-change and p-value from Volcano analysis for the most credible biomarker shortlist.",
      ]},
    ],
  },
  "volcano-guide": {
    id: "volcano-guide", title: "Volcano Plot — Differential Abundance", category: "Analysis Modules", readTime: "6 min read",
    sections: [
      { type: "para", text: "A Volcano plot simultaneously displays fold-change (x-axis) and statistical significance (y-axis: −log₁₀ p-value). Features in the upper-left and upper-right corners are both statistically significant and biologically meaningful." },
      { type: "steps", heading: "Setting thresholds", items: [
        "log₂ Fold Change cutoff: ±1.0 is conservative, ±1.5 moderate, ±2.0 stringent. Choose based on biological relevance.",
        "p-value cutoff: 0.05 is standard. Always apply multiple-testing correction.",
        "Multiple-testing correction: BH (FDR) is recommended for metabolomics. Bonferroni is very conservative and often too strict when testing 1000+ features.",
      ]},
      { type: "table", heading: "Statistical test comparison", rows: [
        ["t-test", "Two-group comparison of means. Assumes normality and equal/unequal variance."],
        ["Wilcoxon", "Non-parametric alternative. Use for small n or heavy tails."],
        ["ANOVA + Tukey", "Multiple groups. Use Tukey HSD for post-hoc pairwise tests."],
        ["Limma", "Borrows variance information across features — more stable for small n."],
      ]},
      { type: "tip", text: "Click any point on the volcano plot to see the metabolite name, fold-change, and p-value. Shift-click to select multiple points and add them to the Biomarker Lenses watchlist." },
    ],
  },
  "clustering-guide": {
    id: "clustering-guide", title: "Hierarchical Clustering", category: "Analysis Modules", readTime: "5 min read",
    sections: [
      { type: "para", text: "Hierarchical clustering groups samples and/or features by similarity, producing a dendrogram that can be cut at different heights to define clusters. The heatmap shows the intensity matrix after clustering both rows and columns." },
      { type: "table", heading: "Distance metrics", rows: [
        ["Euclidean", "Straight-line distance. Sensitive to scale — always normalise first."],
        ["Pearson correlation", "Measures pattern similarity regardless of magnitude. Best for expression-like data."],
        ["Spearman correlation", "Rank-based Pearson. More robust to outliers."],
        ["Manhattan", "Sum of absolute differences. Less sensitive to large outliers than Euclidean."],
      ]},
      { type: "table", heading: "Linkage methods", rows: [
        ["Ward", "Minimises within-cluster variance. Usually produces compact, equal-sized clusters. Recommended default."],
        ["Average (UPGMA)", "Uses mean distance between all pairs. Good for irregular shapes."],
        ["Complete", "Uses maximum distance. Tends to produce tight, spherical clusters."],
        ["Single", "Uses minimum distance. Can produce chaining artefacts — generally avoid."],
      ]},
      { type: "tip", text: "Silhouette score > 0.5 indicates well-separated clusters. Davies–Bouldin < 0.5 is excellent. If quality metrics are poor, try a different number of clusters or switch from hierarchical to k-means." },
    ],
  },
  "pathway-guide": {
    id: "pathway-guide", title: "Pathway Enrichment Analysis", category: "Analysis Modules", readTime: "7 min read",
    sections: [
      { type: "para", text: "Pathway enrichment analysis asks whether your significant metabolites are enriched in particular metabolic pathways beyond what would be expected by chance. This provides biological context for your statistical hits." },
      { type: "steps", heading: "How the hypergeometric test works", items: [
        "Your input is the list of significant metabolites (the 'hit list').",
        "The background is all metabolites detected in your experiment.",
        "For each pathway, the test calculates the probability of observing ≥ k hits given the pathway size and hit list size.",
        "Pathways with a low p-value (and low FDR) are considered enriched.",
      ]},
      { type: "table", heading: "Database comparison", rows: [
        ["KEGG", "Most comprehensive for metabolic pathways. Best for standard metabolites."],
        ["Reactome", "Detailed reaction-level annotation. Good for lipids and signalling."],
        ["MetaCyc", "Curated biochemical pathways. High quality, slightly narrower coverage."],
        ["GO Biological Process", "Gene Ontology terms — useful for integrating with transcriptomics."],
      ]},
      { type: "warning", text: "Pathway enrichment is only as good as your metabolite ID mapping. Ensure your features are correctly annotated to HMDB or KEGG IDs before running enrichment — unmatched features are silently excluded." },
    ],
  },
  "biomarker-guide": {
    id: "biomarker-guide", title: "Biomarker Lenses — Multi-criteria Filtering", category: "Analysis Modules", readTime: "6 min read",
    sections: [
      { type: "para", text: "Biomarker Lenses applies a configurable set of filters simultaneously across all features to produce a shortlist of high-priority candidates. Unlike running each analysis separately, lenses combine statistical, metabolic, and literature evidence into a single ranked list." },
      { type: "steps", heading: "Building a lens", items: [
        "Click Edit Criteria to open the criteria editor.",
        "Add a criterion for each dimension you care about: fold-change, p-value, VIP score, detection frequency, pathway membership.",
        "Set the operator (>, <, ≥, ≤, In, Not In) and the threshold value.",
        "Features must pass ALL criteria to appear in the candidate list.",
        "Save the lens with a descriptive name — you can recall it any time.",
      ]},
      { type: "tip", text: "Start permissive (VIP > 1.0, FC ≥ 1.5, p < 0.05) and tighten thresholds iteratively until you have 20–50 candidates. Fewer than 10 may indicate overly strict criteria; more than 100 usually needs further refinement." },
      { type: "steps", heading: "Priority scoring weights", items: [
        "Fold Change (30%): magnitude of the biological effect.",
        "Statistical significance (25%): p-value and FDR.",
        "VIP score (25%): importance in the PLS-DA classification model.",
        "Literature support (20%): PubMed citation count for the metabolite + disease pair.",
      ]},
    ],
  },
  "missing-values": {
    id: "missing-values", title: "Missing Values and QC Filtering", category: "Data Management", readTime: "5 min read",
    sections: [
      { type: "para", text: "Missing values in metabolomics arise from two sources: (1) the metabolite was truly absent or below the limit of detection, or (2) a technical failure during acquisition. These require different handling strategies." },
      { type: "table", heading: "Imputation methods", rows: [
        ["KNN (k-nearest neighbours)", "Imputes from the k most similar samples. Recommended for random missingness (<20%)."],
        ["Half-minimum", "Replaces with half the minimum detected value. Appropriate for below-detection missingness."],
        ["Median", "Per-feature median. Fast and robust but ignores sample-to-sample correlation."],
        ["BPCA", "Bayesian PCA imputation. Best quality for structured missing data but slow."],
        ["Remove feature", "Exclude features missing in >20% of samples. Safest when in doubt."],
      ]},
      { type: "warning", text: "Imputing more than 20% of values in a feature introduces substantial uncertainty. It is usually better to filter those features out entirely rather than impute." },
      { type: "steps", heading: "QC workflow", items: [
        "Remove features detected in <80% of samples within at least one group (detection frequency filter).",
        "Remove samples with >50% missing features (sample QC).",
        "Apply half-minimum imputation for values remaining below detection threshold.",
        "Apply KNN imputation for any remaining random missing values.",
        "Log-transform and scale before analysis.",
      ]},
    ],
  },
  "batch-correction": {
    id: "batch-correction", title: "Batch Effect Correction", category: "Data Management", readTime: "6 min read",
    sections: [
      { type: "para", text: "Batch effects are systematic non-biological differences between groups of samples processed at different times or in different laboratories. They are one of the most common sources of false positives in metabolomics." },
      { type: "steps", heading: "Detecting batch effects", items: [
        "Run PCA and colour samples by batch. If samples cluster by batch more than by biological group, there is a significant batch effect.",
        "Check the RSD (relative standard deviation) of QC samples across the run. RSD > 20% on QC samples indicates drift.",
        "Box plots of total ion current per sample should be roughly aligned across batches.",
      ]},
      { type: "table", heading: "Correction methods", rows: [
        ["ComBat", "Empirical Bayes method. Robust for large datasets with known batch labels."],
        ["LOESS/QC-RSC", "Signal intensity correction using pooled QC samples. Corrects run-order drift."],
        ["Limma removeBatchEffect", "Linear model approach. Good when batches are balanced across groups."],
        ["Median centering", "Simple per-batch median centering. Quick but less accurate."],
      ]},
      { type: "warning", text: "Never correct for batch and then test the same batch variable for significance — this will inflate false positives. Include batch as a covariate in your statistical model instead." },
    ],
  },
  "export-reports": {
    id: "export-reports", title: "Exporting Figures and Reports", category: "Getting Started", readTime: "3 min read",
    sections: [
      { type: "para", text: "Every figure in MetaboAnalytics can be exported at publication quality. Use the Export dropdown on any chart panel." },
      { type: "table", heading: "Export formats", rows: [
        ["PNG (high-res)", "300 DPI raster image. Suitable for journal submissions."],
        ["SVG (vector)", "Infinitely scalable vector. Best for editing in Illustrator or Inkscape."],
        ["PDF", "Vector PDF. Ideal for slide decks and reports."],
        ["CSV (data)", "Raw underlying data for the plot. Import into R/Python for custom visualisations."],
      ]},
      { type: "tip", text: "For a complete project report, go to Experiment Detail → Export → Full Report (PDF). This bundles all figures, statistical tables, and parameter settings into a single document." },
    ],
  },
};

// ─── Categories ───────────────────────────────────────────────────────────────

const categories = [
  {
    id: "getting-started", label: "Getting Started", icon: BookOpen, color: "text-violet-500", bg: "bg-violet-500/10",
    articles: ["import-dataset", "sample-groups", "first-analysis", "export-reports"],
  },
  {
    id: "analysis", label: "Analysis Modules", icon: Beaker, color: "text-cyan-500", bg: "bg-cyan-500/10",
    articles: ["pca-guide", "plsda-guide", "volcano-guide", "clustering-guide", "pathway-guide", "biomarker-guide"],
  },
  {
    id: "data", label: "Data Management", icon: Database, color: "text-emerald-500", bg: "bg-emerald-500/10",
    articles: ["missing-values", "batch-correction"],
  },
];

const analysisQuickLinks = [
  { id: "pca-guide", name: "PCA", icon: ScatterChart, color: "violet" },
  { id: "plsda-guide", name: "PLS-DA", icon: TrendingUp, color: "cyan" },
  { id: "volcano-guide", name: "Volcano", icon: Flame, color: "rose" },
  { id: "clustering-guide", name: "Clustering", icon: Network, color: "emerald" },
  { id: "pathway-guide", name: "Pathway", icon: Route, color: "amber" },
  { id: "biomarker-guide", name: "Biomarker", icon: Target, color: "indigo" },
];

const faqs = [
  { q: "What file formats can I import?", a: "CSV, TSV, Excel (.xlsx), mzML, and mzXML are all supported. The expected layout is samples as rows, metabolite features as columns, with group labels in a dedicated column." },
  { q: "When should I use PCA vs PLS-DA?", a: "PCA is unsupervised — use it first to see if groups separate naturally without using class labels. PLS-DA is supervised and maximises group separation; use it after PCA to identify biomarkers, and always validate with cross-validation (Q²) and permutation testing." },
  { q: "What does Q² mean in PLS-DA?", a: "Q² is the cross-validated R². It estimates how well the model predicts new, unseen data. A Q² > 0.5 indicates good predictive ability. If R² is high but Q² is much lower, the model is overfitted." },
  { q: "How is FDR correction applied?", a: "The Benjamini–Hochberg (BH) procedure is applied by default. It controls the false discovery rate — the expected proportion of false positives among all significant results. This is less conservative than Bonferroni and is appropriate when testing thousands of features simultaneously." },
  { q: "My PCA shows a batch effect — what do I do?", a: "Run batch correction before analysis. Go to Dataset Settings → Batch Correction and select ComBat (if you have batch labels) or LOESS/QC-RSC (if you have pooled QC samples). Re-run PCA afterwards to confirm the batch effect is resolved." },
  { q: "What is a Biomarker Lens?", a: "A Lens is a saved set of multi-criteria filters (fold-change, p-value, VIP score, pathway membership, literature support) applied simultaneously to rank and shortlist biomarker candidates. You can create multiple lenses for different hypotheses and switch between them instantly." },
];

// ─── Article renderer ─────────────────────────────────────────────────────────

function ArticleView({ article, onBack }: { article: Article; onBack: () => void }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-2xl px-6 py-6 space-y-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">{article.category}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{article.readTime}</span>
          </div>
          <h2 className="text-xl font-semibold">{article.title}</h2>
        </div>

        {article.sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <h3 className="text-sm font-semibold mb-2">{section.heading}</h3>
            )}

            {section.type === "para" && (
              <p className="text-sm text-muted-foreground leading-relaxed">{section.text}</p>
            )}

            {section.type === "steps" && (
              <ol className="space-y-2">
                {section.items?.map((item, j) => (
                  <li key={j} className="flex gap-3 text-sm">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{j + 1}</span>
                    <span className="text-muted-foreground leading-snug pt-0.5">{item}</span>
                  </li>
                ))}
              </ol>
            )}

            {section.type === "tip" && (
              <div className="flex gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <Lightbulb className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">{section.text}</p>
              </div>
            )}

            {section.type === "warning" && (
              <div className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{section.text}</p>
              </div>
            )}

            {section.type === "table" && section.rows && (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {section.rows.map(([label, desc], j) => (
                      <tr key={j} className="hover:bg-muted/40">
                        <td className="px-3 py-2 font-medium text-xs whitespace-nowrap w-44 align-top">{label}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground leading-relaxed">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        <div className="border-t border-border pt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Was this article helpful?</span>
          <div className="flex gap-2">
            <button onClick={() => api.submitHelpFeedback(article.id, true).then(() => toast.success("Thanks for your feedback!")).catch(() => toast.error("Failed to submit"))}
              className="flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs hover:bg-accent">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Yes
            </button>
            <button onClick={() => api.submitHelpFeedback(article.id, false).then(() => toast.info("We'll improve this article.")).catch(() => toast.error("Failed to submit"))}
              className="flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs hover:bg-accent">
              No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function HelpView() {
  const [search, setSearch] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("getting-started");

  const article = selectedArticle ? articles[selectedArticle] : null;

  const allArticleEntries = Object.values(articles);
  const searchResults = search.trim().length > 1
    ? allArticleEntries.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.category.toLowerCase().includes(search.toLowerCase()) ||
        a.sections.some((s) => s.text?.toLowerCase().includes(search.toLowerCase()) || s.items?.some((i) => i.toLowerCase().includes(search.toLowerCase())))
      )
    : [];

  const activeCat = categories.find((c) => c.id === activeCategory);

  if (article) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/20 lg:flex-row">
        {/* Left nav */}
        <div className="w-56 flex-shrink-0 border-r border-border overflow-auto p-3 space-y-1">
          {categories.map((cat) => (
            <div key={cat.id}>
              <button onClick={() => setActiveCategory(cat.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-left transition-colors ${activeCategory === cat.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                <div className={`flex h-5 w-5 items-center justify-center rounded ${cat.bg}`}><cat.icon className={`h-3 w-3 ${cat.color}`} /></div>
                {cat.label}
              </button>
              {activeCategory === cat.id && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-3">
                  {cat.articles.map((aid) => (
                    <button key={aid} onClick={() => setSelectedArticle(aid)}
                      className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors ${selectedArticle === aid ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                      <FileText className="h-3 w-3 flex-shrink-0" />
                      <span className="line-clamp-2 leading-snug">{articles[aid]?.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <ArticleView article={article} onBack={() => setSelectedArticle(null)} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero search header */}
      <div className="border-b border-border bg-card/50 px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20">
              <BookOpen className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Help & Documentation</h2>
              <p className="text-xs text-muted-foreground">Guides, references, and how-tos for MetaboAnalytics</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documentation..."
              className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 rounded-xl border border-border bg-card shadow-md overflow-hidden">
              {searchResults.map((a) => (
                <button key={a.id} onClick={() => { setSearch(""); setSelectedArticle(a.id); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 border-b border-border last:border-0">
                  <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.category} · {a.readTime}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-6 space-y-8">
        {/* Quick links — no Live Chat */}
        <div className="grid grid-cols-2 gap-3">
          <a href="https://www.youtube.com/results?search_query=metabolomics+analysis+tutorial" target="_blank" rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:shadow-md transition-shadow">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
              <Video className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Video Tutorials</p>
              <p className="text-xs text-muted-foreground">Step-by-step video walkthroughs</p>
            </div>
            <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground flex-shrink-0" />
          </a>
          <a href="https://swagger.io/docs/" target="_blank" rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:shadow-md transition-shadow">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
              <Upload className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <p className="text-sm font-medium">API Documentation</p>
              <p className="text-xs text-muted-foreground">Integrate with your pipeline</p>
            </div>
            <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground flex-shrink-0" />
          </a>
        </div>

        {/* Analysis module quick links */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Analysis Module Guides</h3>
          <div className="grid grid-cols-6 gap-2">
            {analysisQuickLinks.map((ql) => (
              <button key={ql.id} onClick={() => setSelectedArticle(ql.id)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs font-medium hover:bg-accent hover:shadow-sm transition-all">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${ql.color}-500/10`}>
                  <ql.icon className={`h-4 w-4 text-${ql.color}-500`} />
                </div>
                {ql.name}
              </button>
            ))}
          </div>
        </div>

        {/* Documentation browser */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Documentation</h3>
          <div className="grid grid-cols-[200px,1fr] gap-4 rounded-xl border border-border bg-card overflow-hidden">
            {/* Category nav */}
            <div className="border-r border-border p-2 space-y-0.5">
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-left transition-colors ${activeCategory === cat.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                  <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${cat.bg}`}><cat.icon className={`h-3 w-3 ${cat.color}`} /></div>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Article list */}
            <div className="p-4">
              {activeCat && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`flex h-6 w-6 items-center justify-center rounded ${activeCat.bg}`}>
                      <activeCat.icon className={`h-3.5 w-3.5 ${activeCat.color}`} />
                    </div>
                    <h4 className="text-sm font-semibold">{activeCat.label}</h4>
                  </div>
                  <div className="space-y-1">
                    {activeCat.articles.map((aid) => {
                      const a = articles[aid];
                      if (!a) return null;
                      return (
                        <button key={aid} onClick={() => setSelectedArticle(aid)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-muted/60 transition-colors group">
                          <div className="flex items-center gap-2.5">
                            <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{a.title}</p>
                              <p className="text-xs text-muted-foreground">{a.readTime}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Frequently Asked Questions</h3>
          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left">
                  <span className="text-sm font-medium pr-4">{faq.q}</span>
                  {openFaq === idx
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                </button>
                {openFaq === idx && (
                  <div className="border-t border-border px-4 py-3.5 text-xs text-muted-foreground leading-relaxed bg-muted/20">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
