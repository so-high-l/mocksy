"use client";

import { useState } from "react";
import { Eye, EyeOff, Layers3, LoaderCircle, LockKeyhole } from "lucide-react";

export default function LoginForm({ localPreview }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in failed.");
      const requested = new URLSearchParams(window.location.search).get("returnTo");
      window.location.href = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
    } catch (requestError) {
      setError(requestError.message || "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual" aria-hidden="true">
        <div className="login-visual-brand">
          <span className="brand-mark"><Layers3 size={17} strokeWidth={2.4} /></span>
          <span>mocksy</span>
        </div>
        <div className="login-art-card">
          <div className="login-sun" />
          <div className="login-mountain mountain-one" />
          <div className="login-mountain mountain-two" />
          <div className="login-art-copy"><span>CREATE</span><strong>beautifully.</strong></div>
        </div>
        <p>Your private Etsy<br />mockup workspace.</p>
      </section>

      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="login-lock"><LockKeyhole size={20} /></div>
          <span className="login-eyebrow">PRIVATE STUDIO</span>
          <h1>Welcome back.</h1>
          <p>Enter your studio password to continue.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="studio-password">Studio password</label>
            <div className="password-field">
              <input
                id="studio-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {error && <div className="login-error" role="alert">{error}</div>}
            {localPreview && <div className="local-password-note">Local preview password: <strong>mocksy</strong></div>}
            <button className="login-submit" type="submit" disabled={submitting || !password}>
              {submitting ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={17} />}
              {submitting ? "Opening studio…" : "Enter studio"}
            </button>
          </form>
          <span className="login-footnote">Protected with a signed, HTTP-only session.</span>
        </div>
      </section>
    </main>
  );
}
