import { Download, Settings2, Search, Filter } from "lucide-react";

export function DataTableView() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base">Client Data Table</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Raw feature abundance and sample metadata
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search features..."
                className="h-8 w-64 rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
            <button className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Settings2 className="h-3.5 w-3.5" />
              Columns
            </button>
            <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 border-b border-border bg-muted/50 backdrop-blur">
            <tr>
              <th className="p-2 text-left font-medium sticky left-0 bg-muted/50 backdrop-blur">
                Feature ID
              </th>
              <th className="p-2 text-left font-medium">Name</th>
              <th className="p-2 text-left font-medium">Class</th>
              <th className="p-2 text-right font-medium">Mean (AD)</th>
              <th className="p-2 text-right font-medium">SD (AD)</th>
              <th className="p-2 text-right font-medium">Mean (Control)</th>
              <th className="p-2 text-right font-medium">SD (Control)</th>
              <th className="p-2 text-right font-medium">log2FC</th>
              <th className="p-2 text-right font-medium">p-value</th>
              <th className="p-2 text-right font-medium">adj. p</th>
              <th className="p-2 text-right font-medium">VIP</th>
              <th className="p-2 text-left font-medium">Pathway</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 50 }, (_, i) => {
              const features = [
                {
                  id: "M001",
                  name: "Glutamate",
                  class: "Amino Acid",
                  meanAD: 12.34,
                  sdAD: 2.45,
                  meanControl: 6.78,
                  sdControl: 1.89,
                  fc: 2.34,
                  p: 3.4e-6,
                  adj: 1.2e-4,
                  vip: 2.34,
                  pathway: "Nitrogen metabolism",
                },
                {
                  id: "M002",
                  name: "Leucine",
                  class: "Amino Acid",
                  meanAD: 8.45,
                  sdAD: 1.67,
                  meanControl: 15.23,
                  sdControl: 2.34,
                  fc: -1.87,
                  p: 8.2e-5,
                  adj: 2.3e-3,
                  vip: 2.12,
                  pathway: "BCAA biosynthesis",
                },
                {
                  id: "M003",
                  name: "Phenylalanine",
                  class: "Amino Acid",
                  meanAD: 14.56,
                  sdAD: 2.89,
                  meanControl: 7.89,
                  sdControl: 1.45,
                  fc: 1.92,
                  p: 2.3e-4,
                  adj: 4.1e-3,
                  vip: 1.89,
                  pathway: "Aminoacyl-tRNA",
                },
                {
                  id: "M004",
                  name: "Valine",
                  class: "Amino Acid",
                  meanAD: 6.78,
                  sdAD: 1.23,
                  meanControl: 11.45,
                  sdControl: 2.01,
                  fc: -1.65,
                  p: 4.7e-4,
                  adj: 6.8e-3,
                  vip: 1.76,
                  pathway: "BCAA biosynthesis",
                },
                {
                  id: "M005",
                  name: "Glucose",
                  class: "Carbohydrate",
                  meanAD: 45.23,
                  sdAD: 8.92,
                  meanControl: 42.67,
                  sdControl: 7.45,
                  fc: 0.23,
                  p: 0.234,
                  adj: 0.456,
                  vip: 0.34,
                  pathway: "Glycolysis",
                },
              ];
              const feature = features[i % features.length];
              const rowId = `${feature.id.slice(0, -2)}${String(i + 1).padStart(3, "0")}`;

              return (
                <tr
                  key={i}
                  className="border-b border-border hover:bg-muted/50"
                >
                  <td className="p-2 sticky left-0 bg-background font-mono text-[11px]">
                    {rowId}
                  </td>
                  <td className="p-2 font-medium">{feature.name}</td>
                  <td className="p-2 text-muted-foreground">{feature.class}</td>
                  <td className="p-2 text-right tabular-nums">
                    {feature.meanAD.toFixed(2)}
                  </td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">
                    {feature.sdAD.toFixed(2)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {feature.meanControl.toFixed(2)}
                  </td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">
                    {feature.sdControl.toFixed(2)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {feature.fc.toFixed(2)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {feature.p < 0.001
                      ? feature.p.toExponential(1)
                      : feature.p.toFixed(3)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {feature.adj < 0.001
                      ? feature.adj.toExponential(1)
                      : feature.adj.toFixed(3)}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {feature.vip.toFixed(2)}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {feature.pathway}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing 1-50 of 1,247 features</span>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-border bg-background px-2 py-1 hover:bg-accent disabled:opacity-50">
              Previous
            </button>
            <span className="tabular-nums">Page 1 of 25</span>
            <button className="rounded-md border border-border bg-background px-2 py-1 hover:bg-accent">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
