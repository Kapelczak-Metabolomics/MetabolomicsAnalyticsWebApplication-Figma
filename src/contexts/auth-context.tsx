import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { api, setToken, ApiError } from "../lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  isAdmin: boolean;
}

async function loadAvatarUrl(): Promise<string | null> {
  try {
    const prefs = await api.getPreferences();
    return typeof prefs.avatarUrl === "string" ? prefs.avatarUrl : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.me()
      .then(async ({ user }) => {
        const avatarUrl = await loadAvatarUrl();
        setUser({ ...user, avatarUrl });
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
    navigate("/");
    const avatarUrl = await loadAvatarUrl();
    setUser((prev) => (prev ? { ...prev, avatarUrl } : { ...user, avatarUrl }));
  }, [navigate]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    navigate("/login");
  }, [navigate]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isAdmin: user?.role === "Administrator" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [isAdmin, loading, navigate]);

  if (loading || !isAdmin) return null;
  return <>{children}</>;
}

export { ApiError };
