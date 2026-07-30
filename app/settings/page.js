"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Unplug,
  WandSparkles,
} from "lucide-react";
import { MODEL_OPTIONS } from "../../lib/models";
import AppSidebar from "../components/app-sidebar";
import ThemeToggle from "../components/theme-toggle";

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    mark: "G",
    markClass: "gemini-mark",
    description: "Powers every Nano Banana image model.",
    label: "Gemini API key",
    placeholder: "Paste your Google AI Studio key",
    env: "GEMINI_API_KEY",
    link: "https://aistudio.google.com/apikey",
    linkLabel: "Get a key from Google AI Studio ↗",
  },
  {
    id: "bfl",
    name: "Black Forest Labs",
    mark: "B",
    markClass: "bfl-mark",
    description: "Powers the stable FLUX.2 Klein 9B model.",
    label: "BFL API key",
    placeholder: "Paste your Black Forest Labs key",
    env: "BFL_API_KEY",
    link: "https://dashboard.bfl.ai/",
    linkLabel: "Open the BFL dashboard ↗",
  },
  {
    id: "openai",
    name: "OpenAI",
    mark: "O",
    markClass: "openai-mark",
    description: "Powers smart frame matching and Etsy listing SEO.",
    label: "OpenAI API key",
    placeholder: "Paste your OpenAI API key",
    env: "OPENAI_API_KEY",
    link: "https://platform.openai.com/api-keys",
    linkLabel: "Manage OpenAI API keys ↗",
  },
];

export default function SettingsPage() {
  const [status, setStatus] = useState(null);
  const [drafts, setDrafts] = useState({ gemini: "", bfl: "", openai: "" });
  const [visible, setVisible] = useState({ gemini: false, bfl: false, openai: false });
  const [savingProvider, setSavingProvider] = useState("");
  const [testingProvider, setTestingProvider] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [etsyStatus, setEtsyStatus] = useState(null);
  const [etsyBusy, setEtsyBusy] = useState(false);

  async function loadSettings() {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Settings could not be loaded.");
      setStatus(data);
    } catch (requestError) {
      setError(requestError.message || "Settings could not be loaded.");
    }
  }

  async function loadEtsyStatus() {
    try {
      const response = await fetch("/api/etsy/status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Etsy status could not be loaded.");
      setEtsyStatus(data);
    } catch (requestError) {
      setError(requestError.message || "Etsy status could not be loaded.");
    }
  }

  useEffect(() => {
    loadSettings();
    loadEtsyStatus();
    const search = new URLSearchParams(window.location.search);
    if (search.get("etsy") === "connected") setMessage("Etsy is connected and ready to create drafts.");
    if (search.get("etsy_error")) setError(search.get("etsy_error"));
  }, []);

  function connectEtsy() {
    setEtsyBusy(true);
    window.location.href = "/api/etsy/connect";
  }

  async function disconnectEtsy() {
    setEtsyBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/etsy/disconnect", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Etsy could not be disconnected.");
      await loadEtsyStatus();
      setMessage("Etsy was disconnected from this browser.");
    } catch (requestError) {
      setError(requestError.message || "Etsy could not be disconnected.");
    } finally {
      setEtsyBusy(false);
    }
  }

  async function saveKey(event, provider) {
    event.preventDefault();
    setSavingProvider(provider.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: drafts[provider.id] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The key could not be saved.");
      setStatus(data);
      setDrafts((current) => ({ ...current, [provider.id]: "" }));
      if (data.connection?.ok === false) {
        setError(`${provider.name} key saved, but Google reported: ${data.connection.message}`);
      } else {
        setMessage(data.connection?.message || `${provider.name} is connected and ready.`);
      }
    } catch (requestError) {
      setError(requestError.message || "The key could not be saved.");
    } finally {
      setSavingProvider("");
    }
  }

  async function testConnection(provider) {
    setTestingProvider(provider.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, action: "test" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.connection?.message || data.error || "Google could not verify this connection.");
      setStatus(data);
      setMessage(data.connection?.message || "Google Gemini is ready for batch generation.");
    } catch (requestError) {
      setError(requestError.message || "Google could not verify this connection.");
    } finally {
      setTestingProvider("");
    }
  }

  async function removeKey(provider) {
    setSavingProvider(provider.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/settings?provider=${encodeURIComponent(provider.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The key could not be removed.");
      setStatus(data);
      setMessage(`${provider.name} API key removed from this browser.`);
    } catch (requestError) {
      setError(requestError.message || "The key could not be removed.");
    } finally {
      setSavingProvider("");
    }
  }

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="settings-shell app-with-sidebar">
      <AppSidebar />
      <div className="app-workspace">
      <header className="topbar settings-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark"><Layers3 size={17} strokeWidth={2.4} /></span>
          <span>mocksy</span>
        </Link>
        <div className="topbar-right">
          <ThemeToggle />
          <Link className="back-studio-link" href="/"><ArrowLeft size={14} /> Back to studio</Link>
          <button className="logout-button" type="button" onClick={logOut}><LogOut size={14} /> Sign out</button>
        </div>
      </header>

      <main className="settings-main">
        <section className="settings-intro">
          <div className="eyebrow"><span /> STUDIO SETTINGS</div>
          <h1>Models & access.</h1>
          <p>Connect your image models and Etsy shop, enable smart frame matching, and keep the studio private.</p>
        </section>

        {(message || error) && <div className={`settings-message ${error ? "is-error" : ""}`}>{error || message}</div>}

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            <a className="is-active" href="#api-keys"><KeyRound size={15} /> API keys</a>
            <a href="#etsy"><Store size={15} /> Etsy shop</a>
            <a href="#models"><Sparkles size={15} /> Models</a>
            <a href="#deployment"><ShieldCheck size={15} /> Deployment</a>
          </nav>

          <div className="settings-content">
            <section className="settings-card" id="api-keys">
              <div className="settings-card-heading">
                <div className="settings-card-icon"><KeyRound size={19} /></div>
                <div><h2>Model API keys</h2><p>Keys are encrypted and never exposed to the page after saving.</p></div>
              </div>

              <div className="provider-settings-list">
                {PROVIDERS.map((provider) => {
                  const providerStatus = status?.[provider.id];
                  const managedByEnvironment = providerStatus?.source === "environment";
                  const saving = savingProvider === provider.id;
                  return (
                    <div className="provider-setting" key={provider.id}>
                      <div className="provider-row">
                        <div className={`provider-mark ${provider.markClass}`}>{provider.mark}</div>
                        <div className="provider-copy">
                          <div className="provider-title">
                            <strong>{provider.name}</strong>
                            {providerStatus?.configured && <span className="connected-badge"><Check size={11} /> Connected</span>}
                          </div>
                          <span>{provider.description}</span>
                        </div>
                        {providerStatus?.configured && <code>{providerStatus.masked}</code>}
                      </div>

                      {managedByEnvironment ? (
                        <div className="managed-notice"><ServerCog size={17} /><div><strong>Managed by Vercel</strong><span>This key comes from {provider.env} and can only be changed in your deployment environment.</span></div></div>
                      ) : (
                        <form className="api-key-form" onSubmit={(event) => saveKey(event, provider)}>
                          <label htmlFor={`${provider.id}-key`}>{provider.label}</label>
                          <div className="api-key-entry">
                            <div className="secret-input">
                              <input
                                id={`${provider.id}-key`}
                                type={visible[provider.id] ? "text" : "password"}
                                value={drafts[provider.id]}
                                onChange={(event) => setDrafts((current) => ({ ...current, [provider.id]: event.target.value }))}
                                placeholder={providerStatus?.configured ? "Paste a new key to replace the current one" : provider.placeholder}
                                autoComplete="off"
                              />
                              <button type="button" onClick={() => setVisible((current) => ({ ...current, [provider.id]: !current[provider.id] }))} aria-label={visible[provider.id] ? "Hide API key" : "Show API key"}>
                                {visible[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                            <button className="save-key-button" type="submit" disabled={saving || !drafts[provider.id].trim()}>
                              {saving ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={14} />}
                              {providerStatus?.configured ? "Replace key" : "Save key"}
                            </button>
                          </div>
                          <div className="key-form-bottom">
                            <a href={provider.link} target="_blank" rel="noreferrer">{provider.linkLabel}</a>
                            {providerStatus?.configured && <button type="button" onClick={() => removeKey(provider)} disabled={saving}><Trash2 size={12} /> Remove key</button>}
                          </div>
                        </form>
                      )}
                      {provider.id === "gemini" && (
                        <div className="provider-health-row">
                          <button
                            type="button"
                            disabled={!providerStatus?.configured || testingProvider === provider.id}
                            onClick={() => testConnection(provider)}
                          >
                            {testingProvider === provider.id
                              ? <LoaderCircle className="spin" size={14} />
                              : <CheckCircle2 size={14} />}
                            {testingProvider === provider.id
                              ? "Checking Google…"
                              : providerStatus?.configured
                                ? "Check Google billing & access"
                                : "Save a key to check Google"}
                          </button>
                          <span>
                            {providerStatus?.configured
                              ? "Verifies more than key presence—it checks whether Google accepts a batch upload."
                              : "No Gemini key is currently connected in this browser."}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="settings-card" id="etsy">
              <div className="settings-card-heading">
                <div className="settings-card-icon"><Store size={19} /></div>
                <div><h2>Etsy shop</h2><p>Create reviewed listings as drafts without ever publishing them live.</p></div>
              </div>

              <div className="etsy-connection-panel">
                <div className="provider-row">
                  <div className="provider-mark etsy-mark">E</div>
                  <div className="provider-copy">
                    <div className="provider-title">
                      <strong>{etsyStatus?.connected ? etsyStatus.shopName : "Etsy Open API"}</strong>
                      {etsyStatus?.connected && <span className="connected-badge"><Check size={11} /> Connected</span>}
                    </div>
                    <span>{etsyStatus?.connected ? `Shop ID ${etsyStatus.shopId}${etsyStatus.currencyCode ? ` · ${etsyStatus.currencyCode}` : ""}` : "OAuth access is limited to reading shop details and creating or editing listings."}</span>
                  </div>
                </div>

                {etsyStatus?.configured === false ? (
                  <div className="managed-notice">
                    <ServerCog size={17} />
                    <div>
                      <strong>Etsy app credentials needed</strong>
                      <span>Add ETSY_API_KEY and ETSY_SHARED_SECRET to the deployment, then register the callback below in your Etsy app.</span>
                    </div>
                  </div>
                ) : etsyStatus?.redirectConfigured === false ? (
                  <div className="managed-notice">
                    <ServerCog size={17} />
                    <div>
                      <strong>HTTPS Etsy callback needed</strong>
                      <span>Open Mocksy through a public HTTPS URL, set ETSY_REDIRECT_URI to that origin plus /api/etsy/callback, and register the identical URL in your Etsy app. Start the connection from that same HTTPS origin.</span>
                    </div>
                  </div>
                ) : etsyStatus?.redirectValid === false ? (
                  <div className="managed-notice">
                    <ServerCog size={17} />
                    <div>
                      <strong>Invalid Etsy callback</strong>
                      <span>{etsyStatus.redirectError}</span>
                    </div>
                  </div>
                ) : etsyStatus?.connected ? (
                  <div className="etsy-connection-actions">
                    <div className="security-note"><ShieldCheck size={17} /><p><strong>Draft only:</strong> Mocksy does not send Etsy’s activation request. You publish later from Etsy Shop Manager.</p></div>
                    <button className="outline-button" type="button" onClick={disconnectEtsy} disabled={etsyBusy}>{etsyBusy ? <LoaderCircle className="spin" size={15} /> : <Unplug size={15} />} Disconnect Etsy</button>
                  </div>
                ) : (
                  <div className="etsy-connection-actions">
                    <button className="save-key-button etsy-connect-button" type="button" onClick={connectEtsy} disabled={etsyBusy || !etsyStatus?.configured || !etsyStatus?.redirectConfigured || !etsyStatus?.redirectValid}>
                      {etsyBusy ? <LoaderCircle className="spin" size={15} /> : <Store size={15} />}
                      Connect Etsy shop
                    </button>
                    <a href="https://www.etsy.com/developers/your-apps" target="_blank" rel="noreferrer">Manage Etsy apps <ExternalLink size={13} /></a>
                  </div>
                )}

                <div className="etsy-callback-row">
                  <span>{etsyStatus?.redirectConfigured ? "Configured OAuth callback" : "Current callback candidate — HTTPS required"}</span>
                  <code>{etsyStatus?.redirectUri || "Loading callback URL…"}</code>
                </div>
              </div>
            </section>

            <section className="settings-card" id="models">
              <div className="settings-card-heading">
                <div className="settings-card-icon"><Sparkles size={19} /></div>
                <div><h2>Available models</h2><p>Switch image models below Resolution in the studio.</p></div>
              </div>
              <div className="settings-model-list">
                {MODEL_OPTIONS.map((model, index) => (
                  <div className="settings-model-row" key={model.id}>
                    <span className="model-list-index">{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{model.name}</strong><span>{model.description} · {model.providerName}</span></div>
                    <div className="model-capabilities"><span>{model.speed}</span><span>{model.sizes.join(" · ")}</span></div>
                  </div>
                ))}
                <div className="settings-model-row frame-model-row">
                  <span className="model-list-index"><WandSparkles size={13} /></span>
                  <div><strong>GPT‑4o mini</strong><span>Analyzes artwork for one consistent frame and generates structured Etsy listing SEO.</span></div>
                  <div className="model-capabilities"><span>Frames + SEO</span></div>
                </div>
              </div>
            </section>

            <section className="settings-card deployment-card" id="deployment">
              <div className="settings-card-heading">
                <div className="settings-card-icon"><ShieldCheck size={19} /></div>
                <div><h2>Vercel deployment</h2><p>Add these environment variables before publishing.</p></div>
              </div>
              <div className="env-list">
                <div><code>APP_PASSWORD</code><span>Your private studio password</span><CheckCircle2 size={16} /></div>
                <div><code>SESSION_SECRET</code><span>A long random secret for signing and encryption</span><CheckCircle2 size={16} /></div>
                <div><code>GEMINI_API_KEY</code><span>Nano Banana image models</span><CheckCircle2 size={16} /></div>
                <div><code>BFL_API_KEY</code><span>FLUX.2 Klein image generation</span><CheckCircle2 size={16} /></div>
                <div><code>OPENAI_API_KEY</code><span>GPT‑4o mini smart frame matching</span><CheckCircle2 size={16} /></div>
                <div><code>ETSY_API_KEY</code><span>Etsy app keystring</span><CheckCircle2 size={16} /></div>
                <div><code>ETSY_SHARED_SECRET</code><span>Etsy app shared secret</span><CheckCircle2 size={16} /></div>
                <div><code>ETSY_REDIRECT_URI</code><span>Registered OAuth callback URL</span><CheckCircle2 size={16} /></div>
                <div><code>ETSY_TAXONOMY_ID</code><span>Optional default Etsy category ID</span><CheckCircle2 size={16} /></div>
              </div>
              <div className="security-note"><LockKeyhole size={17} /><p><strong>Safe default:</strong> production access is blocked if the password or session secret is missing.</p></div>
            </section>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
