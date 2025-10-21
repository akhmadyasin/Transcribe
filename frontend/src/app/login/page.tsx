"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/app/lib/supabaseClient";

type RoleMeta = "dokter_patologi" | "dokter_hewan";
function roleToMode(role?: string): "patologi" | "dokter_hewan" {
  return role === "dokter_hewan" ? "dokter_hewan" : "patologi";
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const persistRoleLocally = (role?: string) => {
    // Persist only summaryMode (canonical). Keep legacy `role` in metadata but avoid duplicating it locally.
    const mode = roleToMode(role);
    try { localStorage.setItem("summaryMode", mode); } catch {}
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    // Ambil user & role setelah sign-in
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setErr(userErr.message);
      return;
    }

    // Prefer summary_mode from metadata; fall back to legacy role mapping if needed.
    const summary = (user?.user_metadata as any)?.summary_mode as string | undefined;
    let mode: "patologi" | "dokter_hewan" | null = null;
    if (summary === "dokter_hewan") mode = "dokter_hewan";
    else if (summary === "patologi") mode = "patologi";

    // Legacy fallback: if summary_mode absent, derive from user_metadata.role (older accounts)
    if (!mode) {
      const role = (user?.user_metadata?.role as RoleMeta | undefined);
      if (role === "dokter_hewan") mode = "dokter_hewan";
      else if (role === "dokter_patologi") mode = "patologi";
    }

    if (!mode) {
      // Still missing: send user to onboarding to pick mode
      router.push("/onboarding/role?next=/dashboard");
      return;
    }

    // persist and continue (only summaryMode)
    try { localStorage.setItem("summaryMode", mode); } catch {}
    router.push("/dashboard");
  };

  const onGoogle = async () => {
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` }, // di /auth/callback lakukan hal yang sama: baca user.role, persist, redirect
    });
    setLoading(false);
    if (error) setErr(error.message);
  };

  const onForgot = async () => {
    if (!email) {
      setErr("Please enter your email address first to reset password.");
      return;
    }
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/update-password`,
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setResetSent(true);
  };

  return (
    <div className="auth-container">
      <div className="form-side">
        <div className="form-box">
          <h1>Welcome Back</h1>
          <p style={{ textAlign:'center', color:'#6b7280', marginBottom:24, fontSize:14 }}>
            Sign in to your account to continue
          </p>

          {err && <div className="alert">{err}</div>}
          {resetSent && (
            <div className="alert success">
              Password reset link has been sent to your email.
            </div>
          )}

          <form onSubmit={onSubmit}>
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <div className="row between">
              <span />
              <button
                type="button"
                className="linklike"
                onClick={onForgot}
                disabled={loading}
                aria-disabled={loading}
              >
                Forgot Password?
              </button>
            </div>

            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Log In"}
            </button>
          </form>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '24px 0',
            color: '#9ca3af'
          }}>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            <span style={{ padding: '0 16px', fontSize: 14 }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          </div>

          <button className="btn google" type="button" onClick={onGoogle} disabled={loading}>
            <span className="g">G</span> Log in with Google
          </button>

          <p className="muted center">
            Don't have an account? <a href="/register">Sign up now</a>
          </p>
        </div>
      </div>

      <div className="image-side">
        <img src="/login.jpg" alt="Login Illustration" />
      </div>
    </div>
  );
}