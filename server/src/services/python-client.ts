const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:47824";

export async function pythonHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${PYTHON_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pythonImportMzxml(
  files: Array<{ buffer: Buffer; filename: string }>,
  groups?: Record<string, string>
): Promise<{
  samples: Array<{ sampleId: string; groupLabel: string; values: number[] }>;
  features: Array<{ featureId: string; name: string; featureClass: string | null; pathway: string | null; values: (number | null)[] }>;
  samplesCount: number;
  featuresCount: number;
  missingPct: number;
  sourceFormat: string;
}> {
  const form = new FormData();
  for (const f of files) {
    form.append("files", new Blob([new Uint8Array(f.buffer)]), f.filename);
  }
  if (groups) {
    form.append("groups", JSON.stringify(groups));
  }

  const res = await fetch(`${PYTHON_URL}/import/mzxml`, {
    method: "POST",
    body: form,
  });

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
