export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json");
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  downloadText(filename, csv, "text/csv");
}

export function downloadSvg(filename: string, svgEl: SVGSVGElement | null) {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  downloadText(filename, xml, "image/svg+xml");
}

export async function downloadPngFromSvg(filename: string, svgEl: SVGSVGElement | null, scale = 2) {
  if (!svgEl) throw new Error("No plot SVG found");
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  const viewBox = clone.viewBox?.baseVal;
  const width = viewBox?.width || clone.width.baseVal.value || 800;
  const height = viewBox?.height || clone.height.baseVal.value || 600;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas unavailable")); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((png) => {
        if (!png) { reject(new Error("PNG export failed")); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to render plot"));
    img.src = url;
  });
  URL.revokeObjectURL(url);
}

export function findPlotSvg(containerId?: string): SVGSVGElement | null {
  const root = containerId ? document.getElementById(containerId) : null;
  if (root) return root.querySelector("svg");
  return document.querySelector("[data-plot-export] svg");
}

export async function exportPlot(containerId: string | undefined, filename: string, format: "SVG" | "PNG") {
  const svg = findPlotSvg(containerId);
  if (!svg) throw new Error("Plot not found — run analysis first");
  if (format === "SVG") {
    downloadSvg(`${filename}.svg`, svg);
  } else {
    await downloadPngFromSvg(`${filename}.png`, svg, 2);
  }
}

export async function downloadFromApi(path: string, filename: string) {
  const token = localStorage.getItem("token");
  const base = import.meta.env.VITE_API_URL || "/api";
  const res = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
