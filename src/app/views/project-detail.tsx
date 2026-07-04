import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeft, Database, Users, FlaskConical, Settings, Plus,
  Upload, MoreVertical, Trash2, Download, ExternalLink,
  Calendar, Clock, CheckCircle2, Loader2, AlertCircle,
  X, UserPlus, Shield, Mail, Edit3, Archive,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { downloadFromApi } from "../../lib/export";
import { useAuth } from "../../contexts/auth-context";

const colorMap: Record<string, string> = {
  violet: "from-violet-500 to-violet-600",
  cyan: "from-cyan-500 to-cyan-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
};

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    running: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    failed: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    processing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    archived: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {status === "completed" || status === "ready" ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
      {status === "failed" && <AlertCircle className="h-2.5 w-2.5" />}
      {status}
    </span>
  );
}

// ─── Add Member Dialog ───────────────────────────────────────────────────────

function AddMemberDialog({ open, onClose, projectId, onAdd }: {
  open: boolean; onClose: () => void; projectId: number;
  onAdd: (m: { id: number; name: string; email: string; role: string; joined: string; avatar: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");

  async function handleAdd() {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      toast.error("Enter a valid email address"); return;
    }
    try {
      const { id } = await api.inviteMember(projectId, { email: email.trim(), role });
      const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      onAdd({ id, name, email: email.trim(), role, joined: "Just now", avatar: name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() });
      toast.success(`Invitation sent to ${email}`);
      setEmail(""); setRole("viewer"); onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">Add Member</Dialog.Title>
            <Dialog.Description className="sr-only">Invite a collaborator to this project</Dialog.Description>
            <Dialog.Close asChild><button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button></Dialog.Close>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@institution.edu"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-medium">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                <option value="viewer">Viewer — read-only</option>
                <option value="analyst">Analyst — run analyses</option>
                <option value="researcher">Researcher — full access</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
            <button onClick={handleAdd} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <UserPlus className="h-3.5 w-3.5" /> Send Invite
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function ProjectDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Awaited<ReturnType<typeof api.getProject>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string; type: string; samples: number; features: number; created: string; status: string }>>([]);
  const [experiments, setExperiments] = useState<Array<{ id: string; name: string; type: string; status: string; created: string }>>([]);
  const [members, setMembers] = useState<Array<{ id: number; name: string; email: string; role: string; joined: string; avatar: string }>>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "datasets";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!id) return;
    api.getProject(id)
      .then((p) => {
        setProject(p);
        setDatasets(p.datasets);
        setExperiments(p.experiments);
        setProjectName(p.name);
        setProjectDesc(p.description);
        setMembers((p.members ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
          joined: m.joined,
          avatar: m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
        })));
      })
      .catch(() => navigate("/projects"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function removeDataset(did: string) {
    try {
      await api.deleteDataset(parseInt(did, 10));
      setDatasets((prev) => prev.filter((d) => d.id !== did));
      toast.success("Dataset removed from project");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function removeMember(mid: number) {
    if (!id || mid === 0) return;
    try {
      await api.removeMember(parseInt(id, 10), mid);
      setMembers((prev) => prev.filter((m) => m.id !== mid));
      toast.success("Member removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    }
  }

  async function changeMemberRole(mid: number, role: string) {
    if (!id) return;
    try {
      await api.updateMember(parseInt(id, 10), mid, { role: role.toLowerCase() });
      setMembers((prev) => prev.map((m) => m.id === mid ? { ...m, role } : m));
      toast.success("Member role updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Role update failed");
    }
  }

  async function saveSettings() {
    if (!id) return;
    try {
      await api.updateProject(parseInt(id, 10), { name: projectName, description: projectDesc });
      toast.success("Project settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function archiveProject() {
    if (!id) return;
    try {
      await api.updateProject(parseInt(id, 10), { status: "archived" });
      toast.success("Project archived");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  }

  async function deleteProject() {
    if (!id) return;
    try {
      await api.deleteProject(parseInt(id, 10));
      toast.success("Project deleted");
      navigate("/projects");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (loading || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const gradientColor = colorMap[project.color] ?? colorMap.violet;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
      <AddMemberDialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} projectId={project.id}
        onAdd={(m) => setMembers((prev) => [...prev, m])} />

      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate("/projects")}
              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className={`mt-0.5 h-10 w-10 flex-shrink-0 rounded-lg bg-gradient-to-br ${gradientColor} flex items-center justify-center`}>
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{project.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Metabolomics</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{project.status}</span>
              </div>
              <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground line-clamp-1">{project.description}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Project #{project.id}</span>
                <span>·</span>
                <span>Owner: {user?.name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/data/import" className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
              <Upload className="h-3.5 w-3.5" /> Import Data
            </Link>
            <Link to="/pca" className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1.5 text-xs font-medium text-white">
              <FlaskConical className="h-3.5 w-3.5" /> New Analysis
            </Link>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 border-b border-border bg-card/30 px-6 py-4">
        {[
          { icon: Database, label: "Datasets", value: datasets.length, color: "text-violet-500" },
          { icon: Users, label: "Samples", value: datasets.reduce((a, d) => a + d.samples, 0).toLocaleString(), color: "text-cyan-500" },
          { icon: FlaskConical, label: "Experiments", value: experiments.length, color: "text-emerald-500" },
          { icon: Users, label: "Members", value: members.length, color: "text-amber-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-auto">
        <div className="border-b border-border bg-card/20 px-6">
          <Tabs.List className="flex gap-0 -mb-px">
            {[
              { value: "datasets", label: "Datasets", icon: Database },
              { value: "experiments", label: "Experiments", icon: FlaskConical },
              { value: "members", label: "Members", icon: Users },
              { value: "settings", label: "Settings", icon: Settings },
            ].map(({ value, label, icon: Icon }) => (
              <Tabs.Trigger key={value} value={value}
                className="flex items-center gap-1.5 border-b-2 border-transparent px-4 py-3 text-xs font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground transition-colors">
                <Icon className="h-3.5 w-3.5" />{label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>

        {/* ── Datasets ─────────────────────────────────────────────────────── */}
        <Tabs.Content value="datasets" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Datasets ({datasets.length})</h3>
            <Link to="/data/import" className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> Import Dataset
            </Link>
          </div>
          <div className="space-y-2">
            {datasets.map((ds) => (
              <div key={ds.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
                    <Database className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ds.name}</p>
                    <p className="text-xs text-muted-foreground">{ds.type} · {ds.samples.toLocaleString()} samples · {ds.features.toLocaleString()} features</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" />{ds.created}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip status={ds.status} />
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button className="rounded-lg p-1.5 hover:bg-accent"><MoreVertical className="h-4 w-4" /></button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className="z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
                        <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                          onSelect={() => navigate(`/data`)}>
                          <ExternalLink className="h-3.5 w-3.5" /> View in Data Table
                        </DropdownMenu.Item>
                        <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                          onSelect={() => downloadFromApi(`/datasets/${ds.id}/download`, `${ds.name}.csv`)}>
                          <Download className="h-3.5 w-3.5" /> Download
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator className="my-1 h-px bg-border" />
                        <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-destructive/10 text-destructive"
                          onSelect={() => removeDataset(ds.id)}>
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>
            ))}
          </div>
        </Tabs.Content>

        {/* ── Experiments ──────────────────────────────────────────────────── */}
        <Tabs.Content value="experiments" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Experiments ({experiments.length})</h3>
            <Link to="/pca" className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> New Experiment
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="p-3 text-left text-xs font-medium">Experiment</th>
                  <th className="p-3 text-left text-xs font-medium">Type</th>
                  <th className="p-3 text-left text-xs font-medium">Run by</th>
                  <th className="p-3 text-left text-xs font-medium">Created</th>
                  <th className="p-3 text-left text-xs font-medium">Duration</th>
                  <th className="p-3 text-left text-xs font-medium">Status</th>
                  <th className="p-3 text-right text-xs font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => (
                  <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-sm">{exp.name}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">{exp.type}</span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{user?.name}</td>
                    <td className="p-3 text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{exp.created}</td>
                    <td className="p-3 text-xs tabular-nums text-muted-foreground">—</td>
                    <td className="p-3"><StatusChip status={exp.status} /></td>
                    <td className="p-3 text-right">
                      <button onClick={() => navigate(`/experiments/${exp.id}`)}
                        className="rounded border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tabs.Content>

        {/* ── Members ──────────────────────────────────────────────────────── */}
        <Tabs.Content value="members" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Members ({members.length})</h3>
            <button onClick={() => setAddMemberOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              <UserPlus className="h-3.5 w-3.5" /> Add Member
            </button>
          </div>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-semibold text-white">
                    {m.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={`text-xs font-medium ${m.role === "Owner" ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`}>{m.role}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Joined {m.joined}</span>
                  {m.role !== "Owner" && (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="rounded p-1 hover:bg-accent"><MoreVertical className="h-4 w-4" /></button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="z-50 min-w-[150px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg" sideOffset={4} align="end">
                          {["Viewer", "Analyst", "Researcher"].map((role) => (
                            <DropdownMenu.Item key={role} className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                              onSelect={() => changeMemberRole(m.id, role)}>
                              <Shield className="h-3.5 w-3.5" /> Set as {role}
                            </DropdownMenu.Item>
                          ))}
                          <DropdownMenu.Separator className="my-1 h-px bg-border" />
                          <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-destructive/10 text-destructive"
                            onSelect={() => removeMember(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Tabs.Content>

        {/* ── Settings ─────────────────────────────────────────────────────── */}
        <Tabs.Content value="settings" className="p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Project Details</h3>
              <div>
                <label className="text-xs font-medium">Project Name</label>
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs font-medium">Description</label>
                <textarea value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} rows={3}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium">Study Type</label>
                  <select defaultValue="metabolomics" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                    <option>Metabolomics</option><option>Lipidomics</option><option>Proteomics</option><option>Multi-omics</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Visibility</label>
                  <select defaultValue="team" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                    <option>Private</option><option>Team</option><option>Organization</option>
                  </select>
                </div>
              </div>
              <button onClick={saveSettings}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Save Changes
              </button>
            </div>

            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
              <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-background p-3">
                <div>
                  <p className="text-sm font-medium">Archive Project</p>
                  <p className="text-xs text-muted-foreground">Disable analysis and hide from active list</p>
                </div>
                <button onClick={archiveProject}
                  className="flex items-center gap-1.5 rounded border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-background p-3">
                <div>
                  <p className="text-sm font-medium">Delete Project</p>
                  <p className="text-xs text-muted-foreground">Permanently remove this project and all its data</p>
                </div>
                <button onClick={deleteProject}
                  className="flex items-center gap-1.5 rounded bg-destructive px-3 py-1.5 text-xs text-white hover:bg-destructive/90">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
