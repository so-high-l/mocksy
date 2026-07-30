"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Layers3,
  LoaderCircle,
  RotateCcw,
  Save,
  Settings,
  Store,
  Trash2,
  X,
} from "lucide-react";
import AppSidebar from "../components/app-sidebar";
import ThemeToggle from "../components/theme-toggle";
import {
  completeListingWorkflow,
  createListingWorkflow,
  getWorkflowAsset,
  loadListingWorkflow,
} from "../../lib/listing-workflow";
import {
  MAX_ETSY_IMAGE_BYTES,
  MAX_ETSY_LISTING_IMAGES,
  MAX_ETSY_TOTAL_IMAGE_BYTES,
} from "../../lib/etsy-listing";

const MANUAL_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ETSY_DRAFTS_URL = "https://www.etsy.com/your/shops/me/tools/listings?status=draft";

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function tagValues(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function imageName(file, index) {
  return file.name || `listing-image-${index + 1}.${file.type === "image/png" ? "png" : "jpg"}`;
}

export default function ListingReviewPage() {
  const imageInputRef = useRef(null);
  const imageUrlsRef = useRef([]);
  const [workflow, setWorkflow] = useState(null);
  const [images, setImages] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [price, setPrice] = useState("6.99");
  const [shopSectionId, setShopSectionId] = useState("");
  const [taxonomyId, setTaxonomyId] = useState("");
  const [etsyStatus, setEtsyStatus] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishingStage, setPublishingStage] = useState("");
  const [error, setError] = useState("");
  const [recoveryUrl, setRecoveryUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [draftResult, setDraftResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReview() {
      try {
        const search = new URLSearchParams(window.location.search);
        const flowId = search.get("flow");
        const saved = loadListingWorkflow();
        if (!flowId || !saved?.id || saved.id !== flowId) {
          throw new Error("This listing workflow is no longer available in this browser.");
        }
        if (!saved.seoResult) {
          throw new Error("Generate the listing SEO before opening final review.");
        }

        setWorkflow(saved);
        setTitle(saved.seoResult.title || "");
        setDescription(saved.seoResult.description || "");
        setTagsText((saved.seoResult.tags || []).join(", "));
        setDraftResult(saved.draftListing || null);
        try {
          setPrice(localStorage.getItem("mocksy-default-listing-price") || "6.99");
        } catch {
          setPrice("6.99");
        }

        const records = (await Promise.all(
          (saved.mockupAssetIds || []).map((assetId) => getWorkflowAsset(assetId).catch(() => null)),
        )).filter((record) => record?.blob);
        if (!cancelled) {
          const loadedImages = records.map((record, index) => {
            const url = URL.createObjectURL(record.blob);
            imageUrlsRef.current.push(url);
            return {
              id: record.id,
              name: record.name || `Listing image ${index + 1}`,
              type: record.type || record.blob.type,
              size: record.size || record.blob.size,
              blob: record.blob,
              url,
              selected: true,
              prompt: record.prompt || "",
            };
          });
          setImages(loadedImages);
          if (!loadedImages.length) {
            setNotice("No saved mockups were found. Add listing photos below before creating the Etsy draft.");
          }
        }

        const statusResponse = await fetch("/api/etsy/status", { cache: "no-store" });
        const status = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok) throw new Error(status.error || "Etsy connection status could not be loaded.");
        if (cancelled) return;
        setEtsyStatus(status);

        if (status.connected) {
          const metadataResponse = await fetch("/api/etsy/metadata", { cache: "no-store" });
          const metadataPayload = await metadataResponse.json().catch(() => ({}));
          if (!metadataResponse.ok) throw new Error(metadataPayload.error || "Etsy categories and sections could not be loaded.");
          if (cancelled) return;
          setMetadata(metadataPayload);
          setTaxonomyId(metadataPayload.defaultTaxonomyId ? String(metadataPayload.defaultTaxonomyId) : "");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "The final listing review could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReview();
    return () => {
      cancelled = true;
      imageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      imageUrlsRef.current = [];
    };
  }, []);

  function toggleImage(id) {
    setImages((current) => current.map((image) => image.id === id ? { ...image, selected: !image.selected } : image));
  }

  function moveImage(index, offset) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    setImages((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function removeImage(id) {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      imageUrlsRef.current = imageUrlsRef.current.filter((url) => url !== removed?.url);
      return current.filter((image) => image.id !== id);
    });
  }

  function addImages(fileList) {
    const files = Array.from(fileList || []);
    setError("");
    if (!files.length) return;
    const invalid = files.find((file) => !MANUAL_IMAGE_TYPES.has(file.type));
    if (invalid) {
      setError(`${invalid.name} is not a supported JPG, PNG, or WebP image.`);
      return;
    }
    const oversized = files.find((file) => file.size > MAX_ETSY_IMAGE_BYTES);
    if (oversized) {
      setError(`${oversized.name} is larger than Etsy’s 20 MB image limit.`);
      return;
    }
    if (images.length + files.length > MAX_ETSY_LISTING_IMAGES) {
      setError(`Etsy allows up to ${MAX_ETSY_LISTING_IMAGES} listing photos.`);
      return;
    }
    const additions = files.map((file, index) => {
      const url = URL.createObjectURL(file);
      imageUrlsRef.current.push(url);
      return {
        id: `manual-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: imageName(file, index),
        type: file.type,
        size: file.size,
        blob: file,
        url,
        selected: true,
        prompt: "Added during final review",
      };
    });
    setImages((current) => [...current, ...additions]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function createDraft() {
    if (!workflow || publishing || draftResult) return;
    const selectedImages = images.filter((image) => image.selected);
    const tags = tagValues(tagsText);
    const totalImageBytes = selectedImages.reduce((total, image) => total + Number(image.size || image.blob?.size || 0), 0);
    setError("");
    setRecoveryUrl("");
    setNotice("");

    if (!selectedImages.length) {
      setError("Choose at least one listing photo.");
      return;
    }
    const oversizedImage = selectedImages.find((image) => Number(image.size || image.blob?.size || 0) > MAX_ETSY_IMAGE_BYTES);
    if (oversizedImage) {
      setError(`${oversizedImage.name || "A selected image"} is larger than Etsy’s 20 MB image limit.`);
      return;
    }
    if (totalImageBytes > MAX_ETSY_TOTAL_IMAGE_BYTES) {
      setError("The selected photos exceed Mocksy’s 200 MB upload limit. Choose fewer or smaller photos.");
      return;
    }
    if (!title.trim()) {
      setError("Add a listing title.");
      return;
    }
    if (!description.trim()) {
      setError("Add a listing description.");
      return;
    }
    if (tags.length > 13) {
      setError("Etsy allows up to 13 tags.");
      return;
    }
    const longTag = tags.find((tag) => tag.length > 20);
    if (longTag) {
      setError(`Shorten “${longTag}” to 20 characters or fewer.`);
      return;
    }
    if (!taxonomyId) {
      setError("Choose an Etsy category.");
      return;
    }

    setPublishing(true);
    setPublishingStage("Preparing your reviewed listing and selected photos…");
    try {
      try {
        localStorage.setItem("mocksy-default-listing-price", price);
      } catch {
        // Remembering the price is optional.
      }
      const formData = new FormData();
      formData.append("listing", JSON.stringify({
        title,
        description,
        tags,
        price,
        taxonomyId,
        shopSectionId: shopSectionId || null,
      }));
      selectedImages.forEach((image, index) => {
        formData.append("images", image.blob, image.name || `listing-image-${index + 1}.jpg`);
      });

      setPublishingStage("Creating the Etsy draft and uploading photos… Keep this page open.");
      const response = await fetch("/api/etsy/drafts", { method: "POST", body: formData });
      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {};
      }
      if (!response.ok) {
        if (data.partial && data.listingId) {
          setDraftResult(data);
          completeListingWorkflow(workflow.id, data);
        }
        if (data.code === "ETSY_RECONNECT_REQUIRED" || response.status === 401) {
          setEtsyStatus((current) => ({ ...current, connected: false }));
        }
        if (data.manageUrl || data.checkDraftsFirst) {
          setRecoveryUrl(data.manageUrl || ETSY_DRAFTS_URL);
        }
        let message = data.error || data.message || "";
        if (!message && response.status === 413) {
          message = "The selected photos are too large for this server. Choose fewer or smaller photos.";
        } else if (!message && response.status === 401) {
          message = "Your Etsy connection expired. Reconnect Etsy in Settings, then return to Final Review.";
        } else if (!message && response.status >= 500) {
          message = "The server did not confirm the result. Check Etsy drafts before trying again.";
        } else if (!message) {
          message = "The Etsy draft could not be created.";
        }
        if (data.checkDraftsFirst && !message.toLowerCase().includes("check etsy")) {
          message += " Check Etsy drafts before trying again so you do not create a duplicate.";
        }
        const publishError = new Error(message);
        publishError.stage = data.stage || "server";
        throw publishError;
      }
      setDraftResult(data);
      completeListingWorkflow(workflow.id, data);
      setRecoveryUrl("");
      setNotice(`Draft ${data.listingId} was created in ${data.shopName || "your Etsy shop"} with ${data.uploadedImages} photos.`);
    } catch (publishError) {
      const networkFailure = publishError instanceof TypeError;
      if (networkFailure) setRecoveryUrl(ETSY_DRAFTS_URL);
      setError(
        networkFailure
          ? "The connection ended before Mocksy received Etsy’s answer. Check Etsy drafts before trying again so you do not create a duplicate."
          : publishError.message || "The Etsy draft could not be created.",
      );
    } finally {
      setPublishing(false);
      setPublishingStage("");
    }
  }

  function startNewListing() {
    createListingWorkflow();
    window.location.href = "/workflow";
  }

  const selectedImages = images.filter((image) => image.selected);
  const tags = tagValues(tagsText);
  const canPublish = Boolean(
    etsyStatus?.connected
    && metadata
    && selectedImages.length
    && title.trim()
    && description.trim()
    && tags.length
    && taxonomyId
    && !publishing
    && !draftResult,
  );

  if (loading) {
    return (
      <div className="app-shell app-with-sidebar listing-shell">
        <AppSidebar />
        <div className="app-workspace"><main className="workflow-loading"><LoaderCircle className="spin" size={24} /> Loading final listing review…</main></div>
      </div>
    );
  }

  return (
    <div className="app-shell app-with-sidebar listing-shell">
      <AppSidebar />
      <div className="app-workspace">
        <header className="topbar">
          <Link className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>mocksy</span></Link>
          <div className="topbar-right">
            <span className={`api-status ${etsyStatus?.connected ? "is-live" : ""}`}><span className="status-dot" />{etsyStatus?.connected ? `${etsyStatus.shopName} connected` : "Etsy not connected"}</span>
            <ThemeToggle />
            <Link className="settings-link" href="/settings#etsy"><Settings size={16} /><span>Settings</span></Link>
          </div>
        </header>

        <main className="listing-main">
          <section className="listing-hero">
            <div className="eyebrow"><span /> FINAL LISTING REVIEW</div>
            <h1>Review it once. <em>Draft it calmly.</em></h1>
            <p>Choose and order the final photos, refine the generated SEO, set the price and section, then save the listing to Etsy as a draft.</p>
          </section>

          {workflow && (
            <div className="flow-context-bar">
              <div><span>05</span><strong>Full listing flow</strong><small>Nothing is published live from this screen.</small></div>
              <Link href="/workflow">View workflow</Link>
            </div>
          )}

          {error && (
            <div className="message-bar is-error" role="alert">
              <span>
                {error}
                {recoveryUrl && <> <a href={recoveryUrl} target="_blank" rel="noreferrer">Check Etsy drafts <ExternalLink size={13} /></a></>}
              </span>
              <button type="button" onClick={() => { setError(""); setRecoveryUrl(""); }} aria-label="Dismiss error"><X size={16} /></button>
            </div>
          )}
          {notice && <div className="message-bar is-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16} /></button></div>}

          {draftResult ? (
            <section className={`listing-success-card ${draftResult.partial ? "is-partial" : ""}`}>
              <span><Check size={28} /></span>
              <div>
                <div className="eyebrow"><span /> ETSY DRAFT {draftResult.listingId}</div>
                <h2>{draftResult.partial ? "The draft exists, but needs image attention." : "Your Etsy draft is ready."}</h2>
                <p>
                  {draftResult.partial
                    ? draftResult.message || draftResult.error || "The Etsy draft exists, but one or more photos still need to be added in Etsy."
                    : `${draftResult.uploadedImages} selected photos and your reviewed listing copy are waiting in Etsy Shop Manager.`}
                </p>
                <div>
                  <a className="generate-button" href={draftResult.manageUrl} target="_blank" rel="noreferrer">Open Etsy drafts <ExternalLink size={16} /></a>
                  <button className="outline-button" type="button" onClick={startNewListing}><RotateCcw size={15} /> Start a new listing</button>
                </div>
              </div>
            </section>
          ) : (
            <>
              <div className="listing-review-grid">
                <section className="listing-editor-card listing-photos-card">
                  <div className="listing-card-heading">
                    <span className="section-number">01</span>
                    <div><h2>Listing photos</h2><p>Select the photos Etsy should receive and arrange their order. The first selected image becomes the primary photo.</p></div>
                    <span className="listing-count">{selectedImages.length} selected</span>
                  </div>

                  <div className="listing-photo-grid">
                    {images.map((image, index) => (
                      <article className={`listing-photo ${image.selected ? "is-selected" : ""}`} key={image.id}>
                        <button className="listing-photo-preview" type="button" onClick={() => toggleImage(image.id)} aria-pressed={image.selected}>
                          <img src={image.url} alt={image.name} />
                          <span className="listing-photo-check">{image.selected ? <Check size={14} /> : null}</span>
                          {image.selected && selectedImages[0]?.id === image.id && <strong>Primary</strong>}
                        </button>
                        <div className="listing-photo-meta">
                          <span><b>{String(index + 1).padStart(2, "0")}</b><small>{formatBytes(image.size)}</small></span>
                          <div>
                            <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label={`Move ${image.name} earlier`}><ChevronLeft size={14} /></button>
                            <button type="button" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} aria-label={`Move ${image.name} later`}><ChevronRight size={14} /></button>
                            <button type="button" onClick={() => removeImage(image.id)} aria-label={`Remove ${image.name}`}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {images.length < MAX_ETSY_LISTING_IMAGES && (
                      <button className="listing-add-photo" type="button" onClick={() => imageInputRef.current?.click()}>
                        <ImagePlus size={22} />
                        <strong>Add photos</strong>
                        <span>JPG, PNG or WebP</span>
                      </button>
                    )}
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => addImages(event.target.files)} />
                  <div className="listing-photo-foot"><span>{images.length} / {MAX_ETSY_LISTING_IMAGES} photos</span><small>WebP and transparent PNG files are converted to Etsy-safe JPGs before upload.</small></div>
                </section>

                <section className="listing-editor-card listing-copy-card">
                  <div className="listing-card-heading">
                    <span className="section-number">02</span>
                    <div><h2>Listing details</h2><p>Every generated field remains editable until you create the draft.</p></div>
                  </div>

                  <div className="listing-fields">
                    <label>
                      <span>Title <em>{title.length} / 140</em></span>
                      <textarea value={title} maxLength={140} rows={3} onChange={(event) => setTitle(event.target.value)} />
                    </label>
                    <label>
                      <span>Description <em>{description.length} characters</em></span>
                      <textarea value={description} maxLength={13000} rows={14} onChange={(event) => setDescription(event.target.value)} />
                    </label>
                    <label>
                      <span>Tags <em>{tags.length} / 13</em></span>
                      <textarea value={tagsText} rows={4} onChange={(event) => setTagsText(event.target.value)} placeholder="Separate tags with commas" />
                      <small>Separate tags with commas or new lines. Each tag can contain up to 20 characters.</small>
                    </label>
                    <div className="listing-tag-preview">
                      {tags.map((tag) => <span className={tag.length > 20 ? "is-invalid" : ""} key={tag}>{tag}<small>{tag.length}</small></span>)}
                    </div>

                    <div className="listing-field-row">
                      <label>
                        <span>Price <em>Required</em></span>
                        <div className="listing-price-input"><b>{metadata?.shop?.currencyCode || etsyStatus?.currencyCode || "USD"}</b><input type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></div>
                      </label>
                      <label>
                        <span>Shop section <em>Optional</em></span>
                        <select value={shopSectionId} onChange={(event) => setShopSectionId(event.target.value)} disabled={!metadata}>
                          <option value="">No section</option>
                          {(metadata?.sections || []).map((section) => <option value={section.id} key={section.id}>{section.title}</option>)}
                        </select>
                      </label>
                    </div>

                    <label>
                      <span>Etsy category <em>Required</em></span>
                      <select value={taxonomyId} onChange={(event) => setTaxonomyId(event.target.value)} disabled={!metadata}>
                        <option value="">{metadata ? "Choose category" : "Connect Etsy to load categories"}</option>
                        {(metadata?.categories || []).map((category) => <option value={category.id} key={category.id}>{category.path}</option>)}
                      </select>
                    </label>
                  </div>
                </section>
              </div>

              <section className="listing-publish-bar">
                <div>
                  <span><Store size={18} /></span>
                  <div>
                    <strong>{etsyStatus?.connected ? `Save to ${etsyStatus.shopName}` : "Connect Etsy to create the draft"}</strong>
                    <small role={publishing ? "status" : undefined}>
                      {publishingStage || `Creates an inactive Etsy draft with ${selectedImages.length} photos. It does not publish or activate the listing.`}
                    </small>
                  </div>
                </div>
                {etsyStatus?.connected ? (
                  <button className="generate-button" type="button" onClick={createDraft} disabled={!canPublish}>
                    {publishing ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
                    {publishing ? "Creating draft & uploading photos…" : "Create Etsy draft"}
                    {!publishing && <ArrowRight size={16} />}
                  </button>
                ) : (
                  <Link className="generate-button" href="/settings#etsy">Connect Etsy shop <ArrowRight size={16} /></Link>
                )}
              </section>
            </>
          )}

          <Link
            className="listing-back-link"
            href={workflow ? `/seo?flow=${encodeURIComponent(workflow.id)}&asset=${encodeURIComponent(workflow.selectedAssetId || "")}` : "/seo"}
          >
            <ArrowLeft size={14} /> Back to SEO
          </Link>
        </main>
      </div>
    </div>
  );
}
