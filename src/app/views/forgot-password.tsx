import { Link } from "react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";

export function ForgotPasswordView() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {submitted ? "Check your email for reset instructions" : "Enter your email to receive a reset link"}
          </p>
        </div>

        {!submitted ? (
          <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="scientist@university.edu"
                  required
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button type="submit" disabled={loading} className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50">
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            <div className="mt-6 text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10 p-6 shadow-lg text-center">
            <h3 className="text-lg font-medium">Check your email</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              If an account exists for {email}, a reset link has been sent. In development, check server logs for the token.
            </p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
