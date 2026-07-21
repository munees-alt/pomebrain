"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import Link from "next/link";

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

      if (authMode === "signup" && !result.data.session) {
        setMessageTone("success");
        setMessage("Workspace requested. Check your email to confirm your account, then log in.");
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

  async function continueWithGoogle() {
    setBusy(true);
    setMessage("");
    setMessageTone("error");

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(error.message);
        setBusy(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sign-in failed.");
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
            Your agent build team
          </p>
          <h1>
            Build from one goal.
            <em> Ship with a full agent team.</em>
          </h1>
          <p className="login-copy">
            Crown routes your goal through 19 protected specialist agents, then gives you a clear plan to approve.
            Your first month includes all 19 agents and 200 agent actions.
          </p>

          <div className="login-proof-grid">
            <article>
              <ShieldCheck size={18} />
              <strong>One month included</strong>
              <span>Start with 200 specialist actions before choosing a plan.</span>
            </article>
            <article>
              <LockKeyhole size={18} />
              <strong>Your tools stay yours</strong>
              <span>Connect your own accounts and approve every important action.</span>
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
                : "Create your workspace and start your included month with all 19 agents."}
            </p>
          </div>

          <button type="button" className="google-login-button" disabled={busy} onClick={() => void continueWithGoogle()}>
            {busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            Continue with Google
          </button>

          <div className="login-divider"><span>or use email</span></div>

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
            By continuing, you agree to the Pomebrain <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}
