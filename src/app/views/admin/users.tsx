import { useState, useEffect } from "react";
import {
  Search, Plus, MoreVertical, Shield, Mail, Calendar,
  X, UserCog, KeyRound, Ban, Trash2, Send, CheckCircle2,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { api } from "../../../lib/api";

type Role = "Administrator" | "Researcher" | "Analyst" | "Viewer";
type Status = "active" | "inactive";

interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: Status;
  lastActive: string;
  projects: number;
}

const initialUsers: User[] = [];

const roleColors: Record<Role, string> = {
  Administrator: "text-violet-600 dark:text-violet-400",
  Researcher: "text-cyan-600 dark:text-cyan-400",
  Analyst: "text-emerald-600 dark:text-emerald-400",
  Viewer: "text-muted-foreground",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function AddUserDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (u: User) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Researcher");
  const [sending, setSending] = useState(false);

  function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      onAdd({
        id: Date.now(),
        name: name.trim(),
        email: email.trim(),
        role,
        status: "inactive",
        lastActive: "Never",
        projects: 0,
      });
      toast.success("Invitation sent", {
        description: `${email} will receive an activation email`,
      });
      setName("");
      setEmail("");
      setRole("Researcher");
      onClose();
    }, 1000);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-sm font-semibold">Add New User</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                An invitation email will be sent to the new user
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium">Full Name <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Smith"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Email Address <span className="text-destructive">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.smith@university.edu"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="Viewer">Viewer — read-only access</option>
                <option value="Analyst">Analyst — run analyses, view data</option>
                <option value="Researcher">Researcher — full project access</option>
                <option value="Administrator">Administrator — manage users & settings</option>
              </select>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">What happens next:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>An invitation email is sent to the address above</li>
                <li>User sets their password via the activation link</li>
                <li>Account is active after first login</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={sending}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-md hover:shadow-lg disabled:opacity-60"
            >
              {sending ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send Invitation
                </>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditRoleDialog({ user, open, onClose, onSave }: { user: User | null; open: boolean; onClose: () => void; onSave: (id: number, role: Role) => void }) {
  const [role, setRole] = useState<Role>(user?.role ?? "Researcher");

  if (!user) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-sm font-semibold">Change Role</Dialog.Title>
            <Dialog.Description className="sr-only">Change the role for {user.name}</Dialog.Description>
            <Dialog.Close asChild>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">Changing role for <strong>{user.name}</strong></p>
            {(["Viewer", "Analyst", "Researcher", "Administrator"] as Role[]).map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  role === r ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="sr-only"
                />
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${role === r ? "border-primary" : "border-border"}`}>
                  {role === r && <div className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${roleColors[r]}`}>{r}</p>
                  <p className="text-xs text-muted-foreground">
                    {r === "Viewer" && "Read-only access to shared projects"}
                    {r === "Analyst" && "Run analyses and view all project data"}
                    {r === "Researcher" && "Full project access, create & share"}
                    {r === "Administrator" && "Full access including user management"}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
            <button
              onClick={() => { onSave(user.id, role); onClose(); }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Save Role
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UserActions({ user, onRoleChange, onStatusToggle, onDelete }: {
  user: User;
  onRoleChange: (user: User) => void;
  onStatusToggle: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="rounded-lg p-1.5 hover:bg-accent">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[180px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
          sideOffset={4}
          align="end"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
            onSelect={() => toast.info(`Viewing profile: ${user.name}`)}
          >
            <Shield className="h-3.5 w-3.5" />
            View Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
            onSelect={() => onRoleChange(user)}
          >
            <UserCog className="h-3.5 w-3.5" />
            Change Role
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent"
            onSelect={() => {
              toast.success(`Password reset email sent to ${user.email}`);
            }}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Reset Password
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-accent text-muted-foreground"
            onSelect={() => onStatusToggle(user.id)}
          >
            <Ban className="h-3.5 w-3.5" />
            {user.status === "active" ? "Deactivate Account" : "Reactivate Account"}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-xs outline-none hover:bg-destructive/10 text-destructive"
            onSelect={() => onDelete(user.id, user.name)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete User
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getUsers()
      .then((data) => setUsers(data.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as Role,
        status: u.status as Status,
        lastActive: u.lastActive,
        projects: u.projects,
      }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "All Roles" || u.role === roleFilter;
    const matchStatus =
      statusFilter === "All Status" ||
      (statusFilter === "Active" && u.status === "active") ||
      (statusFilter === "Inactive" && u.status === "inactive");
    return matchSearch && matchRole && matchStatus;
  });

  function handleAdd(newUser: User) {
    api.admin.createUser({ name: newUser.name, email: newUser.email, role: newUser.role })
      .then(() => setUsers((prev) => [newUser, ...prev]))
      .catch(() => toast.error("Failed to create user"));
  }

  function handleRoleChange(id: number, role: Role) {
    api.admin.updateUser(id, { role })
      .then(() => {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
        toast.success("Role updated successfully");
      })
      .catch(() => toast.error("Failed to update role"));
  }

  function handleStatusToggle(id: number) {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    const newStatus = user.status === "active" ? "inactive" : "active";
    api.admin.updateUser(id, { status: newStatus })
      .then(() => {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u)));
        toast.success(`${user.name} ${newStatus === "active" ? "reactivated" : "deactivated"}`);
      })
      .catch(() => toast.error("Failed to update status"));
  }

  function handleDelete(id: number, name: string) {
    api.admin.deleteUser(id)
      .then(() => {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        toast.success(`${name} deleted`);
      })
      .catch(() => toast.error("Failed to delete user"));
  }

  const activeCount = users.filter((u) => u.status === "active").length;
  const adminCount = users.filter((u) => u.role === "Administrator").length;

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <EditRoleDialog
        user={editUser}
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditUser(null); }}
        onSave={handleRoleChange}
      />

      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">User Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage user accounts, roles, and permissions
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: users.length.toLocaleString() },
            { label: "Active Today", value: activeCount.toString() },
            { label: "New This Month", value: "47" },
            { label: "Admins", value: adminCount.toString() },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
          >
            <option>All Roles</option>
            <option>Administrator</option>
            <option>Researcher</option>
            <option>Analyst</option>
            <option>Viewer</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none"
          >
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="p-3 text-left font-medium">User</th>
                  <th className="p-3 text-left font-medium">Role</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Projects</th>
                  <th className="p-3 text-left font-medium">Last Active</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                      No users match your filters
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => (
                    <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-semibold text-white">
                            {initials(user.name)}
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={`text-sm font-medium ${roleColors[user.role]}`}>
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${user.status === "active" ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                          {user.status}
                        </span>
                      </td>
                      <td className="p-3 tabular-nums text-muted-foreground">{user.projects}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {user.lastActive}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <UserActions
                          user={user}
                          onRoleChange={(u) => { setEditUser(u); setEditOpen(true); }}
                          onStatusToggle={handleStatusToggle}
                          onDelete={handleDelete}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              Showing {filtered.length} of {users.length} users
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
