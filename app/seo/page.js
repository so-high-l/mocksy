"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import AppSidebar from "../components/app-sidebar";
import ThemeToggle from "../components/theme-toggle";
import { getWorkflowAsset, prepareListingReview } from "../../lib/listing-workflow";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const PRODUCT_TYPES = [
  { value: "digital-download", label: "Digital download" },
  { value: "printable", label: "Printable wall art" },
];

const LISTING_TYPES = [
  { value: "single-print", label: "Single print" },
  { value: "set-of-3", label: "Set of 3" },
  { value: "other", label: "Other set or listing" },
];

const FILE_PACKAGES = [
  { value: "standard-single", label: "Standard 5 JPG package" },
  { value: "custom", label: "Custom file package" },
];

const SEO_STYLES = [
  { value: "balanced", label: "Balanced", note: "Clear + searchable" },
  { value: "search-focused", label: "Search focused", note: "Broader keywords" },
  { value: "natural-premium", label: "Natural premium", note: "Editorial copy" },
];

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const unit = bytes >= 1024 * 1024 ? "MB" : "KB";
  const divisor = unit === "MB" ? 1024 * 1024 : 1024;
  return `${(bytes / divisor).toFixed(1)} ${unit}`;
}

function loadImage(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be read."));
    };
    image.src = url;
  });
}

async function makeSeoPreview(file) {
  const image = await loadImage(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the SEO preview.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("The SEO preview could not be created.")),
    "image/jpeg",
    0.86,
  ));
  return new File([blob], "seo-preview.jpg", { type: "image/jpeg" });
}

function listingText(result) {
  const analysis = result.visualAnalysis;
  const checks = result.qualityCheck;
  return [
    "VISUAL AND SEARCH ANALYSIS",
    analysis ? `Main subject: ${analysis.mainSubject}\nDominant colors: ${analysis.dominantColors.join(", ")}\nSecondary colors: ${analysis.secondaryColors.join(", ")}\nArt style: ${analysis.artStyle}\nMood: ${analysis.mood}\nBest rooms: ${analysis.bestRooms.join(", ")}\nLikely buyer: ${analysis.likelyBuyer}\nPrimary search phrase: ${analysis.primarySearchPhrase}\nLong-tail phrases: ${analysis.longTailPhrases.join(", ")}` : "",
    "",
    "ETSY TITLE",
    result.title,
    `Character count: ${result.title.length}`,
    "",
    "PRIMARY KEYWORD",
    result.primaryKeyword,
    "",
    "13 ETSY TAGS",
    result.tags.map((tag, index) => `${index + 1}. ${tag} (${tag.length})`).join("\n"),
    "",
    "SECONDARY KEYWORDS",
    result.secondaryKeywords.join(", "),
    "",
    "DESCRIPTION",
    result.description,
    "",
    "IMAGE ALT TEXT",
    result.imageAltText,
    "",
    "SUGGESTED ATTRIBUTES",
    result.suggestedAttributes.join(", "),
    "",
    "STRATEGY",
    result.strategy,
    "",
    "FINAL QUALITY CHECK",
    checks ? Object.entries(checks).map(([key, passed]) => `${passed ? "✓" : "✕"} ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`).join("\n") : "",
  ].join("\n");
}

export default function SeoPage() {
  const inputRef = useRef(null);
  const artworkUrlRef = useRef("");
  const [artwork, setArtwork] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [mainKeyword, setMainKeyword] = useState("");
  const [inspiration, setInspiration] = useState("");
  const [targetBuyer, setTargetBuyer] = useState("");
  const [productType, setProductType] = useState("digital-download");
  const [listingType, setListingType] = useState("single-print");
  const [artworkName, setArtworkName] = useState("");
  const [filePackage, setFilePackage] = useState("standard-single");
  const [digitalFiles, setDigitalFiles] = useState("");
  const [aiAssisted, setAiAssisted] = useState("yes");
  const [shopSectionUrl, setShopSectionUrl] = useState("");
  const [exactSetName, setExactSetName] = useState("");
  const [exactSetUrl, setExactSetUrl] = useState("");
  const [additionalSetName, setAdditionalSetName] = useState("");
  const [additionalSetUrl, setAdditionalSetUrl] = useState("");
  const [existingListing, setExistingListing] = useState("");
  const [seoStyle, setSeoStyle] = useState("balanced");
  const [configured, setConfigured] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [flowContext, setFlowContext] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/seo", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false));

    const search = new URLSearchParams(window.location.search);
    const flowId = search.get("flow");
    const assetId = search.get("asset");
    if (flowId && assetId) {
      setFlowContext({ flowId, assetId });
      getWorkflowAsset(assetId)
        .then((asset) => {
          if (cancelled) return;
          if (!asset?.blob) throw new Error("The workflow artwork is no longer available in this browser.");
          return selectArtwork(new File([asset.blob], asset.name, { type: asset.type, lastModified: asset.lastModified || Date.now() }));
        })
        .catch((workflowError) => {
          if (!cancelled) setError(workflowError.message || "The workflow artwork could not be loaded.");
        });
    }

    return () => {
      cancelled = true;
      if (artworkUrlRef.current) URL.revokeObjectURL(artworkUrlRef.current);
    };
  }, []);

  async function selectArtwork(file) {
    setError("");
    setResult(null);
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Use a JPG, PNG, or WebP listing image.");
      return;
    }
    try {
      const image = await loadImage(file);
      if (artworkUrlRef.current) URL.revokeObjectURL(artworkUrlRef.current);
      const url = URL.createObjectURL(file);
      artworkUrlRef.current = url;
      setArtwork({ file, url, dimensions: `${image.naturalWidth} × ${image.naturalHeight}px` });
    } catch (imageError) {
      setError(imageError.message || "This image could not be read.");
    }
  }

  function removeArtwork() {
    if (artworkUrlRef.current) URL.revokeObjectURL(artworkUrlRef.current);
    artworkUrlRef.current = "";
    setArtwork(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function generateSeo() {
    if (!artwork || generating) return;
    if (filePackage === "custom" && !digitalFiles.trim()) {
      setError("Add the exact files, sizes, and delivery details for this custom package.");
      return;
    }
    if (Boolean(exactSetName.trim()) !== Boolean(exactSetUrl.trim())) {
      setError("Add both the exact set name and its Etsy URL, or leave both blank.");
      return;
    }
    if (Boolean(additionalSetName.trim()) !== Boolean(additionalSetUrl.trim())) {
      setError("Add both the additional set name and its Etsy URL, or leave both blank.");
      return;
    }
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const preview = await makeSeoPreview(artwork.file);
      const formData = new FormData();
      formData.append("image", preview);
      formData.append("mainKeyword", mainKeyword);
      formData.append("inspiration", inspiration);
      formData.append("targetBuyer", targetBuyer);
      formData.append("productType", productType);
      formData.append("listingType", listingType);
      formData.append("artworkName", artworkName);
      formData.append("filePackage", filePackage);
      formData.append("digitalFiles", digitalFiles);
      formData.append("aiAssisted", aiAssisted);
      formData.append("shopSectionUrl", shopSectionUrl);
      formData.append("exactSetName", exactSetName);
      formData.append("exactSetUrl", exactSetUrl);
      formData.append("additionalSetName", additionalSetName);
      formData.append("additionalSetUrl", additionalSetUrl);
      formData.append("existingListing", existingListing);
      formData.append("seoStyle", seoStyle);
      const response = await fetch("/api/seo", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "SEO could not be generated.");
      setResult(data.result);
    } catch (requestError) {
      setError(requestError.message || "SEO could not be generated.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyValue(key, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? "" : current), 1600);
    } catch {
      setError("Copying was blocked by the browser. Select the text and copy it manually.");
    }
  }

  function downloadSeo() {
    if (!result) return;
    const baseName = artwork.file.name.replace(/\.[^.]+$/, "") || "etsy-listing";
    const blob = new Blob([listingText(result)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}-seo.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reviewFullListing() {
    if (!flowContext?.flowId || !result) return;
    prepareListingReview(flowContext.flowId, result);
    window.location.href = `/listing?flow=${encodeURIComponent(flowContext.flowId)}`;
  }

  return (
    <div className="app-shell app-with-sidebar seo-shell">
      <AppSidebar />
      <div className="app-workspace">
        <header className="topbar">
          <a className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>mocksy</span></a>
          <div className="topbar-right">
            <span className={`api-status ${configured ? "is-live" : ""}`}><span className="status-dot" />{configured === null ? "Checking GPT‑4o mini" : configured ? "GPT‑4o mini connected" : "OpenAI key needed"}</span>
            <ThemeToggle />
            <a className="settings-link" href="/settings" aria-label="Model and access settings"><Settings size={16} /><span>Settings</span></a>
          </div>
        </header>

        <main className="seo-main">
          <section className="seo-hero">
            <div className="eyebrow"><span /> ETSY LISTING SEO</div>
            <h1>Turn the image into a <em>listing.</em></h1>
            <p>Build a complete WallArtRoses listing with exact file details, disclosure, set links, and image-grounded SEO.</p>
          </section>

          {flowContext && (
            <div className="flow-context-bar">
              <div><span>04</span><strong>Full listing flow</strong><small>Your primary artwork was carried in automatically.</small></div>
              <a href="/workflow">View workflow</a>
            </div>
          )}

          {error && <div className="message-bar is-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}

          <div className={`seo-workspace ${result ? "has-result" : ""}`}>
            <section className="seo-input-card">
              <div className="seo-card-heading">
                <span className="section-number">01</span>
                <div><h2>Listing input</h2><p>Only the image is required.</p></div>
                {artwork && <button className="text-button danger" type="button" onClick={removeArtwork}>Remove</button>}
              </div>

              {!artwork ? (
                <div
                  className={`seo-dropzone ${dragActive ? "is-dragging" : ""}`}
                  onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => { event.preventDefault(); setDragActive(false); selectArtwork(event.dataTransfer.files?.[0]); }}
                >
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => selectArtwork(event.target.files?.[0])} />
                  <span><UploadCloud size={24} /></span>
                  <h3>Add your listing image</h3>
                  <p>JPG, PNG or WebP · large artwork supported</p>
                  <button className="outline-button" type="button" onClick={() => inputRef.current?.click()}>Choose image</button>
                </div>
              ) : (
                <div className="seo-artwork-preview">
                  <img src={artwork.url} alt="SEO listing artwork" />
                  <div><ImageIcon size={16} /><span><strong>{artwork.file.name}</strong><small>{artwork.dimensions} · {formatBytes(artwork.file.size)}</small></span><button type="button" onClick={() => inputRef.current?.click()}>Replace</button></div>
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => selectArtwork(event.target.files?.[0])} />
                </div>
              )}

              <div className="seo-fields">
                <div className="seo-field-row">
                  <label><span>Product type</span><div className="select-wrap"><select value={productType} onChange={(event) => setProductType(event.target.value)}>{PRODUCT_TYPES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><ChevronDown size={14} /></div></label>
                  <label><span>Listing type</span><div className="select-wrap"><select value={listingType} onChange={(event) => { const value = event.target.value; setListingType(value); if (value !== "single-print") setFilePackage("custom"); }}>{LISTING_TYPES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><ChevronDown size={14} /></div></label>
                </div>
                <div className="seo-field-row">
                  <label><span>Artwork or collection name <em>Optional</em></span><input value={artworkName} maxLength={200} onChange={(event) => setArtworkName(event.target.value)} placeholder="Unknown is used when blank" /></label>
                  <label><span>AI-assisted artwork</span><div className="select-wrap"><select value={aiAssisted} onChange={(event) => setAiAssisted(event.target.value)}><option value="yes">Yes — include disclosure</option><option value="no">No — omit disclosure</option></select><ChevronDown size={14} /></div></label>
                </div>
                <div className="seo-field-row">
                  <label><span>File package</span><div className="select-wrap"><select value={filePackage} onChange={(event) => setFilePackage(event.target.value)}><option value="standard-single" disabled={listingType !== "single-print"}>{FILE_PACKAGES[0].label}</option><option value="custom">{FILE_PACKAGES[1].label}</option></select><ChevronDown size={14} /></div></label>
                  <label><span>Main keyword <em>Optional</em></span><input value={mainKeyword} maxLength={100} onChange={(event) => setMainKeyword(event.target.value)} placeholder="e.g. retro poppy wall art" /></label>
                </div>
                {filePackage === "standard-single" ? (
                  <div className="seo-preset-note"><Check size={14} /><div><strong>WallArtRoses standard package</strong><span>5 high-resolution 300 DPI JPGs · 2:3, 3:4, 4:5, 11:14 and A-series sizes</span></div></div>
                ) : (
                  <label><span>Exact files and delivery details</span><textarea value={digitalFiles} maxLength={3500} rows={5} onChange={(event) => setDigitalFiles(event.target.value)} placeholder="Exact number of artworks, JPGs, ZIP folders or PDFs; all ratios and sizes; and how Etsy delivers them." /><small>{digitalFiles.length} / 3500</small></label>
                )}
                <label><span>Preferred rooms or audience <em>Optional</em></span><input value={targetBuyer} maxLength={300} onChange={(event) => setTargetBuyer(event.target.value)} placeholder="e.g. mid-century living room, retro decor lovers" /></label>
                <label><span>Bestseller inspiration <em>Optional</em></span><textarea value={inspiration} maxLength={3500} rows={5} onChange={(event) => setInspiration(event.target.value)} placeholder="Paste a bestseller title, tags, or listing copy for keyword inspiration. Mocksy will not copy it." /><small>{inspiration.length} / 3500</small></label>
                <details className="seo-optional-panel">
                  <summary>Links and existing listing details <span>Optional</span></summary>
                  <div className="seo-optional-fields">
                    <label><span>Shop section URL</span><input type="url" value={shopSectionUrl} maxLength={600} onChange={(event) => setShopSectionUrl(event.target.value)} placeholder="https://www.etsy.com/shop/WallArtRoses/..." /></label>
                    <div className="seo-field-row">
                      <label><span>Exact set name</span><input value={exactSetName} maxLength={200} onChange={(event) => setExactSetName(event.target.value)} placeholder="Only if this exact art is included" /></label>
                      <label><span>Exact set Etsy URL</span><input type="url" value={exactSetUrl} maxLength={600} onChange={(event) => setExactSetUrl(event.target.value)} placeholder="https://www.etsy.com/listing/..." /></label>
                    </div>
                    <div className="seo-field-row">
                      <label><span>Additional exact set name</span><input value={additionalSetName} maxLength={200} onChange={(event) => setAdditionalSetName(event.target.value)} placeholder="Optional second confirmed set" /></label>
                      <label><span>Additional exact set Etsy URL</span><input type="url" value={additionalSetUrl} maxLength={600} onChange={(event) => setAdditionalSetUrl(event.target.value)} placeholder="https://www.etsy.com/listing/..." /></label>
                    </div>
                    <label><span>Existing title, tags, or description</span><textarea value={existingListing} maxLength={6000} rows={6} onChange={(event) => setExistingListing(event.target.value)} placeholder="Paste existing SEO here so GPT‑4o mini can improve it without copying unsupported claims." /><small>{existingListing.length} / 6000</small></label>
                  </div>
                </details>
                <div className="seo-style-field"><span>SEO style</span><div className="seo-style-options">{SEO_STYLES.map((style) => <button type="button" className={seoStyle === style.value ? "is-active" : ""} onClick={() => setSeoStyle(style.value)} key={style.value}><strong>{style.label}</strong><small>{style.note}</small></button>)}</div></div>
              </div>

              <button className="generate-button seo-generate-button" type="button" onClick={generateSeo} disabled={!artwork || generating || configured !== true}>
                {generating ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                <span>{generating ? "Analyzing artwork and building SEO…" : "Generate Etsy SEO"}</span>
                {!generating && <span className="button-arrow">→</span>}
              </button>
              {!artwork ? <p className="generate-hint">Add one image to begin.</p> : configured === false ? <p className="generate-hint is-error">Connect OpenAI in Settings to use GPT‑4o mini.</p> : <p className="generate-hint">The standard package is prefilled. Add links only when the artwork is genuinely included in those sets.</p>}
            </section>

            <section className="seo-output-card">
              <div className="seo-card-heading">
                <span className="section-number">02</span>
                <div><h2>Your listing SEO</h2><p>{result ? "Ready to copy or download." : "Results will appear here."}</p></div>
                {result && <button className="seo-reset-button" type="button" onClick={() => setResult(null)}><RotateCcw size={13} /> Regenerate</button>}
              </div>

              {!result ? (
                <div className={`seo-empty-state ${generating ? "is-loading" : ""}`}>
                  {generating ? <LoaderCircle className="spin" size={28} /> : <WandSparkles size={28} />}
                  <strong>{generating ? "GPT‑4o mini is studying the artwork" : "SEO, grounded in your image"}</strong>
                  <span>{generating ? "Creating a title, description, tags, and keyword plan." : "No keyword or inspiration is required. The model can infer the listing direction from the artwork."}</span>
                </div>
              ) : (
                <div className="seo-output-content">
                  <div className="seo-result-actions"><button type="button" onClick={() => copyValue("all", listingText(result))}>{copied === "all" ? <Check size={14} /> : <Copy size={14} />} {copied === "all" ? "Copied" : "Copy full listing"}</button><button type="button" onClick={downloadSeo}><Download size={14} /> Download .txt</button>{flowContext && <button className="flow-finish-button" type="button" onClick={reviewFullListing}>Review & create draft <ArrowRight size={14} /></button>}</div>

                  {result.visualAnalysis && (
                    <article className="seo-result-block seo-analysis-block">
                      <div><span>Visual and search analysis</span></div>
                      <dl>
                        <div><dt>Main subject</dt><dd>{result.visualAnalysis.mainSubject}</dd></div>
                        <div><dt>Colors</dt><dd>{[...result.visualAnalysis.dominantColors, ...result.visualAnalysis.secondaryColors].join(", ")}</dd></div>
                        <div><dt>Style & mood</dt><dd>{result.visualAnalysis.artStyle} · {result.visualAnalysis.mood}</dd></div>
                        <div><dt>Best rooms</dt><dd>{result.visualAnalysis.bestRooms.join(", ")}</dd></div>
                        <div><dt>Likely buyer</dt><dd>{result.visualAnalysis.likelyBuyer}</dd></div>
                      </dl>
                      <div className="seo-keyword-list">{result.visualAnalysis.longTailPhrases.map((phrase) => <span key={phrase}>{phrase}</span>)}</div>
                    </article>
                  )}

                  <article className="seo-result-block">
                    <div><span>Listing title</span><small>{result.title.length} / 140</small><button type="button" onClick={() => copyValue("title", result.title)} aria-label="Copy title">{copied === "title" ? <Check size={13} /> : <Copy size={13} />}</button></div>
                    <h3>{result.title}</h3>
                  </article>

                  <article className="seo-result-block">
                    <div><span>13 Etsy tags</span><button type="button" onClick={() => copyValue("tags", result.tags.join(", "))} aria-label="Copy tags">{copied === "tags" ? <Check size={13} /> : <Copy size={13} />}</button></div>
                    <ol className="seo-tag-list">{result.tags.map((tag, index) => <li key={tag}><b>{index + 1}</b><span>{tag}</span><small>{tag.length} / 20</small></li>)}</ol>
                  </article>

                  <article className="seo-result-block">
                    <div><span>Description</span><button type="button" onClick={() => copyValue("description", result.description)} aria-label="Copy description">{copied === "description" ? <Check size={13} /> : <Copy size={13} />}</button></div>
                    <p className="seo-description">{result.description}</p>
                  </article>

                  <div className="seo-result-grid">
                    <article className="seo-result-block"><div><span>Primary keyword</span></div><strong>{result.primaryKeyword}</strong><div className="seo-keyword-list">{result.secondaryKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></article>
                    <article className="seo-result-block"><div><span>Suggested attributes</span></div><div className="seo-attribute-list">{result.suggestedAttributes.map((attribute) => <span key={attribute}>{attribute}</span>)}</div></article>
                  </div>

                  <article className="seo-result-block compact"><div><span>Image alt text</span><button type="button" onClick={() => copyValue("alt", result.imageAltText)} aria-label="Copy alt text">{copied === "alt" ? <Check size={13} /> : <Copy size={13} />}</button></div><p>{result.imageAltText}</p></article>
                  <article className="seo-strategy"><Search size={15} /><div><strong>Keyword strategy</strong><p>{result.strategy}</p></div></article>
                  {result.qualityCheck && (
                    <article className="seo-quality-check"><strong>Final quality check</strong><div>{Object.entries(result.qualityCheck).map(([key, passed]) => <span className={passed ? "is-passed" : "is-warning"} key={key}>{passed ? <Check size={11} /> : <X size={11} />}{key.replace(/([A-Z])/g, " $1").toLowerCase()}</span>)}</div></article>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
