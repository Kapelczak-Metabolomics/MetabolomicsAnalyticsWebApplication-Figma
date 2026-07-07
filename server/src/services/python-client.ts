import FormData from "form-data";

const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:47824";
const MZXML_TIMEOUT_MS = 10 * 60 * 1000;

type MzxmlFile = { buffer: Buffer; filename: string };

type MzxmlImportResult = {
  samples: Array<{ sampleId: string; groupLabel: string; values: number[] }>;
  features: Array<{ featureId: string; name: string; featureClass: string | null; pathway: string | null; values: (number | null)[] }>;
  samplesCount: number;
  featuresCount: number;
  missingPct: number;
  sourceFormat: string;
};

function buildMultipartBody(files: MzxmlFile[], groups?: Record<string, string>): FormData {
  const form = new FormData();
  for (const f of files) {
    form.append("files", f.buffer, { filename: f.filename, contentType: "application/octet-stream" });
  }
  if (groups) {
    form.append("groups", JSON.stringify(groups));
  }
  return form;
}

async function postMzxmlForm(path: string, files: MzxmlFile[], groups?: Record<string, string>): Promise<Response> {
  const form = buildMultipartBody(files, groups);
  const headers = form.getHeaders();
  const res = await fetch(`${PYTHON_URL}${path}`, {
    method: "POST",
    headers,
    body: form as unknown as BodyInit,
    signal: AbortSignal.timeout(MZXML_TIMEOUT_MS),
  });
  return res;
}

export async function pythonHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${PYTHON_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pythonPreviewMzxml(
  files: MzxmlFile[]
): Promise<{ samples: Array<{ filename: string; sampleId: string }> }> {
  const res = await postMzxmlForm("/import/mzxml/preview", files);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || body.error || "mzXML preview failed");
  }
  return res.json();
}

export async function pythonImportMzxml(files: MzxmlFile[], groups?: Record<string, string>): Promise<MzxmlImportResult> {
  const res = await postMzxmlForm("/import/mzxml", files, groups);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || body.error || "mzXML import failed");
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
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || body.error || `Python analysis failed: ${type}`);
  }

  return res.json();
}

export function usePythonAnalysis(): boolean {
  return process.env.USE_PYTHON_ANALYSIS !== "false";
}
