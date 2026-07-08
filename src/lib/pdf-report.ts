import { jsPDF } from "jspdf";
import { capturePlotImage } from "./export";

export interface ReportPlot {
  containerId?: string;
  title: string;
}

export interface ReportSummaryRow {
  label: string;
  value: string;
}

export interface PdfReportOptions {
  filename: string;
  projectName: string;
  datasetName: string;
  analysisType: string;
  reportTitle?: string;
  reportSubtitle?: string;
  comparison?: string;
  preparedBy?: string;
  preparedFor?: string;
  organization?: string;
  plots: ReportPlot[];
  summaryRows?: ReportSummaryRow[];
  /** Optional custom page rendered after plot pages (e.g. silhouette score). */
  customPages?: Array<{
    title: string;
    render: (doc: jsPDF, margin: number, contentWidth: number, y: number) => number;
  }>;
}

const MARGIN = 18;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BRAND = "Isotopiq Solutions";

function formatDate(d = new Date()) {
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });
}

function addPageHeader(doc: jsPDF, projectName: string, organization: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(projectName, MARGIN, 12);
  doc.text("Single-Page Plots", PAGE_W / 2, 12, { align: "center" });
  doc.text(organization, PAGE_W - MARGIN, 12, { align: "right" });
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, 15, PAGE_W - MARGIN, 15);
}

function addPageFooter(doc: jsPDF, pageNum: number, organization: string, generatedAt: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const footer = `Generated ${generatedAt} | ${organization} Page ${pageNum}`;
  doc.text(footer, PAGE_W / 2, PAGE_H - 10, { align: "center" });
}

function addCoverPage(doc: jsPDF, opts: PdfReportOptions, generatedAt: string) {
  const org = opts.organization ?? BRAND;
  const reportTitle = opts.reportTitle ?? `${opts.analysisType.toUpperCase()} STATISTICAL REPORT`;
  const subtitle =
    opts.reportSubtitle ??
    "Global overview, differential analysis, and visualization plots";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(generatedAt, PAGE_W - MARGIN, 14, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  const projectLines = doc.splitTextToSize(`${opts.projectName} — ${opts.datasetName}`, CONTENT_W);
  doc.text(projectLines, MARGIN, 42);

  doc.setFontSize(16);
  doc.text(reportTitle, MARGIN, 42 + projectLines.length * 8 + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(subtitle, MARGIN, 42 + projectLines.length * 8 + 22);

  const plotTags = opts.plots.map((p) => p.title).join("  ·  ");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(plotTags, MARGIN, 42 + projectLines.length * 8 + 34);

  let y = 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text("Report Overview", MARGIN, y);
  y += 10;

  const overview: Array<[string, string]> = [
    ["PRIMARY COMPARISON", opts.comparison ?? "All groups"],
    ["PREPARED FOR", opts.preparedFor ?? "Isotopiq Client"],
    ["REPORT CONTENTS", `${opts.analysisType} Analysis Report`],
    ["PREPARED BY", opts.preparedBy ?? org],
  ];

  doc.setFont("helvetica", "normal");
  overview.forEach(([label, value]) => {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, MARGIN, y);
    y += 5;
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(value, CONTENT_W - 4);
    doc.text(lines, MARGIN, y);
    y += lines.length * 6 + 8;
  });

  if (opts.summaryRows?.length) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text("Analysis Summary", MARGIN, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    opts.summaryRows.forEach((row) => {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(row.label, MARGIN, y);
      doc.setTextColor(30, 41, 59);
      doc.text(row.value, MARGIN + 70, y);
      y += 7;
    });
  }
}

async function addPlotPage(
  doc: jsPDF,
  plot: ReportPlot,
  projectName: string,
  organization: string,
  generatedAt: string,
  pageNum: number
) {
  doc.addPage();
  addPageHeader(doc, projectName, organization);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(plot.title, PAGE_W / 2, 28, { align: "center" });

  if (plot.containerId) {
    try {
      const dataUrl = await capturePlotImage(plot.containerId, "png");
      const imgW = CONTENT_W;
      const imgH = 200;
      doc.addImage(dataUrl, "PNG", MARGIN, 36, imgW, imgH);
    } catch {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text("Plot not available — run analysis first.", PAGE_W / 2, 120, { align: "center" });
    }
  }

  addPageFooter(doc, pageNum, organization, generatedAt);
}

export async function generatePdfReport(opts: PdfReportOptions): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const generatedAt = formatDate();
  const org = opts.organization ?? BRAND;

  addCoverPage(doc, opts, shortDate());

  let pageNum = 0;
  for (const plot of opts.plots) {
    pageNum += 1;
    await addPlotPage(doc, plot, `${opts.projectName} — ${opts.datasetName}`, org, generatedAt, pageNum);
  }

  if (opts.customPages?.length) {
    for (const page of opts.customPages) {
      pageNum += 1;
      doc.addPage();
      addPageHeader(doc, `${opts.projectName} — ${opts.datasetName}`, org);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(page.title, PAGE_W / 2, 28, { align: "center" });
      page.render(doc, MARGIN, CONTENT_W, 40);
      addPageFooter(doc, pageNum, org, generatedAt);
    }
  }

  doc.save(opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`);
}
