import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Plus,
  Search,
  Calendar,
  Users,
  Database,
  MoreVertical,
  X,
  FolderOpen,
  ArchiveRestore,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { api } from "../../lib/api";

const colorMap: Record<string, string> = {
  violet: "from-violet-500 to-violet-600",
  cyan: "from-cyan-500 to-cyan-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
};

type Project = Awaited<ReturnType<typeof api.getProjects>>[number];
type Experiment = Awaited<ReturnType<typeof api.getExperiments>>[number];

function NewProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (project: Project) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("metabolomics");

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    api.createProject({ name, description, type })
      .then((project) => {
        onCreated({
          id: project.id,
          name: project.name,
          description: description || "New project",
          datasets: 0,
          samples: 0,
          lastModified: "just now",
          status: "active",
          color: project.color,
        });
        setName("");
        setDescription("");
        onClose();
        toast.success(`Project "${name}" created successfully`);
      })
      .catch(() => toast.error("Failed to create project"));
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-sm font-semibold">New Project</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground mt-0.5">Create a new research project</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium">Project Name <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ADNI Metabolomics Study"
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the study design and goals..."
                rows={3}
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Study Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
                >
                  <option value="metabolomics">Metabolomics</option>
                  <option value="lipidomics">Lipidomics</option>
                  <option value="proteomics">Proteomics</option>
                  <option value="multi-omics">Multi-omics</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Color Theme</label>
                <div className="mt-1.5 flex items-center gap-2">
                  {["violet", "cyan", "emerald", "amber", "rose"].map((c) => (
                    <button
                      key={c}
                      className={`h-6 w-6 rounded-full bg-gradient-to-br ${colorMap[c]} ring-offset-background hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Collaborators</label>
              <input
                type="text"
                placeholder="Enter email addresses to share..."
                className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:shadow-lg"
            >
              Create Project
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ProjectsView() {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.getProjects(), api.getExperiments()])
      .then(([p, e]) => {
        setProjects(p);
        setExperiments(e);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(project: Project) {
    setProjects((prev) => [project, ...prev]);
  }

  function archiveProject(id: number, name: string) {
    api.updateProject(id, { status: "archived" })
      .then(() => {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: "archived" } : p)));
        toast.success(`"${name}" archived`);
      })
      .catch(() => toast.error("Failed to archive project"));
  }

  function restoreProject(id: number, name: string) {
    api.updateProject(id, { status: "active" })
      .then(() => {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: "active" } : p)));
        toast.success(`"${name}" restored`);
      })
      .catch(() => toast.error("Failed to restore project"));
  }

  function deleteProject(id: number, name: string) {
    api.deleteProject(id)
      .then(() => {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        toast.success(`"${name}" deleted`);
      })
      .catch(() => toast.error("Failed to delete project"));
  }

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  const activeProjects = filtered.filter((p) => p.status === "active");
  const archivedProjects = filtered.filter((p) => p.status === "archived");

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={handleCreated}
      />

      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Projects & Experiments</h2>
            <p className="text-sm text-muted-foreground">
              Manage your research projects and analysis experiments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/data/import"
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Database className="h-4 w-4" />
              Import Data
            </Link>
            <button
              onClick={() => setNewProjectOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects and experiments..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Active Projects */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Active Projects ({activeProjects.length})</h3>
          {activeProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No active projects found</p>
              <button
                onClick={() => setNewProjectOpen(true)}
                className="mt-3 rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90"
              >
                Create a project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {activeProjects.map((project) => (
                <div
                  key={project.id}
                  className="group rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`mt-1 h-10 w-10 flex-shrink-0 rounded-lg bg-gradient-to-br ${colorMap[project.color] ?? colorMap.violet} flex items-center justify-center`}
                      >
                        <Database className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium group-hover:text-primary truncate">{project.name}</h4>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {project.datasets} datasets
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {project.samples} samples
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {project.lastModified}
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="rounded-lg p-1 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
                          sideOffset={4}
                          align="end"
                        >
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                            onSelect={() => toast.info(`Opening ${project.name}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open project
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                            onSelect={() => toast.info("Opening project settings...")}
                          >
                            <Database className="h-3.5 w-3.5" />
                            Settings
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent text-muted-foreground"
                            onSelect={() => archiveProject(project.id, project.name)}
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            Archive
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-destructive/10 text-destructive"
                            onSelect={() => deleteProject(project.id, project.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Experiments */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Recent Experiments</h3>
          <div className="rounded-xl border border-border bg-card">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">Project</th>
                    <th className="p-3 text-left font-medium">Type</th>
                    <th className="p-3 text-left font-medium">Created</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {experiments.map((exp) => (
                    <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-medium">{exp.name}</td>
                      <td className="p-3 text-muted-foreground">{exp.project}</td>
                      <td className="p-3">
                        <span className="inline-flex rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                          {exp.type}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{exp.created}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            exp.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : exp.status === "running"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {exp.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => navigate(`/experiments/${exp.id}`)}
                          className="rounded-lg border border-border bg-background px-3 py-1 text-xs hover:bg-accent"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Archived Projects */}
        {archivedProjects.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Archived Projects ({archivedProjects.length})
            </h3>
            <div className="space-y-2">
              {archivedProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3 opacity-60 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">Last modified {project.lastModified}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => restoreProject(project.id, project.name)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1 text-xs hover:bg-accent"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Restore
                    </button>
                    <button
                      onClick={() => deleteProject(project.id, project.name)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1 text-xs hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
