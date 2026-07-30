"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileImage,
  Gauge,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import AppSidebar from "../components/app-sidebar";
import ThemeToggle from "../components/theme-toggle";
import {
  DPI_IMAGE_TYPES,
  formatImageBytes,
  getImageDimensions,
  MAX_DPI_FILES,
  MAX_ETSY_FILE_SIZE,
  optimizeArtworkForEtsy,
} from "../../lib/dpi-processor";
import {
  createListingWorkflow,
  getWorkflowAsset,
  loadListingWorkflow,
  saveListingWorkflow,
  saveWorkflowAsset,
  setListingWorkflowStep,
  updateListingWorkflow,
  WORKFLOW_STEPS,
} from "../../lib/listing-workflow";

const STEP_DETAILS = [
  { id: "artwork", label: "Artwork", note: "Add up to 5 files", icon: Sparkles },
  { id: "dpi", label: "300 DPI", note: "Etsy-ready files", icon: Gauge },
  { id: "mockups", label: "Mockups", note: "Create scenes", icon: WandSparkles },
  { id: "seo", label: "SEO", note: "Build listing copy", icon: Search },
  { id: "review", label: "Review", note: "Save Etsy draft", icon: ClipboardCheck },
];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function itemId(file, index) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

export default function WorkflowPage() {
  const inputRef = useRef(null);
  const [workflow, setWorkflow] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = loadListingWorkflow();
    const active = saved || createListingWorkflow();
    setWorkflow(active);
    setSelectedAssetId(active.selectedAssetId || active.readyAssets?.[0]?.id || "");
    if (active.readyAssets?.length) {
      setItems(active.readyAssets.map((asset) => ({ ...asset, status: "ready" })));
    }
  }, []);

  function startNewWorkflow() {
    const next = createListingWorkflow();
    setWorkflow(next);
    setItems([]);
    setSelectedAssetId("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function processFiles(fileList) {
    const files = Array.from(fileList || []);
    setError("");
    if (!workflow || !files.length) return;
    if (files.length > MAX_DPI_FILES) {
      setError(`Choose no more than ${MAX_DPI_FILES} artwork files.`);
      return;
    }
    const invalid = files.find((file) => !DPI_IMAGE_TYPES.has(file.type));
    if (invalid) {
      setError(`${invalid.name} is not supported. Use JPG or PNG artwork.`);
      return;
    }
    setProcessing(true);
    const prepared = await Promise.all(files.map(async (file, index) => {
      const dimensions = await getImageDimensions(file).catch(() => ({ label: "Image" }));
      return {
        localId: itemId(file, index),
        file,
        name: file.name,
        sourceSize: formatImageBytes(file.size),
        dimensions: dimensions.label,
        status: "waiting",
      };
    }));
    setItems(prepared);

    const readyAssets = [];
    for (let index = 0; index < prepared.length; index += 1) {
      const current = prepared[index];
      setItems((existing) => existing.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        status: current.file.size > MAX_ETSY_FILE_SIZE ? "optimizing" : "processing",
      } : item));
      try {
        const output = await optimizeArtworkForEtsy(current.file);
        if (output.blob.size > MAX_ETSY_FILE_SIZE) throw new Error("The finished file is still over Etsy’s 20 MB limit.");
        const asset = await saveWorkflowAsset({
          workflowId: workflow.id,
          file: current.file,
          blob: output.blob,
          dimensions: output.dimensions,
          optimized: output.optimized,
        });
        const summary = {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          size: asset.size,
          outputSize: formatImageBytes(asset.size),
          dimensions: asset.dimensions,
          optimized: asset.optimized,
        };
        readyAssets.push(summary);
        downloadBlob(output.blob, current.file.name);
        setItems((existing) => existing.map((item, itemIndex) => itemIndex === index ? {
          ...summary,
          localId: item.localId,
          status: "ready",
        } : item));
      } catch (conversionError) {
        setItems((existing) => existing.map((item, itemIndex) => itemIndex === index ? {
          ...item,
          status: "failed",
          error: conversionError.message || "This artwork could not be prepared.",
        } : item));
      }
    }

    if (readyAssets.length) {
      const primaryId = readyAssets[0].id;
      const nextWorkflow = saveListingWorkflow({
        ...workflow,
        currentStep: "dpi",
        readyAssets,
        selectedAssetId: primaryId,
        completed: { ...workflow.completed, artwork: true, dpi: true },
      });
      setWorkflow(nextWorkflow);
      setSelectedAssetId(primaryId);
    } else {
      setError("None of the selected artwork files could be prepared.");
    }
    setProcessing(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function choosePrimary(assetId) {
    setSelectedAssetId(assetId);
    const next = updateListingWorkflow(workflow.id, { selectedAssetId: assetId });
    if (next) setWorkflow(next);
  }

  async function downloadAgain(item) {
    try {
      const asset = await getWorkflowAsset(item.id);
      if (!asset?.blob) throw new Error("This saved file is no longer available in the browser.");
      downloadBlob(asset.blob, asset.name);
    } catch (downloadError) {
      setError(downloadError.message || "The file could not be downloaded again.");
    }
  }

  function continueToMockups() {
    if (!selectedAssetId) {
      setError("Choose the primary artwork to use in the mockups.");
      return;
    }
    const next = setListingWorkflowStep(workflow.id, "mockups", { selectedAssetId });
    if (next) setWorkflow(next);
    window.location.href = `/?flow=${encodeURIComponent(workflow.id)}&asset=${encodeURIComponent(selectedAssetId)}`;
  }

  if (!workflow) {
    return (
      <div className="app-shell app-with-sidebar workflow-shell"><AppSidebar /><div className="app-workspace"><main className="workflow-loading"><LoaderCircle className="spin" size={24} /> Preparing your workflow…</main></div></div>
    );
  }

  const currentIndex = workflow.status === "complete" ? WORKFLOW_STEPS.length : Math.max(0, WORKFLOW_STEPS.indexOf(workflow.currentStep));
  const readyItems = items.filter((item) => item.status === "ready");
  const failedItems = items.filter((item) => item.status === "failed");
  const resumeHref = workflow.currentStep === "mockups"
    ? `/?flow=${encodeURIComponent(workflow.id)}&asset=${encodeURIComponent(workflow.selectedAssetId || "")}`
    : workflow.currentStep === "seo"
      ? `/seo?flow=${encodeURIComponent(workflow.id)}&asset=${encodeURIComponent(workflow.selectedAssetId || "")}`
      : workflow.currentStep === "review"
        ? `/listing?flow=${encodeURIComponent(workflow.id)}`
        : "";
  const resumeLabel = workflow.currentStep === "mockups"
    ? "Continue creating mockups"
    : workflow.currentStep === "seo"
      ? "Continue listing SEO"
      : "Continue final review";

  return (
    <div className="app-shell app-with-sidebar workflow-shell">
      <AppSidebar />
      <div className="app-workspace">
        <header className="topbar">
          <a className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>mocksy</span></a>
          <div className="topbar-right"><span className="api-status is-live"><span className="status-dot" /> Saved in this browser</span><ThemeToggle /><a className="settings-link" href="/settings" aria-label="Model and access settings"><Settings size={16} /><span>Settings</span></a></div>
        </header>

        <main className="workflow-main">
          <section className="workflow-hero">
            <div className="eyebrow"><span /> FULL LISTING FLOW</div>
            <h1>One calm path from <em>art to listing.</em></h1>
            <p>Prepare your artwork once, carry it through mockups and SEO, then review everything and save a real Etsy draft.</p>
          </section>

          <section className="full-flow-steps" aria-label="Full listing progress">
            {STEP_DETAILS.map((step, index) => {
              const Icon = step.icon;
              const complete = workflow.status === "complete" || Boolean(workflow.completed?.[step.id]);
              const active = !complete && index === currentIndex;
              return (
                <div className={`full-flow-step ${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`} key={step.id}>
                  <span>{complete ? <Check size={16} /> : <Icon size={16} />}</span>
                  <div><strong>{step.label}</strong><small>{complete ? "Complete" : step.note}</small></div>
                </div>
              );
            })}
          </section>

          {error && <div className="message-bar is-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}

          {workflow.status === "complete" ? (
            <section className="workflow-complete-card">
              <span className="workflow-complete-icon"><Check size={26} /></span>
              <div>
                <span className="section-number">DONE</span>
                <h2>Your Etsy draft is ready.</h2>
                <p>{workflow.seoResult?.title || "Your chosen photos and listing details were saved to Etsy as a draft."}</p>
                <div className="workflow-complete-meta">
                  <span>{workflow.readyAssets?.length || 0} print files</span>
                  <span>{workflow.mockupCount || 0} mockups</span>
                  <span>{workflow.seoResult?.tags?.length || 0} Etsy tags</span>
                </div>
                <div className="workflow-complete-actions">
                  {workflow.draftListing?.manageUrl && <a className="outline-button" href={workflow.draftListing.manageUrl} target="_blank" rel="noreferrer">Open Etsy drafts <ExternalLink size={15} /></a>}
                  <button className="generate-button workflow-start-again" type="button" onClick={startNewWorkflow}><RefreshCw size={17} /> Start another listing</button>
                </div>
              </div>
            </section>
          ) : resumeHref ? (
            <section className="workflow-complete-card workflow-resume-card">
              <span className="workflow-complete-icon"><ArrowRight size={26} /></span>
              <div>
                <span className="section-number">IN PROGRESS</span>
                <h2>Your listing workflow is saved.</h2>
                <p>Continue where you left off. Your prepared artwork, selected mockups, and generated SEO stay in this browser.</p>
                <div className="workflow-complete-actions">
                  <a className="generate-button workflow-start-again" href={resumeHref}>{resumeLabel} <ArrowRight size={17} /></a>
                  <button className="text-button" type="button" onClick={startNewWorkflow}><RefreshCw size={14} /> Start over</button>
                </div>
              </div>
            </section>
          ) : (
            <section className="workflow-stage-card">
              <div className="workflow-stage-heading">
                <span className="workflow-stage-icon"><Gauge size={22} /></span>
                <div>
                  <span className="section-number">01 + 02</span>
                  <h2>Add and prepare your artwork</h2>
                  <p>Upload up to five generated artwork files. They become 300 DPI, stay under 20 MB, download automatically, and remain available for the next steps.</p>
                </div>
                {items.length > 0 && !processing && <button className="text-button" type="button" onClick={startNewWorkflow}>Start over</button>}
              </div>

              {!items.length ? (
                <div
                  className={`workflow-dropzone ${dragActive ? "is-dragging" : ""}`}
                  onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => { event.preventDefault(); setDragActive(false); processFiles(event.dataTransfer.files); }}
                >
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={(event) => processFiles(event.target.files)} />
                  <span><UploadCloud size={27} /></span>
                  <h3>Add your generated artwork</h3>
                  <p>JPG or PNG · up to 5 files · no input-size cap</p>
                  <button className="generate-button" type="button" onClick={() => inputRef.current?.click()}><FileImage size={18} /> Choose artwork files</button>
                  <small>Artwork generation will connect before this upload step next.</small>
                </div>
              ) : (
                <div className="workflow-file-area" aria-live="polite">
                  <div className="workflow-processing-summary">
                    <div>
                      <strong>{processing ? "Preparing Etsy files…" : `${readyItems.length} Etsy-ready file${readyItems.length === 1 ? "" : "s"}`}</strong>
                      <span>{processing ? "Files are processed one at a time for maximum quality." : "Choose the primary ratio to carry into mockups and SEO."}</span>
                    </div>
                    <span>{items.length} / {MAX_DPI_FILES}</span>
                  </div>

                  <div className="workflow-file-list">
                    {items.map((item) => {
                      const selected = item.id && item.id === selectedAssetId;
                      return (
                        <div className={`workflow-file-row is-${item.status} ${selected ? "is-selected" : ""}`} key={item.localId || item.id}>
                          <span className="workflow-file-icon">{item.status === "ready" ? <Check size={17} /> : item.status === "failed" ? <X size={17} /> : <FileImage size={17} />}</span>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.dimensions} · {item.outputSize || item.sourceSize}{item.optimized ? " · Etsy optimized" : ""}</span>
                            {item.error && <small>{item.error}</small>}
                          </div>
                          <div className="workflow-file-actions">
                            {item.status === "waiting" && <em>Waiting</em>}
                            {item.status === "processing" && <em><LoaderCircle className="spin" size={14} /> Adding 300 DPI</em>}
                            {item.status === "optimizing" && <em><LoaderCircle className="spin" size={14} /> Under 20 MB</em>}
                            {item.status === "failed" && <em>Failed</em>}
                            {item.status === "ready" && (
                              <>
                                <button type="button" className={selected ? "is-primary" : ""} onClick={() => choosePrimary(item.id)}>{selected ? "Primary artwork" : "Use for mockups"}</button>
                                <button type="button" className="icon-button" onClick={() => downloadAgain(item)} aria-label={`Download ${item.name} again`}><Download size={15} /></button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!processing && readyItems.length > 0 && (
                    <div className="workflow-continue-row">
                      <div><Check size={16} /><span>{readyItems.length} downloaded and saved locally{failedItems.length ? ` · ${failedItems.length} failed` : ""}</span></div>
                      <button className="generate-button" type="button" onClick={continueToMockups}>Continue to mockups <ArrowRight size={17} /></button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
