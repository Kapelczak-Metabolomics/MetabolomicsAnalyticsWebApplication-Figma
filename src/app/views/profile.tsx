import { useState, useEffect } from "react";
import { Camera, Save, Mail, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/auth-context";

export function ProfileView() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getProfile().then((p) => {
      setName(p.name);
      setEmail(p.email);
    }).catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile({ name, email });
      setSaved(true);
      toast.success("Profile updated");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error("Failed to update profile");
    }
  };

  const initials = (name || user?.name || "U").split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Account Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your profile information and preferences</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-6 text-base font-medium">Profile Picture</h3>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-2xl font-semibold text-white">
                {initials}
              </div>
              <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg hover:shadow-xl">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Update your photo</p>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or GIF. Max size 2MB.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-6 text-base font-medium">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <UserIcon className="h-4 w-4" /> Full Name
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4" /> Email Address
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <input type="text" value={user?.role ?? ""} disabled
                  className="mt-1.5 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-6 py-2.5 text-sm font-medium text-white shadow-md hover:shadow-lg">
              <Save className="h-4 w-4" />
              {saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
