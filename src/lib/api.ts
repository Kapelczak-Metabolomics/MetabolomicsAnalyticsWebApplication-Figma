const API_BASE = import.meta.env.VITE_API_URL || "/api";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

function formatApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return fallback;
}

function httpStatusFallback(status: number): string {
  if (status === 413) return "File too large — maximum upload size is 500 MB";
  if (status === 401) return "Not signed in — please log in and try again";
  if (status === 502) {
    return "Upload failed (502). Redeploy web + api + python, then open /api/health — python must be true. Set PYTHON_SERVICE_URL=http://python:47824 on the api service in EasyPanel.";
  }
  if (status === 503) return "Python analysis service unavailable — check the python container is healthy";
  if (status === 504) return "Upload timed out — try fewer or smaller files";
  return "Request failed";
}

async function parseErrorResponse(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      const body = JSON.parse(text) as unknown;
      const msg = formatApiError(body, "");
      if (msg) return msg;
    } catch {
      if (text.includes("413") || text.toLowerCase().includes("too large")) {
        return "File too large — maximum upload size is 500 MB";
      }
      if (text.includes("Service is not reachable") || text.includes("<!DOCTYPE")) {
        return "Service is not reachable — the API may have restarted. Wait a moment and try again.";
      }
      const trimmed = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (trimmed.length > 0 && trimmed.length < 300) return trimmed;
    }
  }
  return httpStatusFallback(res.status) || res.statusText || "Request failed";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new ApiError(
        res.status || 502,
        "Service is not reachable — the API may have restarted. Wait a moment and try again."
      );
    }
    throw new ApiError(res.status, "Invalid response from server");
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; name: string; email: string; role: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getHealth: () => request<{ status: string; python: boolean }>("/health"),

  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    request<{ success: boolean }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  me: () => request<{ user: { id: number; name: string; email: string; role: string } }>("/auth/me"),

  getProjects: () => request<Array<{
    id: number; name: string; description: string; datasets: number; samples: number;
    lastModified: string; status: string; color: string;
  }>>("/projects"),

  getProject: (id: string) => request<{
    id: number; name: string; description: string; status: string; color: string;
    studyType?: string; visibility?: string;
    datasets: Array<{ id: string; name: string; type: string; samples: number; features: number; created: string; status: string }>;
    experiments: Array<{ id: string; name: string; type: string; status: string; created: string }>;
    members: Array<{ id: number; name: string; email: string; role: string; status: string; joined: string }>;
  }>(`/projects/${id}`),

  createProject: (data: { name: string; description?: string; type?: string; color?: string; collaborators?: string[] }) =>
    request<{ id: number; name: string; color: string }>("/projects", { method: "POST", body: JSON.stringify(data) }),

  deleteProject: (id: number) => request<{ success: boolean }>(`/projects/${id}`, { method: "DELETE" }),

  updateProject: (id: number, data: { name?: string; description?: string; status?: string; studyType?: string; visibility?: string }) =>
    request<{ success: boolean }>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  inviteMember: (projectId: number, data: { email: string; role?: string; name?: string }) =>
    request<{ id: number }>(`/projects/${projectId}/members`, { method: "POST", body: JSON.stringify(data) }),

  updateMember: (projectId: number, memberId: number, data: { role?: string; status?: string }) =>
    request<{ success: boolean }>(`/projects/${projectId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify(data) }),

  removeMember: (projectId: number, memberId: number) =>
    request<{ success: boolean }>(`/projects/${projectId}/members/${memberId}`, { method: "DELETE" }),

  getDatasets: () => request<Array<{ id: number; name: string; type: string; samples_count: number; features_count: number; status: string; project_id: number; project_name: string }>>("/datasets"),

  deleteDataset: (id: number) => request<{ success: boolean }>(`/datasets/${id}`, { method: "DELETE" }),

  getDatasetGroups: (id: number) => request<Array<{ label: string; count: number }>>(`/datasets/${id}/groups`),

  getDatasetFeatures: (id: number, params?: { page?: number; limit?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.search) q.set("search", params.search);
    return request<{ total: number; page: number; limit: number; features: Array<Record<string, unknown>> }>(
      `/datasets/${id}/features?${q}`
    );
  },

  getExperiments: (projectId?: number) =>
    request<Array<{ id: string; name: string; project: string; type: string; created: string; status: string; userId?: number | null; canDelete?: boolean }>>(
      `/experiments${projectId ? `?projectId=${projectId}` : ""}`
    ),

  getExperiment: (id: number) => request<Record<string, unknown>>(`/experiments/${id}`),

  deleteExperiment: (id: number) => request<{ success: boolean }>(`/experiments/${id}`, { method: "DELETE" }),

  cancelExperiment: (id: number) => request<{ success: boolean }>(`/experiments/${id}/cancel`, { method: "POST" }),

  runAnalysis: (data: { projectId: number; datasetId: number; name: string; type: string; config?: unknown }) =>
    request<{ id: number; status: string }>("/experiments/run", { method: "POST", body: JSON.stringify(data) }),

  getAnalysisResults: (datasetId: number, type: string, groups?: { groupA?: string; groupB?: string }) => {
    const q = new URLSearchParams({ datasetId: String(datasetId), type });
    if (groups?.groupA) q.set("groupA", groups.groupA);
    if (groups?.groupB) q.set("groupB", groups.groupB);
    return request<{ experimentId: number | null; status: string; results: Record<string, unknown>; source: string; config?: unknown }>(
      `/analysis/results?${q}`
    );
  },

  getDatasetMatrix: (datasetId: number, clustered = false) =>
    request<{ sampleLabels: string[]; featureLabels: string[]; matrix: (number | null)[][]; groups: string[]; dendrogram?: unknown[]; silhouette?: number }>(
      `/analysis/dataset-matrix?datasetId=${datasetId}${clustered ? "&clustered=true" : ""}`
    ),

  importDataset: (data: {
    projectId: number;
    name: string;
    type?: string;
    csv: string;
    sampleColumn: string;
    groupColumn?: string | null;
    featureColumns?: string[];
    sampleGroups?: Record<string, string>;
  }) =>
    request<{ id: number; samples: number; features: number; missingPct: number }>("/datasets/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  previewMzxml: async (files: File[]) => {
    const sessionId = await api.stageMzxmlFiles(files);
    return api.previewMzxmlSession(sessionId);
  },

  createMzxmlSession: () =>
    request<{ sessionId: string }>("/datasets/import/mzxml/session", { method: "POST" }),

  stageMzxmlFile: (sessionId: string, file: File, onProgress?: (pct: number) => void) =>
    new Promise<{ sessionId: string; filename: string; fileCount: number }>((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      const token = getToken();
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/datasets/import/mzxml/session/${sessionId}/file`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new ApiError(xhr.status, "Invalid upload response"));
          }
          return;
        }
        reject(new ApiError(xhr.status, xhr.responseText || "Upload failed"));
      };
      xhr.onerror = () => reject(new ApiError(0, "Network error during file upload"));
      xhr.send(form);
    }),

  stageMzxmlFiles: async (files: File[], onFileProgress?: (fileIndex: number, pct: number) => void) => {
    const { sessionId } = await api.createMzxmlSession();
    for (let i = 0; i < files.length; i++) {
      await api.stageMzxmlFile(sessionId, files[i], (pct) => onFileProgress?.(i, pct));
    }
    return sessionId;
  },

  previewMzxmlSession: (sessionId: string) =>
    request<{ samples: Array<{ filename: string; sampleId: string }>; warning?: string }>(
      "/datasets/import/mzxml/preview-session",
      { method: "POST", body: JSON.stringify({ sessionId }) }
    ),

  importMzxml: async (data: {
    projectId: number;
    name: string;
    files?: File[];
    sessionId?: string;
    groups?: Record<string, string>;
  }) => {
    if (data.sessionId) {
      return request<{ id: number; status: string; message: string }>("/datasets/import/mzxml", {
        method: "POST",
        body: JSON.stringify({
          sessionId: data.sessionId,
          projectId: data.projectId,
          name: data.name,
          groups: data.groups,
        }),
      });
    }
    if (!data.files?.length) {
      throw new ApiError(400, "No mzXML files to import");
    }
    const sessionId = await api.stageMzxmlFiles(data.files);
    return api.importMzxml({ ...data, sessionId });
  },

  getImportStatus: (datasetId: number) =>
    request<{ id: number; status: string; error: string | null; samples: number; features: number; missingPct: number; sourceFormat: string }>(
      `/datasets/${datasetId}/import-status`
    ),

  getNotifications: () => request<Array<{
    id: number; type: string; title: string; message: string; time: string; read: boolean; link?: string; linkLabel?: string;
  }>>("/notifications"),

  markNotificationRead: (id: number) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: "PATCH" }),

  markAllNotificationsRead: () => request<{ success: boolean }>("/notifications/read-all", { method: "PATCH" }),

  deleteNotification: (id: number) => request<{ success: boolean }>(`/notifications/${id}`, { method: "DELETE" }),

  getDashboard: (params?: { projectId?: number; datasetId?: number }) => {
    const q = new URLSearchParams();
    if (params?.projectId) q.set("projectId", String(params.projectId));
    if (params?.datasetId) q.set("datasetId", String(params.datasetId));
    return request<{
      projectName: string; datasetName: string; datasetId: number | null;
      kpis: { totalMetabolites: number; samplesAnalyzed: number; significantFeatures: number; modelAccuracy: number };
      recentAnalyses: Array<{ title: string; type: string; href: string; lastRun: string }>;
      status: string;
    }>(`/dashboard?${q}`);
  },

  getProfile: () => request<{ id: number; name: string; email: string; role: string }>("/profile"),

  updateProfile: (data: { name?: string; email?: string }) =>
    request<{ success: boolean }>("/profile", { method: "PATCH", body: JSON.stringify(data) }),

  updatePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean }>("/profile/password", { method: "PATCH", body: JSON.stringify(data) }),

  getPreferences: () => request<Record<string, unknown>>("/profile/preferences"),

  updatePreferences: (preferences: Record<string, unknown>) =>
    request<{ success: boolean }>("/profile/preferences", { method: "PATCH", body: JSON.stringify(preferences) }),

  getStorage: () => request<{ usedGb: number; quotaGb: number }>("/profile/storage"),

  getAnalysisConfig: (type: string) => request<Record<string, unknown>>(`/profile/analysis-config/${type}`),

  saveAnalysisConfig: (type: string, config: Record<string, unknown>) =>
    request<{ success: boolean }>(`/profile/analysis-config/${type}`, { method: "PUT", body: JSON.stringify(config) }),

  getLenses: () => request<Array<{ id: number; name: string; criteria: unknown; weights: unknown }>>("/lenses"),

  saveLens: (data: { name: string; criteria: unknown; weights?: unknown }) =>
    request<{ id: number }>("/lenses", { method: "POST", body: JSON.stringify(data) }),

  deleteLens: (id: number) => request<{ success: boolean }>(`/lenses/${id}`, { method: "DELETE" }),

  addToWatchlist: (data: { featureName: string; featureId?: string; datasetId?: number }) =>
    request<{ success: boolean }>("/lenses/watchlist", { method: "POST", body: JSON.stringify(data) }),

  submitHelpFeedback: (articleId: string, helpful: boolean) =>
    request<{ success: boolean }>("/help/feedback", { method: "POST", body: JSON.stringify({ articleId, helpful }) }),

  admin: {
    getStats: () => request<Record<string, unknown>>("/admin/stats"),
    getHealth: () => request<{
      cpu: number; memory: number; disk: number;
      diskFreeGb: number; diskTotalGb: number; diskUsedGb: number;
      loadAvg: number[]; uptimeSeconds: number; rawDataBytes: number;
    }>("/admin/health"),
    getActivity: () => request<Array<{ user: string; action: string; time: string }>>("/admin/activity"),
    getUsers: () => request<Array<{ id: number; name: string; email: string; role: string; status: string; lastActive: string; projects: number }>>("/admin/users"),
    createUser: (data: { name: string; email: string; role: string }) =>
      request<{ id: number }>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
    updateUser: (id: number, data: { role?: string; status?: string }) =>
      request<{ success: boolean }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteUser: (id: number) => request<{ success: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
    resetUserPassword: (id: number) => request<{ success: boolean }>(`/admin/users/${id}/reset-password`, { method: "POST" }),
    getRuns: () => request<Array<Record<string, unknown>>>("/admin/runs"),
    deleteRun: (id: number) => request<{ success: boolean }>(`/admin/runs/${id}`, { method: "DELETE" }),
    getLogs: (since?: string) => request<{ counts: Record<string, number>; logs: Array<Record<string, unknown>> }>(`/admin/logs${since ? `?since=${since}` : ""}`),
    getAudit: () => request<Array<Record<string, unknown>>>("/admin/audit"),
    getSystem: () => request<Record<string, unknown>>("/admin/system"),
    getStorage: () => request<{
      local: {
        rawDataBytes: number; rawDataGb: number; databaseBytes: number; databaseGb: number;
        diskUsedGb: number; diskTotalGb: number; diskFreeGb: number; diskPct: number;
      };
      s3: { connected: boolean; bucket?: string; totalGb?: number; objectCount?: number; partial?: boolean; error?: string };
      provider: string;
    }>("/admin/storage"),
    updateSystem: (key: string, value: unknown) =>
      request<{ success: boolean }>("/admin/system", { method: "PATCH", body: JSON.stringify({ key, value }) }),
    updateSystemBulk: (settings: Record<string, unknown>) =>
      request<{ success: boolean }>("/admin/system", { method: "PATCH", body: JSON.stringify({ settings }) }),
    testS3: (data: {
      provider?: string; region?: string; bucket: string; endpoint?: string;
      accessKeyId?: string; secretAccessKey?: string;
    }) =>
      request<{ success: boolean; message: string }>("/admin/system/test-s3", { method: "POST", body: JSON.stringify(data) }),
    testEmail: (data: {
      host?: string; smtpHost?: string; port?: number; encryption?: string;
      username?: string; password?: string; fromEmail?: string; fromName?: string; enabled?: boolean;
      testRecipient?: string;
    }) =>
      request<{ success: boolean; message: string }>("/admin/system/test-email", { method: "POST", body: JSON.stringify(data) }),
  },
};

export { ApiError };
