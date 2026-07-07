import http from "http";
import https from "https";
import { createReadStream } from "fs";
import FormData from "form-data";

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:47824";
const MZXML_TIMEOUT_MS = 10 * 60 * 1000;
/** Pathway enrichment calls live KEGG/Reactome APIs and needs longer than PCA/volcano. */
const ANALYSIS_TIMEOUT_MS = 15 * 1000;
const PATHWAY_TIMEOUT_MS = 120 * 1000;
const HEALTH_CACHE_MS = 30_000;

let pythonHealthCache: { ok: boolean; checkedAt: number } | null = null;

export type MzxmlFile = { path: string; filename: string };

type MzxmlImportResult = {
  samples: Array<{ sampleId: string; groupLabel: string; values: number[] }>;
  features: Array<{ featureId: string; name: string; featureClass: string | null; pathway: string | null; values: (number | null)[] }>;
  samplesCount: number;
  featuresCount: number;
  missingPct: number;
  sourceFormat: string;
};

function formatServiceError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  const detail = record.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) return String((item as { msg: unknown }).msg);
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  return fallback;
}

function buildMultipartForm(files: MzxmlFile[], groups?: Record<string, string>): FormData {
  const form = new FormData();
  for (const f of files) {
    form.append("files", createReadStream(f.path), {
      filename: f.filename,
      contentType: "application/octet-stream",
    });
  }
  if (groups) {
    form.append("groups", JSON.stringify(groups));
  }
  return form;
}

function postMzxmlForm(path: string, files: MzxmlFile[], groups?: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const form = buildMultipartForm(files, groups);
    const url = new URL(`${PYTHON_URL}${path}`);
    const transport = url.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: form.getHeaders(),
        timeout: MZXML_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => resolve({ status: res.statusCode ?? 500, body: Buffer.concat(chunks).toString("utf8") }));
      }
    );

    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Python mzXML request timed out")));
    form.on("error", reject);
    form.pipe(req);
  });
}

export function getPythonServiceUrl(): string {
  return PYTHON_URL;
}

export async function pythonHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${PYTHON_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Cached health check — avoids a 15s analysis timeout when Python is down. */
export async function isPythonAnalysisAvailable(): Promise<boolean> {
  if (!usePythonAnalysis()) return false;
  const now = Date.now();
  if (pythonHealthCache && now - pythonHealthCache.checkedAt < HEALTH_CACHE_MS) {
    return pythonHealthCache.ok;
  }
  const ok = await pythonHealth();
  pythonHealthCache = { ok, checkedAt: now };
  return ok;
}

export function invalidatePythonHealthCache(): void {
  pythonHealthCache = null;
}

export async function pythonPreviewMzxml(
  files: MzxmlFile[]
): Promise<{ samples: Array<{ filename: string; sampleId: string }> }> {
  let res: { status: number; body: string };
  try {
    res = await postMzxmlForm("/import/mzxml/preview", files);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Python service unreachable at ${PYTHON_URL}: ${msg}`);
  }
  if (res.status < 200 || res.status >= 300) {
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(res.body || "{}");
    } catch {
      /* ignore */
    }
    throw new Error(formatServiceError(parsed, `mzXML preview failed (${res.status})`));
  }
  return JSON.parse(res.body) as { samples: Array<{ filename: string; sampleId: string }> };
}

export async function pythonImportMzxml(files: MzxmlFile[], groups?: Record<string, string>): Promise<MzxmlImportResult> {
  let res: { status: number; body: string };
  try {
    res = await postMzxmlForm("/import/mzxml", files, groups);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Python service unreachable at ${PYTHON_URL}: ${msg}`);
  }
  if (res.status < 200 || res.status >= 300) {
    let parsed: unknown = {};
    try { parsed = JSON.parse(res.body || "{}"); } catch { /* ignore */ }
    throw new Error(formatServiceError(parsed, `mzXML import failed (${res.status})`));
  }
  return JSON.parse(res.body) as MzxmlImportResult;
}

export async function pythonRunAnalysis(
  type: string,
  samples: unknown[],
  features: unknown[],
  config: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const timeout = type === "Pathway" ? PATHWAY_TIMEOUT_MS : ANALYSIS_TIMEOUT_MS;
  const res = await fetch(`${PYTHON_URL}/analysis/${encodeURIComponent(type)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ samples, features, config }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatServiceError(body, `Python analysis failed: ${type}`));
  }

  return res.json();
}

export function usePythonAnalysis(): boolean {
  return process.env.USE_PYTHON_ANALYSIS !== "false";
}
