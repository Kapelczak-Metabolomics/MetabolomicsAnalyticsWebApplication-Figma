import { createReadStream } from "fs";
import FormData from "form-data";
import { Readable } from "stream";

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:47824";
const MZXML_TIMEOUT_MS = 10 * 60 * 1000;
/** Short timeout so unreachable Python falls back to TypeScript quickly. */
const ANALYSIS_TIMEOUT_MS = 15 * 1000;
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
      knownLength: undefined,
    });
  }
  if (groups) {
    form.append("groups", JSON.stringify(groups));
  }
  return form;
}

async function postMzxmlForm(path: string, files: MzxmlFile[], groups?: Record<string, string>): Promise<Response> {
  const form = buildMultipartForm(files, groups);
  const headers = form.getHeaders();

  return fetch(`${PYTHON_URL}${path}`, {
    method: "POST",
    headers,
    body: Readable.toWeb(form) as BodyInit,
    signal: AbortSignal.timeout(MZXML_TIMEOUT_MS),
    // @ts-expect-error duplex required for streaming request bodies in Node fetch
    duplex: "half",
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
  let res: Response;
  try {
    res = await postMzxmlForm("/import/mzxml/preview", files);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Python service unreachable at ${PYTHON_URL}: ${msg}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatServiceError(body, `mzXML preview failed (${res.status})`));
  }
  return res.json();
}

export async function pythonImportMzxml(files: MzxmlFile[], groups?: Record<string, string>): Promise<MzxmlImportResult> {
  let res: Response;
  try {
    res = await postMzxmlForm("/import/mzxml", files, groups);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Python service unreachable at ${PYTHON_URL}: ${msg}`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatServiceError(body, `mzXML import failed (${res.status})`));
  }
  return res.json();
}

export async function pythonRunAnalysis(
  type: string,
  samples: unknown[],
  features: unknown[],
  config: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const res = await fetch(`${PYTHON_URL}/analysis/${encodeURIComponent(type)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ samples, features, config }),
    signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
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
