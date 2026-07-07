/** Shared analysis configuration field definitions with stable keys for API/engine. */

export const pcaConfig = [
  {
    title: "Preprocessing",
    fields: [
      { key: "scalingMethod", label: "Scaling Method", type: "select" as const, value: "Pareto", options: ["Pareto", "Auto", "Range", "None"] },
      { key: "imputation", label: "Missing Value Imputation", type: "select" as const, value: "KNN", options: ["KNN", "Half-minimum", "Median", "None"] },
      { key: "logTransform", label: "Log Transformation", type: "checkbox" as const, value: true },
      { key: "components", label: "Components", type: "number" as const, value: 2 },
    ],
  },
  {
    title: "Display",
    fields: [
      { key: "showGroupEllipses", label: "Show group confidence ellipses (95%)", type: "checkbox" as const, value: true, description: "Draw grouping circles around each sample group on the score plot" },
    ],
  },
];

export const volcanoConfig = [
  {
    title: "Statistical Test",
    fields: [
      { key: "testMethod", label: "Test Method", type: "select" as const, value: "t-test", options: ["t-test", "Wilcoxon"] },
      { key: "fdrMethod", label: "FDR Correction", type: "select" as const, value: "BH", options: ["BH", "Bonferroni", "None"] },
      { key: "pThreshold", label: "p-value threshold", type: "number" as const, value: 0.05 },
      { key: "foldChangeThreshold", label: "Fold change threshold", type: "number" as const, value: 0.5 },
    ],
  },
  {
    title: "Display",
    fields: [
      { key: "showLabels", label: "Label significant features", type: "checkbox" as const, value: false, description: "Annotate top significant features on the volcano plot" },
      { key: "labelTopN", label: "Max labels", type: "number" as const, value: 15, description: "Maximum number of feature names to show when labeling is enabled" },
    ],
  },
];

export const clusteringConfig = [
  {
    title: "Clustering Method",
    fields: [
      { key: "algorithm", label: "Algorithm", type: "select" as const, value: "Hierarchical", options: ["Hierarchical", "K-means"] },
      { key: "distanceMetric", label: "Distance Metric", type: "select" as const, value: "Euclidean", options: ["Euclidean", "Manhattan", "Pearson"] },
      { key: "linkageMethod", label: "Linkage Method", type: "select" as const, value: "Average", options: ["Ward", "Average", "Complete", "Single"] },
    ],
  },
  {
    title: "Normalization",
    fields: [
      { key: "rowScaling", label: "Row scaling", type: "select" as const, value: "Z-score", options: ["Z-score", "Min-Max", "None"] },
      { key: "logTransform", label: "Log transform", type: "checkbox" as const, value: true },
    ],
  },
];

export const plsdaConfig = [
  {
    title: "Model Parameters",
    fields: [
      { key: "components", label: "Number of Components", type: "number" as const, value: 2 },
      { key: "scalingMethod", label: "Scaling Method", type: "select" as const, value: "Pareto", options: ["Pareto", "Auto", "None"] },
      { key: "logTransform", label: "Log Transformation", type: "checkbox" as const, value: true },
    ],
  },
  {
    title: "Cross-Validation",
    fields: [
      { key: "cvFolds", label: "CV Folds", type: "number" as const, value: 7 },
      { key: "permutations", label: "Permutations", type: "number" as const, value: 100 },
    ],
  },
  {
    title: "Feature Selection",
    fields: [
      { key: "vipThreshold", label: "VIP threshold", type: "number" as const, value: 1.0 },
    ],
  },
  {
    title: "Display",
    fields: [
      { key: "showGroupEllipses", label: "Show group confidence regions (95%)", type: "checkbox" as const, value: true, description: "Draw filled grouping regions around each class on the score plot" },
    ],
  },
];

export const pathwayConfig = [
  {
    title: "Database",
    fields: [
      { key: "database", label: "Pathway Database", type: "select" as const, value: "KEGG", options: ["KEGG", "Reactome", "MetaCyc", "GO Biological Process"] },
      { key: "organism", label: "Organism", type: "select" as const, value: "Homo sapiens", options: ["Homo sapiens", "Mus musculus", "Rattus norvegicus"] },
    ],
  },
  {
    title: "Statistical Method",
    fields: [
      { key: "testMethod", label: "Test Method", type: "select" as const, value: "Hypergeometric", options: ["Hypergeometric", "Fisher"] },
      { key: "fdrMethod", label: "Multiple testing correction", type: "select" as const, value: "BH", options: ["BH", "Bonferroni", "None"] },
      { key: "pThreshold", label: "p-value threshold", type: "number" as const, value: 0.05 },
    ],
  },
  {
    title: "Background",
    fields: [
      { key: "minPathwaySize", label: "Min pathway size", type: "number" as const, value: 3 },
      { key: "maxPathwaySize", label: "Max pathway size", type: "number" as const, value: 500 },
    ],
  },
];

export const biomarkerConfig = [
  {
    title: "Priority Scoring Weights",
    fields: [
      { key: "weightFoldChange", label: "Fold Change weight", type: "number" as const, value: 30, unit: "%" },
      { key: "weightPValue", label: "Statistical significance weight", type: "number" as const, value: 25, unit: "%" },
      { key: "weightVip", label: "VIP Score weight", type: "number" as const, value: 25, unit: "%" },
      { key: "weightLiterature", label: "Literature support weight", type: "number" as const, value: 20, unit: "%" },
    ],
  },
  {
    title: "Filters",
    fields: [
      { key: "minFoldChange", label: "Min |log2FC|", type: "number" as const, value: 0.58 },
      { key: "maxPValue", label: "Max p-value", type: "number" as const, value: 0.05 },
      { key: "minVip", label: "Min VIP", type: "number" as const, value: 1.0 },
      { key: "minPriorityScore", label: "Min priority score", type: "number" as const, value: 5.0 },
    ],
  },
];

export const ANALYSIS_TYPES = ["PCA", "Volcano", "Clustering", "PLS-DA", "Pathway", "Biomarker"] as const;
