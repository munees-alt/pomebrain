"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !busy;

  async function authenticate(authMode = mode) {
    setBusy(true);
    setMessage("");
    setMessageTone("error");

    try {
      const supabase = createSupabaseBrowserClient();
      const result =
        authMode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      setMessageTone("success");
      setMessage(authMode === "signup" ? "Workspace created. Opening Pomebrain..." : "Welcome back. Opening Pomebrain...");
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Pomebrain access">
        <div className="login-orb login-orb-one" />
        <div className="login-orb login-orb-two" />

        <div className="login-story">
          <div className="login-brand">
            <div className="pomegranate-mark mark-compact" aria-hidden="true">
              <span className="crown-leaf leaf-left" />
              <span className="crown-leaf leaf-center" />
              <span className="crown-leaf leaf-right" />
              <span className="fruit-shell">
                {Array.from({ length: 9 }).map((_, index) => (
                  <i key={index} />
                ))}
              </span>
            </div>
            <div>
              <strong>POMEBRAIN</strong>
              <span>Living build system</span>
            </div>
          </div>

          <p className="login-eyebrow">
            <Sparkles size={14} />
            Protected workspace
          </p>
          <h1>
            Enter the brain.
            <em> Keep every seed yours.</em>
          </h1>
          <p className="login-copy">
            Sign in to route your agents, skills, projects, and future Crown runs through your own
            Supabase workspace.
          </p>

          <div className="login-proof-grid">
            <article>
              <ShieldCheck size={18} />
              <strong>Workspace scoped</strong>
              <span>Your JWT carries the workspace boundary.</span>
            </article>
            <article>
              <LockKeyhole size={18} />
              <strong>RLS guarded</strong>
              <span>Data visibility comes from real auth, not loose policies.</span>
            </article>
          </div>
        </div>

        <form
          className="login-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              void authenticate();
            }
          }}
        >
          <div className="login-card-heading">
            <span>ACCESS GATE</span>
            <h2>{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
            <p>
              {mode === "login"
                ? "Log in with your email and password to continue."
                : "Sign up once. Pomebrain will provision your workspace automatically."}
            </p>
          </div>

          <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
            >
              Sign up
            </button>
          </div>

          <label className="login-field">
            <span>Email</span>
            <div>
              <Mail size={16} />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>
            <div>
              <LockKeyhole size={16} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button type="submit" className="login-submit" disabled={!canSubmit}>
            {busy ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
            {busy ? "Opening..." : mode === "login" ? "Log in to Pomebrain" : "Create workspace"}
          </button>

          <button
            type="button"
            className="login-secondary"
            disabled={busy || !canSubmit}
            onClick={() => void authenticate(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
          </button>

          {message ? <p className={`login-message ${messageTone}`}>{message}</p> : null}

          <p className="login-footnote">
            After sign-up, Supabase creates your workspace and stores its ID in app metadata.
          </p>
        </form>
      </section>
    </main>
  );
}
