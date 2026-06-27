import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
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

// ─── shared data ────────────────────────────────────────────────────────────

const projectsData: Record<string, {
  id: string; name: string; description: string; color: string;
  type: string; created: string; owner: string; visibility: string;
  datasets: { id: string; name: string; type: string; samples: number; features: number; created: string; status: string }[];
  experiments: { id: string; name: string; type: string; status: string; created: string; user: string; duration: string }[];
  members: { id: number; name: string; email: string; role: string; joined: string; avatar: string }[];
}> = {
  "1": {
    id: "1", name: "ADNI Metabolomics Study", description: "Alzheimer's Disease Neuroimaging Initiative metabolomics analysis of plasma and serum samples from AD patients and age-matched controls.",
    color: "from-violet-500 to-violet-600", type: "Metabolomics", created: "Jan 12, 2025", owner: "Dr. Sarah Chen", visibility: "Team",
    datasets: [
      { id: "d1", name: "Plasma Samples (ADNI v3)", type: "Plasma LC-MS", samples: 342, features: 1247, created: "Jan 15, 2025", status: "ready" },
      { id: "d2", name: "Serum Samples (ADNI v2)", type: "Serum GC-MS", samples: 287, features: 843, created: "Feb 3, 2025", status: "ready" },
      { id: "d3", name: "Urine Samples (Pilot)", type: "Urine NMR", samples: 156, features: 412, created: "Mar 1, 2025", status: "processing" },
    ],
    experiments: [
      { id: "1", name: "PCA - AD vs Control", type: "PCA", status: "completed", created: "3 hours ago", user: "Dr. Sarah Chen", duration: "2m 14s" },
      { id: "3", name: "PLS-DA Classification", type: "PLS-DA", status: "running", created: "1 day ago", user: "Dr. Sarah Chen", duration: "—" },
      { id: "e3", name: "Volcano Analysis v2", type: "Volcano", status: "completed", created: "3 days ago", user: "Dr. John Smith", duration: "1m 47s" },
      { id: "e4", name: "Pathway Enrichment - Plasma", type: "Pathway", status: "completed", created: "1 week ago", user: "Dr. Sarah Chen", duration: "3m 02s" },
    ],
    members: [
      { id: 1, name: "Dr. Sarah Chen", email: "sarah.chen@university.edu", role: "Owner", joined: "Jan 12, 2025", avatar: "SC" },
      { id: 2, name: "Dr. John Smith", email: "john.smith@research.org", role: "Researcher", joined: "Jan 18, 2025", avatar: "JS" },
      { id: 3, name: "Michael Brown", email: "m.brown@university.edu", role: "Analyst", joined: "Feb 5, 2025", avatar: "MB" },
    ],
  },
  "2": {
    id: "2", name: "Cancer Biomarker Panel", description: "Multi-cancer detection using plasma metabolite signatures from matched cases and controls across 5 cancer types.",
    color: "from-cyan-500 to-cyan-600", type: "Lipidomics", created: "Nov 3, 2024", owner: "Dr. Michael Torres", visibility: "Private",
    datasets: [
      { id: "d1", name: "Plasma LC-MS Positive", type: "Plasma LC-MS", samples: 487, features: 2341, created: "Nov 5, 2024", status: "ready" },
      { id: "d2", name: "Plasma LC-MS Negative", type: "Plasma LC-MS", samples: 487, features: 1876, created: "Nov 5, 2024", status: "ready" },
      { id: "d3", name: "Validation Cohort", type: "Serum LC-MS", samples: 198, features: 1203, created: "Jan 8, 2025", status: "ready" },
      { id: "d4", name: "External Replication", type: "Plasma NMR", samples: 312, features: 564, created: "Feb 20, 2025", status: "ready" },
      { id: "d5", name: "Pilot Study (archive)", type: "Plasma GC-MS", samples: 89, features: 423, created: "Aug 12, 2024", status: "archived" },
    ],
    experiments: [
      { id: "2", name: "Volcano Analysis - Plasma", type: "Volcano", status: "completed", created: "5 hours ago", user: "Dr. Michael Torres", duration: "1m 47s" },
      { id: "e2", name: "PLS-DA Multi-class", type: "PLS-DA", status: "completed", created: "2 days ago", user: "Dr. Emily Wang", duration: "8m 33s" },
      { id: "e3", name: "Biomarker Candidates", type: "Biomarker", status: "completed", created: "4 days ago", user: "Dr. Michael Torres", duration: "4m 12s" },
    ],
    members: [
      { id: 1, name: "Dr. Michael Torres", email: "m.torres@biotech.com", role: "Owner", joined: "Nov 3, 2024", avatar: "MT" },
      { id: 2, name: "Dr. Emily Wang", email: "emily.wang@lab.edu", role: "Researcher", joined: "Nov 10, 2024", avatar: "EW" },
      { id: 3, name: "Dr. Sarah Chen", email: "sarah.chen@university.edu", role: "Viewer", joined: "Jan 22, 2025", avatar: "SC" },
    ],
  },
};

const fallbackProject = projectsData["1"];

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

function AddMemberDialog({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void;
  onAdd: (m: { id: number; name: string; email: string; role: string; joined: string; avatar: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Researcher");

  function handleAdd() {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      toast.error("Enter a valid email address"); return;
    }
    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    onAdd({ id: Date.now(), name, email: email.trim(), role, joined: "Just now", avatar: name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() });
    toast.success(`Invitation sent to ${email}`);
    setEmail(""); setRole("Researcher"); onClose();
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
                <option value="Viewer">Viewer — read-only</option>
                <option value="Analyst">Analyst — run analyses</option>
                <option value="Researcher">Researcher — full access</option>
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
  const project = projectsData[id ?? "1"] ?? fallbackProject;

  const [datasets, setDatasets] = useState(project.datasets);
  const [experiments] = useState(project.experiments);
  const [members, setMembers] = useState(project.members);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const [projectDesc, setProjectDesc] = useState(project.description);

  function removeDataset(did: string) {
    setDatasets((prev) => prev.filter((d) => d.id !== did));
    toast.success("Dataset removed from project");
  }

  function removeMember(mid: number) {
    setMembers((prev) => prev.filter((m) => m.id !== mid));
    toast.success("Member removed");
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20">
      <AddMemberDialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)}
        onAdd={(m) => setMembers((prev) => [...prev, m])} />

      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate("/projects")}
              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className={`mt-0.5 h-10 w-10 flex-shrink-0 rounded-lg bg-gradient-to-br ${project.color} flex items-center justify-center`}>
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{project.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{project.type}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{project.visibility}</span>
              </div>
              <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground line-clamp-1">{project.description}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Created {project.created}</span>
                <span>·</span>
                <span>Owner: {project.owner}</span>
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
      <Tabs.Root defaultValue="datasets" className="flex flex-col h-auto">
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
                          onSelect={() => toast.success(`Downloading ${ds.name}`)}>
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
                    <td className="p-3 text-xs text-muted-foreground">{exp.user}</td>
                    <td className="p-3 text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{exp.created}</td>
                    <td className="p-3 text-xs tabular-nums text-muted-foreground">{exp.duration}</td>
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
                          <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
                            onSelect={() => toast.info(`Changing role for ${m.name}`)}>
                            <Shield className="h-3.5 w-3.5" /> Change Role
                          </DropdownMenu.Item>
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
                  <select defaultValue={project.type} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                    <option>Metabolomics</option><option>Lipidomics</option><option>Proteomics</option><option>Multi-omics</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Visibility</label>
                  <select defaultValue={project.visibility} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                    <option>Private</option><option>Team</option><option>Organization</option>
                  </select>
                </div>
              </div>
              <button onClick={() => toast.success("Project settings saved")}
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
                <button onClick={() => toast.info("Project archived")}
                  className="flex items-center gap-1.5 rounded border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-background p-3">
                <div>
                  <p className="text-sm font-medium">Delete Project</p>
                  <p className="text-xs text-muted-foreground">Permanently remove this project and all its data</p>
                </div>
                <button onClick={() => toast.error("Deletion requires confirmation from project owner")}
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
