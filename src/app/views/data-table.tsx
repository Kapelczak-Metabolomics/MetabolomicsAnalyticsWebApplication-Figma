import { useEffect, useState } from "react";
import { Download, Settings2, Search, Filter } from "lucide-react";
import { api } from "../../lib/api";

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

export function DataTableView() {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [datasetId, setDatasetId] = useState<number | null>(null);

  useEffect(() => {
    api.getDatasets()
      .then((datasets) => {
        const ready = datasets.find((d) => d.status === "ready");
        if (ready) {
          setDatasetId(ready.id);
          return api.getDatasetFeatures(ready.id, { limit: 200 });
        }
        return null;
      })
      .then((result) => {
        if (result) setFeatures(result.features as unknown as FeatureRow[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = features.filter(
    (f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.featureId.toLowerCase().includes(search.toLowerCase())
  );

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
              Raw feature abundance and sample metadata {datasetId ? `(dataset #${datasetId})` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search features..."
                className="h-8 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50" />
            </div>
            <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
            <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Settings2 className="h-3.5 w-3.5" /> Columns
            </button>
            <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 border-b border-border bg-muted/50 backdrop-blur">
            <tr>
              <th className="p-2 text-left font-medium sticky left-0 bg-muted/50 backdrop-blur">Feature ID</th>
              <th className="p-2 text-left font-medium">Name</th>
              <th className="p-2 text-left font-medium">Class</th>
              <th className="p-2 text-right font-medium">Mean (G1)</th>
              <th className="p-2 text-right font-medium">SD (G1)</th>
              <th className="p-2 text-right font-medium">Mean (G2)</th>
              <th className="p-2 text-right font-medium">SD (G2)</th>
              <th className="p-2 text-right font-medium">log2FC</th>
              <th className="p-2 text-right font-medium">p-value</th>
              <th className="p-2 text-right font-medium">adj. p</th>
              <th className="p-2 text-right font-medium">VIP</th>
              <th className="p-2 text-left font-medium">Pathway</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.featureId} className="border-b border-border hover:bg-muted/30">
                <td className="p-2 font-mono sticky left-0 bg-background">{f.featureId}</td>
                <td className="p-2">{f.name}</td>
                <td className="p-2 text-muted-foreground">{f.featureClass}</td>
                <td className="p-2 text-right tabular-nums">{f.meanAD}</td>
                <td className="p-2 text-right tabular-nums">{f.sdAD}</td>
                <td className="p-2 text-right tabular-nums">{f.meanControl}</td>
                <td className="p-2 text-right tabular-nums">{f.sdControl}</td>
                <td className="p-2 text-right tabular-nums">{f.log2fc}</td>
                <td className="p-2 text-right tabular-nums">{f.pValue < 0.001 ? f.pValue.toExponential(1) : f.pValue.toFixed(4)}</td>
                <td className="p-2 text-right tabular-nums">{f.adjP < 0.001 ? f.adjP.toExponential(1) : f.adjP.toFixed(4)}</td>
                <td className="p-2 text-right tabular-nums">{f.vip}</td>
                <td className="p-2 text-muted-foreground">{f.pathway}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
