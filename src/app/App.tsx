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

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/forgot-password" element={<ForgotPasswordView />} />
          <Route
            path="/"
            element={
              <AppLayout>
                <Dashboard />
              </AppLayout>
            }
          />
          <Route
            path="/pca"
            element={
              <AppLayout>
                <PCAView />
              </AppLayout>
            }
          />
          <Route
            path="/plsda"
            element={
              <AppLayout>
                <PLSDAView />
              </AppLayout>
            }
          />
          <Route
            path="/volcano"
            element={
              <AppLayout>
                <VolcanoView />
              </AppLayout>
            }
          />
          <Route
            path="/clustering"
            element={
              <AppLayout>
                <ClusteringView />
              </AppLayout>
            }
          />
          <Route
            path="/pathway"
            element={
              <AppLayout>
                <PathwayView />
              </AppLayout>
            }
          />
          <Route
            path="/biomarker"
            element={
              <AppLayout>
                <BiomarkerView />
              </AppLayout>
            }
          />
          <Route
            path="/data"
            element={
              <AppLayout>
                <DataTableView />
              </AppLayout>
            }
          />
          <Route
            path="/data/import"
            element={
              <AppLayout>
                <DataImportView />
              </AppLayout>
            }
          />
          <Route
            path="/projects"
            element={
              <AppLayout>
                <ProjectsView />
              </AppLayout>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <AppLayout>
                <ProjectDetailView />
              </AppLayout>
            }
          />
          <Route
            path="/experiments/:id"
            element={
              <AppLayout>
                <ExperimentDetailView />
              </AppLayout>
            }
          />
          <Route
            path="/notifications"
            element={
              <AppLayout>
                <NotificationsView />
              </AppLayout>
            }
          />
          <Route
            path="/help"
            element={
              <AppLayout>
                <HelpView />
              </AppLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <AppLayout>
                <ProfileView />
              </AppLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <AppLayout>
                <SettingsView />
              </AppLayout>
            }
          />
          <Route
            path="/admin"
            element={
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AppLayout>
                <AdminUsers />
              </AppLayout>
            }
          />
          <Route
            path="/admin/system"
            element={
              <AppLayout>
                <AdminSystem />
              </AppLayout>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <AppLayout>
                <AdminLogs />
              </AppLayout>
            }
          />
          <Route
            path="/admin/runs"
            element={
              <AppLayout>
                <AdminRuns />
              </AppLayout>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <AppLayout>
                <AdminAudit />
              </AppLayout>
            }
          />
        </Routes>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { fontSize: "12px" },
          }}
        />
      </BrowserRouter>
    </ThemeProvider>
  );
}
