import { useState } from "react";
import { Camera, Save, Mail, User as UserIcon } from "lucide-react";

export function ProfileView() {
  const [name, setName] = useState("Dr. Sarah Chen");
  const [email, setEmail] = useState("sarah.chen@university.edu");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Account Settings</h2>
          <p className="text-sm text-muted-foreground">
            Manage your profile information and preferences
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-6 text-base font-medium">Profile Picture</h3>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-2xl font-semibold text-white">
                SC
              </div>
              <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg hover:shadow-xl">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Update your photo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG or GIF. Max size 2MB.
              </p>
              <div className="mt-3 flex gap-2">
                <button className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
                  Upload new photo
                </button>
                <button className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-6 text-base font-medium">
              Personal Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <UserIcon className="h-4 w-4" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  We'll send a verification email if you change your address
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-6 text-base font-medium">Change Password</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-sm font-medium">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              {saved && (
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Changes saved successfully!
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-xl border border-destructive/20 bg-gradient-to-br from-destructive/5 to-destructive/10 p-6">
          <h3 className="text-base font-medium text-destructive">
            Danger Zone
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Once you delete your account, there is no going back. Please be
            certain.
          </p>
          <button className="mt-4 rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
