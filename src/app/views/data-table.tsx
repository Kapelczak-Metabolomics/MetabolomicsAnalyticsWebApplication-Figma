import { useEffect, useMemo, useState } from "react";
import { Download, Settings2, Search, Filter, Columns3 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { downloadCsv } from "../../lib/export";

interface FeatureRow {
  featureId: string;
  name: string;
  featureClass: string;
  meanAD: number;
  sdAD: number;
  meanControl: number;
  sdControl: number;
  log2fc: number;
  pValue: number;
  adjP: number;
  vip: number;
  pathway: string;
}

const ALL_COLUMNS: Array<{ key: keyof FeatureRow; label: string; align?: "left" | "right" }> = [
  { key: "featureId", label: "Feature ID" },
  { key: "name", label: "Name" },
  { key: "featureClass", label: "Class" },
  { key: "meanAD", label: "Mean (G1)", align: "right" },
  { key: "sdAD", label: "SD (G1)", align: "right" },
  { key: "meanControl", label: "Mean (G2)", align: "right" },
  { key: "sdControl", label: "SD (G2)", align: "right" },
  { key: "log2fc", label: "log2FC", align: "right" },
  { key: "pValue", label: "p-value", align: "right" },
  { key: "adjP", label: "adj. p", align: "right" },
  { key: "vip", label: "VIP", align: "right" },
  { key: "pathway", label: "Pathway" },
];

export function DataTableView() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(ALL_COLUMNS.map((c) => c.key)));
  const [filters, setFilters] = useState({ minLog2fc: "", maxPValue: "", pathway: "" });

  useEffect(() => {
    api.getDatasets()
      .then((datasets) => {
        const ready = datasets.find((d) => d.status === "ready");
        if (ready) {
          setDatasetId(ready.id);
          return api.getDatasetFeatures(ready.id, { limit: 500 });
        }
        return null;
      })
      .then((result) => {
        if (result) setFeatures(result.features as unknown as FeatureRow[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return features.filter((f) => {
      const q = search.toLowerCase();
      const matchSearch = f.name.toLowerCase().includes(q) || f.featureId.toLowerCase().includes(q);
      const matchFc = !filters.minLog2fc || Math.abs(f.log2fc) >= parseFloat(filters.minLog2fc);
      const matchP = !filters.maxPValue || f.pValue <= parseFloat(filters.maxPValue);
      const matchPath = !filters.pathway || (f.pathway ?? "").toLowerCase().includes(filters.pathway.toLowerCase());
      return matchSearch && matchFc && matchP && matchPath;
    });
  }, [features, search, filters]);

  const columns = ALL_COLUMNS.filter((c) => visibleCols.has(c.key));

  function handleExport() {
    if (!filtered.length) {
      toast.error("No data to export");
      return;
    }
    const rows = filtered.map((f) => {
      const row: Record<string, unknown> = {};
      columns.forEach((c) => { row[c.key] = f[c.key]; });
      return row;
    });
    downloadCsv(`dataset-${datasetId ?? "features"}.csv`, rows);
    toast.success(`Exported ${rows.length} features`);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Client Data Table</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Raw feature abundance and sample metadata {datasetId ? `(dataset #${datasetId})` : ""} · {filtered.length} rows
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search features..."
                className="h-8 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50" />
            </div>
            <button onClick={() => setFilterOpen(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
            <button onClick={() => setColumnsOpen(true)} className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Columns3 className="h-3.5 w-3.5" /> Columns
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 border-b border-border bg-muted/50 backdrop-blur">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`p-2 font-medium ${col.align === "right" ? "text-right" : "text-left"} ${col.key === "featureId" ? "sticky left-0 bg-muted/50 backdrop-blur" : ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.featureId} className="border-b border-border hover:bg-muted/30">
                {columns.map((col) => (
                  <td key={col.key} className={`p-2 ${col.align === "right" ? "text-right tabular-nums" : ""} ${col.key === "featureId" ? "font-mono sticky left-0 bg-background" : ""} ${col.key === "featureClass" || col.key === "pathway" ? "text-muted-foreground" : ""}`}>
                    {col.key === "pValue" || col.key === "adjP"
                      ? (f[col.key] < 0.001 ? f[col.key].toExponential(1) : f[col.key].toFixed(4))
                      : String(f[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={filterOpen} onOpenChange={setFilterOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-xl">
            <Dialog.Title className="text-sm font-semibold mb-4">Filter Features</Dialog.Title>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Min |log2FC|</label>
                <input type="number" step="0.1" value={filters.minLog2fc} onChange={(e) => setFilters((f) => ({ ...f, minLog2fc: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="text-xs font-medium">Max p-value</label>
                <input type="number" step="0.01" value={filters.maxPValue} onChange={(e) => setFilters((f) => ({ ...f, maxPValue: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="text-xs font-medium">Pathway contains</label>
                <input type="text" value={filters.pathway} onChange={(e) => setFilters((f) => ({ ...f, pathway: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setFilters({ minLog2fc: "", maxPValue: "", pathway: "" })} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">Clear</button>
              <button onClick={() => setFilterOpen(false)} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">Apply</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={columnsOpen} onOpenChange={setColumnsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-xl">
            <Dialog.Title className="text-sm font-semibold mb-4">Visible Columns</Dialog.Title>
            <div className="space-y-2 max-h-64 overflow-auto">
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={visibleCols.has(col.key)}
                    onChange={(e) => setVisibleCols((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(col.key); else next.delete(col.key);
                      return next;
                    })} />
                  {col.label}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setColumnsOpen(false)} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">Done</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
