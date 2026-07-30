"use client";

import { useRef, useState } from "react";
import { Check, Download, FileImage, Gauge, Layers3, LoaderCircle, Settings, ShieldCheck, UploadCloud, X } from "lucide-react";
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

export default function DpiPage() {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [items, setItems] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function processFiles(fileList) {
    const files = Array.from(fileList || []);
    setError("");
    if (!files.length) return;
    if (files.length > MAX_DPI_FILES) {
      setError(`Choose no more than ${MAX_DPI_FILES} images at a time.`);
      return;
    }
    const invalid = files.find((file) => !DPI_IMAGE_TYPES.has(file.type));
    if (invalid) {
      setError(`${invalid.name} is not supported. Use JPG or PNG images.`);
      return;
    }
    setProcessing(true);
    const initial = await Promise.all(files.map(async (file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      size: formatImageBytes(file.size),
      dimensions: (await getImageDimensions(file).catch(() => ({ label: "Image" }))).label,
      needsOptimization: file.size > MAX_ETSY_FILE_SIZE,
      status: "waiting",
    })));
    setItems(initial);

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: file.size > MAX_ETSY_FILE_SIZE ? "optimizing" : "processing" } : item));
      try {
        const output = await optimizeArtworkForEtsy(file);
        const { blob } = output;
        if (blob.size > MAX_ETSY_FILE_SIZE) throw new Error("The finished file is still above Etsy’s 20 MB limit.");
        downloadBlob(blob, file.name);
        setItems((current) => current.map((item, itemIndex) => itemIndex === index ? {
          ...item,
          status: "downloaded",
          blob,
          optimized: output.optimized,
          outputSize: formatImageBytes(blob.size),
          outputDimensions: output.dimensions || item.dimensions,
        } : item));
      } catch (conversionError) {
        setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: "failed", error: conversionError.message } : item));
      }
    }
    setProcessing(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadAgain(item) {
    if (item.blob) downloadBlob(item.blob, item.name);
  }

  function clearResults() {
    setItems([]);
    setError("");
  }

  return (
    <div className="app-shell app-with-sidebar dpi-shell">
      <AppSidebar />
      <div className="app-workspace">
        <header className="topbar">
          <a className="brand" href="/"><span className="brand-mark"><Layers3 size={17} /></span><span>mocksy</span></a>
          <div className="topbar-right"><span className="api-status is-live"><span className="status-dot" /> Works locally in your browser</span><ThemeToggle /><a className="settings-link" href="/settings" aria-label="Model and access settings"><Settings size={16} /><span>Settings</span></a></div>
        </header>

        <main className="dpi-main">
          <section className="dpi-hero">
            <div className="eyebrow"><span /> PRINT PREP</div>
            <h1>Make it <em>300 DPI.</em></h1>
            <p>Choose up to five images. Mocksy makes them 300 DPI, keeps the best quality possible, and ensures every download is under 20 MB.</p>
          </section>

          {error && <div className="message-bar is-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}

          <section className="dpi-card">
            <div className="dpi-card-heading">
              <span className="dpi-feature-icon"><Gauge size={22} /></span>
              <div><h2>300 DPI + Etsy optimizer</h2><p>JPG or PNG · up to 5 files · no input-size cap · every output below 20 MB</p></div>
              {items.length > 0 && !processing && <button className="text-button" type="button" onClick={clearResults}>Clear</button>}
            </div>

            {!items.length ? (
              <div
                className={`dpi-dropzone ${dragActive ? "is-dragging" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => { event.preventDefault(); setDragActive(false); processFiles(event.dataTransfer.files); }}
              >
                <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={(event) => processFiles(event.target.files)} />
                <span className="dpi-upload-icon"><UploadCloud size={27} /></span>
                <h3>Drop your images here</h3>
                <p>They stay on this device and start downloading automatically.</p>
                <button className="generate-button dpi-choose-button" type="button" onClick={() => inputRef.current?.click()}>
                  <FileImage size={18} /> Choose up to 5 images
                </button>
              </div>
            ) : (
              <div className="dpi-results" aria-live="polite">
                <div className="dpi-progress-summary">
                  <div><strong>{processing ? "Preparing your downloads…" : "Your 300 DPI files are ready"}</strong><span>{processing ? "Keep this page open for a moment." : `${items.filter((item) => item.status === "downloaded").length} file${items.length === 1 ? "" : "s"} downloaded with original names.`}</span></div>
                  <span className="dpi-count">{items.length} / {MAX_DPI_FILES}</span>
                </div>
                <div className="dpi-file-list">
                  {items.map((item) => (
                    <div className={`dpi-file-row is-${item.status}`} key={item.id}>
                      <span className="dpi-file-icon"><FileImage size={18} /></span>
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.outputDimensions || item.dimensions} · {item.outputSize || item.size}
                          {item.optimized ? " · Etsy optimized" : ""}
                        </span>
                        {item.error && <small>{item.error}</small>}
                      </div>
                      <span className="dpi-file-status">
                        {item.status === "processing" && <><LoaderCircle className="spin" size={15} /> Converting</>}
                        {item.status === "optimizing" && <><LoaderCircle className="spin" size={15} /> Optimizing</>}
                        {item.status === "waiting" && <>Waiting</>}
                        {item.status === "downloaded" && <><Check size={15} /> 300 DPI · Etsy ready</>}
                        {item.status === "failed" && <>Failed</>}
                      </span>
                      {item.status === "downloaded" && <button type="button" onClick={() => downloadAgain(item)} aria-label={`Download ${item.name} again`}><Download size={15} /></button>}
                    </div>
                  ))}
                </div>
                {!processing && <button className="outline-button dpi-another-button" type="button" onClick={clearResults}>Convert another set</button>}
              </div>
            )}

            <div className="dpi-privacy-note"><ShieldCheck size={16} /><div><strong>Private and quality-first</strong><span>Files under 20 MB stay lossless. Larger files are optimized only as much as needed to meet Etsy’s limit, and processing always stays on this device.</span></div></div>
          </section>
        </main>
      </div>
    </div>
  );
}
