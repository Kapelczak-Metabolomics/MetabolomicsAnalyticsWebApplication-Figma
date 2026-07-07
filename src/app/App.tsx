import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./components/theme-provider";
import { Sidebar } from "./components/sidebar";
import { TopBar } from "./components/top-bar";
import { Dashboard } from "./views/dashboard";
import { PCAView } from "./views/pca";
import { PLSDAView } from "./views/plsda";
import { VolcanoView } from "./views/volcano";
import { ClusteringView } from "./views/clustering";
import { PathwayView } from "./views/pathway";
import { BiomarkerView } from "./views/biomarker";
import { DataTableView } from "./views/data-table";
import { LoginView } from "./views/login";
import { ForgotPasswordView } from "./views/forgot-password";
import { ResetPasswordView } from "./views/reset-password";
import { ProfileView } from "./views/profile";
import { SettingsView } from "./views/settings";
import { ProjectsView } from "./views/projects";
import { ExperimentDetailView } from "./views/experiment-detail";
import { DataImportView } from "./views/data-import";
import { NotificationsView } from "./views/notifications";
import { HelpView } from "./views/help";
import { ProjectDetailView } from "./views/project-detail";
import { AdminDashboard } from "./views/admin/dashboard";
import { AdminUsers } from "./views/admin/users";
import { AdminSystem } from "./views/admin/system";
import { AdminLogs } from "./views/admin/logs";
import { AdminRuns } from "./views/admin/runs";
import { AdminAudit } from "./views/admin/audit";
import { AuthProvider, ProtectedRoute, AdminRoute } from "../contexts/auth-context";
import { AppProvider } from "../contexts/app-context";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminRoute>
        <AppLayout>{children}</AppLayout>
      </AdminRoute>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppProvider>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route path="/forgot-password" element={<ForgotPasswordView />} />
            <Route path="/reset-password" element={<ResetPasswordView />} />
            <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/pca" element={<ProtectedLayout><PCAView /></ProtectedLayout>} />
            <Route path="/plsda" element={<ProtectedLayout><PLSDAView /></ProtectedLayout>} />
            <Route path="/volcano" element={<ProtectedLayout><VolcanoView /></ProtectedLayout>} />
            <Route path="/clustering" element={<ProtectedLayout><ClusteringView /></ProtectedLayout>} />
            <Route path="/pathway" element={<ProtectedLayout><PathwayView /></ProtectedLayout>} />
            <Route path="/biomarker" element={<ProtectedLayout><BiomarkerView /></ProtectedLayout>} />
            <Route path="/data" element={<ProtectedLayout><DataTableView /></ProtectedLayout>} />
            <Route path="/data/import" element={<ProtectedLayout><DataImportView /></ProtectedLayout>} />
            <Route path="/projects" element={<ProtectedLayout><ProjectsView /></ProtectedLayout>} />
            <Route path="/projects/:id" element={<ProtectedLayout><ProjectDetailView /></ProtectedLayout>} />
            <Route path="/experiments/:id" element={<ProtectedLayout><ExperimentDetailView /></ProtectedLayout>} />
            <Route path="/notifications" element={<ProtectedLayout><NotificationsView /></ProtectedLayout>} />
            <Route path="/help" element={<ProtectedLayout><HelpView /></ProtectedLayout>} />
            <Route path="/profile" element={<ProtectedLayout><ProfileView /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><SettingsView /></ProtectedLayout>} />
            <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
            <Route path="/admin/system" element={<AdminLayout><AdminSystem /></AdminLayout>} />
            <Route path="/admin/logs" element={<AdminLayout><AdminLogs /></AdminLayout>} />
            <Route path="/admin/runs" element={<AdminLayout><AdminRuns /></AdminLayout>} />
            <Route path="/admin/audit" element={<AdminLayout><AdminAudit /></AdminLayout>} />
          </Routes>
          </AppProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: { fontSize: "12px" },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
