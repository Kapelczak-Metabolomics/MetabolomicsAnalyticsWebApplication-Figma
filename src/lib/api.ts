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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; name: string; email: string; role: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: { id: number; name: string; email: string; role: string } }>("/auth/me"),

  getProjects: () => request<Array<{
    id: number; name: string; description: string; datasets: number; samples: number;
    lastModified: string; status: string; color: string;
  }>>("/projects"),

  getProject: (id: string) => request<{
    id: number; name: string; description: string; status: string; color: string;
    datasets: Array<{ id: string; name: string; type: string; samples: number; features: number; created: string; status: string }>;
    experiments: Array<{ id: string; name: string; type: string; status: string; created: string }>;
  }>(`/projects/${id}`),

  createProject: (data: { name: string; description?: string; type?: string }) =>
    request<{ id: number; name: string; color: string }>("/projects", { method: "POST", body: JSON.stringify(data) }),

  deleteProject: (id: number) => request<{ success: boolean }>(`/projects/${id}`, { method: "DELETE" }),

  updateProject: (id: number, data: { name?: string; description?: string; status?: string }) =>
    request<{ success: boolean }>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getDatasets: () => request<Array<{ id: number; name: string; type: string; samples_count: number; features_count: number; status: string; project_id: number; project_name: string }>>("/datasets"),

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
    request<Array<{ id: string; name: string; project: string; type: string; created: string; status: string }>>(
      `/experiments${projectId ? `?projectId=${projectId}` : ""}`
    ),

  getExperiment: (id: number) => request<Record<string, unknown>>(`/experiments/${id}`),

  runAnalysis: (data: { projectId: number; datasetId: number; name: string; type: string; config?: unknown }) =>
    request<{ id: number; status: string }>("/experiments/run", { method: "POST", body: JSON.stringify(data) }),

  getNotifications: () => request<Array<{
    id: number; type: string; title: string; message: string; time: string; read: boolean; link?: string; linkLabel?: string;
  }>>("/notifications"),

  markNotificationRead: (id: number) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: "PATCH" }),

  markAllNotificationsRead: () => request<{ success: boolean }>("/notifications/read-all", { method: "PATCH" }),

  deleteNotification: (id: number) => request<{ success: boolean }>(`/notifications/${id}`, { method: "DELETE" }),

  getDashboard: (projectId?: number) =>
    request<{
      projectName: string; datasetName: string; datasetId: number | null;
      kpis: { totalMetabolites: number; samplesAnalyzed: number; significantFeatures: number; modelAccuracy: number };
      recentAnalyses: Array<{ title: string; type: string; href: string; lastRun: string }>;
      status: string;
    }>(`/dashboard${projectId ? `?projectId=${projectId}` : ""}`),

  getProfile: () => request<{ id: number; name: string; email: string; role: string }>("/profile"),

  updateProfile: (data: { name?: string; email?: string }) =>
    request<{ success: boolean }>("/profile", { method: "PATCH", body: JSON.stringify(data) }),

  admin: {
    getStats: () => request<{ totalUsers: number; activeProjects: number; runningAnalyses: number; systemAlerts: number; uptime: string }>("/admin/stats"),
    getActivity: () => request<Array<{ user: string; action: string; time: string }>>("/admin/activity"),
    getUsers: () => request<Array<{ id: number; name: string; email: string; role: string; status: string; lastActive: string; projects: number }>>("/admin/users"),
    createUser: (data: { name: string; email: string; role: string }) =>
      request<{ id: number }>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
    updateUser: (id: number, data: { role?: string; status?: string }) =>
      request<{ success: boolean }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteUser: (id: number) => request<{ success: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
    getRuns: () => request<Array<Record<string, unknown>>>("/admin/runs"),
    getLogs: () => request<Array<Record<string, unknown>>>("/admin/logs"),
    getAudit: () => request<Array<Record<string, unknown>>>("/admin/audit"),
    getSystem: () => request<Record<string, unknown>>("/admin/system"),
    updateSystem: (key: string, value: unknown) =>
      request<{ success: boolean }>("/admin/system", { method: "PATCH", body: JSON.stringify({ key, value }) }),
  },
};

export { ApiError };
