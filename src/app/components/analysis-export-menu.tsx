import { Download, ChevronDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { downloadCsv, downloadJson, downloadFromApi } from "../../lib/export";

interface AnalysisExportMenuProps {
  experimentId?: number | null;
  results?: Record<string, unknown> | null;
  analysisType: string;
  filename?: string;
}

export function AnalysisExportMenu({ experimentId, results, analysisType, filename }: AnalysisExportMenuProps) {
  const base = filename ?? analysisType.toLowerCase().replace(/\s+/g, "-");

  function exportClient(fmt: string) {
    if (!results) {
      toast.error("Run analysis first");
      return;
    }
    if (fmt === "JSON") {
      downloadJson(`${base}.json`, results);
      return;
    }
    if (fmt === "CSV") {
      const rows = extractRows(results, analysisType);
      if (!rows.length) {
        toast.error("No tabular data to export");
        return;
      }
      downloadCsv(`${base}.csv`, rows);
      return;
    }
    toast.info(`${fmt} export: use browser screenshot or SVG export from plot`);
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
          {["CSV", "JSON"].map((fmt) => (
            <DropdownMenu.Item
              key={fmt}
              className="cursor-pointer rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
              onSelect={() => {
                if (experimentId) {
                  downloadFromApi(`/experiments/${experimentId}/export?format=${fmt.toLowerCase()}`, `${base}.${fmt.toLowerCase()}`)
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
