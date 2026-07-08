import { Download, ChevronDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { downloadCsv, downloadJson, downloadFromApi, exportPlot } from "../../lib/export";
import { generatePdfReport, type ReportPlot, type ReportSummaryRow } from "../../lib/pdf-report";

export interface PdfReportConfig {
  projectName: string;
  datasetName: string;
  comparison?: string;
  preparedBy?: string;
  preparedFor?: string;
  reportTitle?: string;
  reportSubtitle?: string;
  plots: ReportPlot[];
  summaryRows?: ReportSummaryRow[];
}

interface AnalysisExportMenuProps {
  experimentId?: number | null;
  results?: Record<string, unknown> | null;
  analysisType: string;
  filename?: string;
  plotContainerId?: string;
  pdfReport?: PdfReportConfig;
}

export function AnalysisExportMenu({
  experimentId,
  results,
  analysisType,
  filename,
  plotContainerId,
  pdfReport,
}: AnalysisExportMenuProps) {
  const base = filename ?? analysisType.toLowerCase().replace(/\s+/g, "-");

  function exportClient(fmt: string) {
    if (!results) {
      toast.error("Run analysis first");
      return;
    }
    if (fmt === "JSON") {
      downloadJson(`${base}.json`, results);
      toast.success("Exported JSON");
      return;
    }
    if (fmt === "CSV") {
      const rows = extractRows(results, analysisType);
      if (!rows.length) {
        toast.error("No tabular data to export");
        return;
      }
      downloadCsv(`${base}.csv`, rows);
      toast.success("Exported CSV");
      return;
    }
  }

  async function exportFigure(fmt: "SVG" | "PNG") {
    try {
      await exportPlot(plotContainerId, base, fmt);
      toast.success(`Exported ${fmt}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to export ${fmt}`);
    }
  }

  async function exportPdfReport() {
    if (!pdfReport) {
      toast.error("PDF report not configured for this view");
      return;
    }
    try {
      await generatePdfReport({
        filename: `${base}-report.pdf`,
        analysisType,
        ...pdfReport,
      });
      toast.success("Exported PDF report");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export PDF report");
    }
  }

  const formats = pdfReport
    ? ["CSV", "JSON", "SVG", "PNG", "PDF Report"]
    : ["CSV", "JSON", "SVG", "PNG"];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
          {formats.map((fmt) => (
            <DropdownMenu.Item
              key={fmt}
              className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
              onSelect={() => {
                if (fmt === "PDF Report") {
                  void exportPdfReport();
                  return;
                }
                if (fmt === "SVG" || fmt === "PNG") {
                  void exportFigure(fmt);
                  return;
                }
                if (experimentId) {
                  downloadFromApi(`/experiments/${experimentId}/export?format=${fmt.toLowerCase()}`, `${base}.${fmt.toLowerCase()}`)
                    .then(() => toast.success(`Exported ${fmt}`))
                    .catch(() => exportClient(fmt));
                } else {
                  exportClient(fmt);
                }
              }}
            >
              {fmt}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function extractRows(results: Record<string, unknown>, type: string): Array<Record<string, unknown>> {
  if (type === "Volcano" && Array.isArray(results.features)) return results.features as Array<Record<string, unknown>>;
  if (type === "Biomarker" && Array.isArray(results.candidates)) return results.candidates as Array<Record<string, unknown>>;
  if (type === "Pathway" && Array.isArray(results.pathways)) return results.pathways as Array<Record<string, unknown>>;
  if (type === "PLS-DA" && Array.isArray(results.vipFeatures)) return results.vipFeatures as Array<Record<string, unknown>>;
  if (type === "PCA" && Array.isArray(results.scores)) return results.scores as Array<Record<string, unknown>>;
  if (type === "Clustering" && Array.isArray(results.clusters)) return results.clusters as Array<Record<string, unknown>>;
  return [];
}
