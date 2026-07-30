"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Download,
  Image as ImageIcon,
  Layers3,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
  ZoomIn,
} from "lucide-react";
import { DEFAULT_MODEL_ID, getModel, MODEL_OPTIONS } from "../lib/models";
import { artworkDetailResult, createArtworkDetail } from "../lib/artwork-detail";
import {
  getWorkflowAsset,
  saveWorkflowAsset,
  saveWorkflowListingImage,
  setListingWorkflowStep,
} from "../lib/listing-workflow";
import { createWhatsIncludedPage, whatsIncludedResult } from "../lib/whats-included";
import AppSidebar from "./components/app-sidebar";
import ThemeToggle from "./components/theme-toggle";

const DEFAULT_PROMPTS = [
  {
    id: "hero-warm-bedroom",
    title: "Hero warm bedroom",
    text: "Create a premium Etsy hero mockup using the uploaded artwork exactly as provided. Place the artwork above a softly styled bed in a warm neutral bedroom with cream linen bedding, warm beige plaster walls, soft natural window light, minimal decor, and an elevated editorial atmosphere. Keep the artwork large, centered, and the main focal point. Do not alter the artwork.",
  },
  {
    id: "sunlit-living-room",
    title: "Sunlit living room",
    text: "Create a refined living room mockup using the uploaded artwork exactly as provided. Show the artwork on a warm off-white or greige plaster wall with soft natural daylight, light wood furniture, neutral linen textures, and one or two tasteful organic decor accents. Keep the scene clean, warm, premium, and realistic. Do not alter the artwork.",
  },
  {
    id: "console-table",
    title: "Console table",
    text: "Create a premium Etsy mockup using the uploaded artwork exactly as provided. Place the artwork above a light wood console table against a warm beige or soft taupe plaster wall. Add minimal styling: a ceramic vase with dried stems, a small stack of books, and one subtle sculptural object. Use soft directional daylight and keep the artwork as the hero. Do not alter the artwork.",
  },
  {
    id: "gallery-closeup",
    title: "Gallery close-up",
    text: "Create a close-up premium mockup of the uploaded artwork exactly as provided. Show the artwork with crisp visible detail, realistic shadows, subtle wall texture, and soft natural side lighting. Keep the background warm off-white or plaster beige with minimal negative space. The focus should be on the artwork quality and presentation. Do not alter the artwork.",
  },
  {
    id: "reading-nook",
    title: "Reading nook",
    text: "Create a warm editorial reading nook mockup using the uploaded artwork exactly as provided. Place the artwork above or beside a neutral upholstered chair, small side table, ceramic vase, and a few books. Use warm greige walls, soft daylight, calm organic styling, and a premium Etsy listing look. Keep the artwork clearly visible and dominant. Do not alter the artwork.",
  },
  {
    id: "minimal-entryway",
    title: "Minimal entryway",
    text: "Create a refined entryway mockup using the uploaded artwork exactly as provided. Place the artwork above a slim wood bench or console in a warm neutral hallway with plaster walls, soft daylight, subtle shadows, and minimal organic decor. Keep the palette creamy beige, taupe, light wood, and warm neutrals. The artwork must remain the focal point. Do not alter the artwork.",
  },
  {
    id: "neutral-dining-corner",
    title: "Dining corner",
    text: "Create a premium dining corner mockup using the uploaded artwork exactly as provided. Show the artwork on a warm neutral wall above a simple light wood dining setup with soft linen, ceramic tableware, and minimal styling. Use natural daylight and a calm organic mid-century modern mood. Keep everything cohesive, clean, and conversion-focused. Do not alter the artwork.",
  },
  {
    id: "soft-bedroom-wide",
    title: "Bedroom wide shot",
    text: "Create a wide bedroom lifestyle mockup using the uploaded artwork exactly as provided. Place the artwork above a bed with warm cream linen bedding, muted taupe accents, soft pillows, and natural window light. The room should feel premium, warm, calm, and professionally photographed. Keep the artwork large enough to be clearly seen. Do not alter the artwork.",
  },
  {
    id: "luxury-bathroom",
    title: "Luxury bathroom",
    text: "Create a sophisticated bathroom mockup using the uploaded artwork exactly as provided. Place the artwork on a warm plaster wall near a freestanding bathtub or elegant vanity. Use cream stone, soft taupe, natural light, minimal candles or ceramic accents, and a refined spa-like atmosphere. Keep the styling consistent, warm, and premium. Do not alter the artwork.",
  },
  {
    id: "creative-desk",
    title: "Creative desk",
    text: "Create a sophisticated home-studio desk mockup using the uploaded artwork exactly as provided. Place the artwork above a light wood desk with only a closed notebook, ceramic cup, and small neutral decor object. Use warm plaster walls, soft daylight, muted neutral styling, and realistic commercial lifestyle photography. Keep the artwork as the main focal point. Do not alter the artwork.",
  },
  {
    id: "large-scale-wall",
    title: "Large scale wall",
    text: "Create a premium large-scale wall mockup using the uploaded artwork exactly as provided. Show the artwork displayed prominently on a warm off-white or greige plaster wall with minimal furniture beneath it for scale. Use soft natural light, clean negative space, and refined organic modern styling. The image should communicate size, quality, and premium home decor value. Do not alter the artwork.",
  },
  {
    id: "small-space-styling",
    title: "Small space styling",
    text: "Create a cozy small-space mockup using the uploaded artwork exactly as provided. Place the artwork in a compact but elegant corner with a small side table, ceramic vase, warm neutral wall, and soft natural light. Keep the scene minimal, warm, airy, and realistic for Etsy buyers decorating apartments or bedrooms. Do not alter the artwork.",
  },
  {
    id: "mantel-styling",
    title: "Mantel styling",
    text: "Create a refined mantel or shelf styling mockup using the uploaded artwork exactly as provided. Show the artwork above or leaning slightly near a warm neutral mantel or shelf with minimal ceramics, dried stems, and soft natural shadows. Use a creamy beige, taupe, and light wood palette. Keep the scene elegant, cohesive, and premium. Do not alter the artwork.",
  },
  {
    id: "neutral-living-sofa",
    title: "Sofa wall mockup",
    text: "Create a premium sofa wall mockup using the uploaded artwork exactly as provided. Place the artwork above a neutral linen sofa with warm beige pillows, a soft throw, light wood accents, and a calm organic modern interior. Use warm off-white plaster walls and soft window light. Keep the artwork large, centered, and highly visible. Do not alter the artwork.",
  },
  {
    id: "editorial-detail-corner",
    title: "Editorial detail corner",
    text: "Create an editorial detail mockup using the uploaded artwork exactly as provided. Show the artwork in a warm neutral corner with soft side light, subtle plaster wall texture, and a small portion of tasteful decor such as dried branches or ceramic objects. The scene should feel premium, intimate, and cohesive with the full listing. Do not alter the artwork.",
  },
  {
    id: "bright-airy-gallery",
    title: "Bright airy gallery",
    text: "Create a bright airy gallery-style mockup using the uploaded artwork exactly as provided. Place the artwork on a warm off-white plaster wall with clean negative space, soft natural daylight, realistic shadows, and a minimal premium interior feel. Keep styling extremely simple so the artwork stands out clearly in Etsy search. Do not alter the artwork.",
  },
  {
    id: "bedside-vignette",
    title: "Bedside vignette",
    text: "Create a warm bedside vignette mockup using the uploaded artwork exactly as provided. Place the artwork above or near a light wood bedside table with a ceramic lamp, neutral linen bedding, and soft natural window light. Use warm beige, cream, taupe, and organic textures. Keep the mood calm, premium, and cohesive. Do not alter the artwork.",
  },
  {
    id: "scale-reference-room",
    title: "Scale reference",
    text: "Create a clean scale-reference mockup using the uploaded artwork exactly as provided. Display the artwork on a warm neutral wall with simple furniture beneath it, such as a console table, bench, or chair, to communicate size. Use soft daylight, minimal styling, and a refined organic modern palette. Keep the artwork clear and unchanged.",
  },
];

const PROMPT_LIBRARY_VERSION = "2";
const MODEL_SELECTION_VERSION = "nano-banana-2-lite-default-v1";
const ACTIVE_BATCH_STORAGE_KEY = "mocksy-active-batch-v1";
const MAX_BATCH_AGE = 49 * 60 * 60 * 1000;
const MAX_MOCKUPS = 15;

const ASPECT_RATIOS = [
  { value: "4:5", label: "4:5", hint: "Etsy" },
  { value: "1:1", label: "1:1", hint: "Square" },
  { value: "3:2", label: "3:2", hint: "Wide" },
  { value: "16:9", label: "16:9", hint: "Banner" },
];

const GENERATION_MESSAGES = [
  "Reading your artwork…",
  "Choosing one perfect frame…",
  "Uploading your artwork once…",
  "Preparing the discounted batch…",
  "Sending the batch to Google…",
];

function makeSubmissionId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) return window.crypto.randomUUID().toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function resultBlob(result) {
  return result.blob || dataUrlToBlob(result.dataUrl);
}

function batchPollDelay(createdAt, failedAttempts = 0) {
  if (failedAttempts) return Math.min(60_000, 8_000 * 2 ** Math.min(failedAttempts - 1, 3));
  const age = createdAt ? Date.now() - new Date(createdAt).getTime() : 0;
  if (age < 60_000) return 10_000;
  if (age < 10 * 60_000) return 30_000;
  return 60_000;
}

function batchProgress(status, count) {
  const total = status?.progress?.total || count || 1;
  const finished = (status?.progress?.successful || 0) + (status?.progress?.failed || 0);
  if (status?.successful) return 100;
  if (status?.terminal) return Math.max(8, Math.round((finished / total) * 100));
  return Math.max(4, Math.min(94, Math.round((finished / total) * 100)));
}

function shouldPollBatch(job) {
  if (!job?.displayName) return false;
  if (job.name) return true;
  return ["creating_batch", "recovering"].includes(job.phase);
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "application/octet-stream";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function makeAnalysisThumbnail(file, { maxSide = 1200, quality = 0.84, filename = "frame-analysis.jpg" } = {}) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("The artwork preview could not be prepared."));
      image.src = sourceUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("The artwork preview could not be prepared.");
    return new File([blob], filename, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function uploadFileToGoogle(uploadUrl, file, onProgress, chunkGranularity = 2 * 1024 * 1024) {
  const chunkSize = Math.max(256 * 1024, chunkGranularity || 2 * 1024 * 1024);
  let offset = 0;
  let uploadedFile = null;

  while (offset < file.size) {
    const nextOffset = Math.min(offset + chunkSize, file.size);
    const finalize = nextOffset >= file.size;
    const formData = new FormData();
    formData.append("uploadUrl", uploadUrl);
    formData.append("offset", String(offset));
    formData.append("finalize", String(finalize));
    formData.append("chunk", file.slice(offset, nextOffset, file.type), `artwork-part-${offset}`);

    const response = await fetch("/api/generate/batch/upload/chunk", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The artwork upload was interrupted.");
    if (finalize) uploadedFile = payload.file;
    offset = nextOffset;
    onProgress(Math.round((offset / file.size) * 100));
  }

  if (!uploadedFile?.name) throw new Error("Google uploaded the artwork but did not return its file reference.");
  return uploadedFile;
}

async function loadSavedArtworkDetail(job) {
  if (!job?.detailAssetId) return null;
  const asset = await getWorkflowAsset(job.detailAssetId);
  if (!asset?.blob) return null;
  return artworkDetailResult({
    blob: asset.blob,
    filename: asset.name,
    width: job.detailWidth,
    height: job.detailHeight,
    aspectRatio: job.aspectRatio,
  });
}

async function loadSavedWhatsIncluded(job) {
  if (!job?.whatsIncludedAssetId) return null;
  const asset = await getWorkflowAsset(job.whatsIncludedAssetId);
  if (!asset?.blob) return null;
  return whatsIncludedResult({
    blob: asset.blob,
    filename: asset.name,
    width: job.whatsIncludedWidth,
    height: job.whatsIncludedHeight,
  });
}

export default function Home() {
  const fileInputRef = useRef(null);
  const whatsIncludedTemplateInputRef = useRef(null);
  const resultsRef = useRef(null);
  const artworkUrlRef = useRef(null);
  const resultUrlsRef = useRef([]);
  const hydratedBatchRef = useRef("");
  const batchPollInFlightRef = useRef(false);
  const frameAnalysisRef = useRef("");
  const detailPreparationRef = useRef(0);
  const includedPreparationRef = useRef(0);
  const [artwork, setArtwork] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [prompts, setPrompts] = useState(() => DEFAULT_PROMPTS.map((prompt) => ({ ...prompt })));
  const [selectedPromptIds, setSelectedPromptIds] = useState([DEFAULT_PROMPTS[0].id]);
  const [editingId, setEditingId] = useState(null);
  const [noPrompt, setNoPrompt] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [imageSize, setImageSize] = useState("2K");
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [googleMode, setGoogleMode] = useState("direct");
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState(GENERATION_MESSAGES[0]);
  const [results, setResults] = useState([]);
  const [selectedResults, setSelectedResults] = useState(new Set());
  const [lightboxResult, setLightboxResult] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [apiConfigured, setApiConfigured] = useState(null);
  const [frameConfigured, setFrameConfigured] = useState(null);
  const [frameProfile, setFrameProfile] = useState(null);
  const [frameAnalyzing, setFrameAnalyzing] = useState(false);
  const [frameError, setFrameError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [flowContinuing, setFlowContinuing] = useState(false);
  const [batchJob, setBatchJob] = useState(null);
  const [batchStatus, setBatchStatus] = useState(null);
  const [batchConnectionError, setBatchConnectionError] = useState("");
  const [batchLoadingResults, setBatchLoadingResults] = useState(false);
  const [cancellingBatch, setCancellingBatch] = useState(false);
  const [batchRefreshKey, setBatchRefreshKey] = useState(0);
  const [flowContext, setFlowContext] = useState(null);
  const [includeArtworkDetail, setIncludeArtworkDetail] = useState(true);
  const [includeWhatsIncluded, setIncludeWhatsIncluded] = useState(true);
  const [artworkDetail, setArtworkDetail] = useState(null);
  const [detailPreparing, setDetailPreparing] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [whatsIncludedTemplate, setWhatsIncludedTemplate] = useState(null);
  const [whatsIncludedPage, setWhatsIncludedPage] = useState(null);
  const [whatsIncludedPreparing, setWhatsIncludedPreparing] = useState(false);
  const [whatsIncludedError, setWhatsIncludedError] = useState("");

  const replaceResults = useCallback((nextResults) => {
    resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrlsRef.current = nextResults
      .map((result) => result.dataUrl)
      .filter((url) => typeof url === "string" && url.startsWith("blob:"));
    setResults(nextResults);
    setSelectedResults(new Set());
    setLightboxResult(null);
  }, []);

  const storeBatchJob = useCallback((job) => {
    setBatchJob(job);
    try {
      localStorage.setItem(ACTIVE_BATCH_STORAGE_KEY, JSON.stringify(job));
    } catch {
      // The live page still tracks the job if browser storage is unavailable.
    }
  }, []);

  const forgetBatchJob = useCallback(() => {
    setBatchJob(null);
    setBatchStatus(null);
    setBatchConnectionError("");
    hydratedBatchRef.current = "";
    try {
      localStorage.removeItem(ACTIVE_BATCH_STORAGE_KEY);
    } catch {
      // Nothing else is required if browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    let workflowLoadCancelled = false;
    try {
      const saved = localStorage.getItem("mocksy-prompts");
      const savedVersion = localStorage.getItem("mocksy-prompts-version");
      if (saved && savedVersion === PROMPT_LIBRARY_VERSION) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setPrompts(parsed);
      } else {
        const parsed = saved ? JSON.parse(saved) : [];
        const customPrompts = Array.isArray(parsed)
          ? parsed.filter((prompt) => typeof prompt?.id === "string" && prompt.id.startsWith("custom-"))
          : [];
        const upgraded = [...DEFAULT_PROMPTS.map((prompt) => ({ ...prompt })), ...customPrompts];
        setPrompts(upgraded);
        localStorage.setItem("mocksy-prompts", JSON.stringify(upgraded));
        localStorage.setItem("mocksy-prompts-version", PROMPT_LIBRARY_VERSION);
      }
    } catch {
      // Keep the carefully chosen defaults if local storage is unavailable.
    }

    try {
      const savedModel = localStorage.getItem("mocksy-model");
      const savedModelVersion = localStorage.getItem("mocksy-model-selection-version");
      if (savedModelVersion === MODEL_SELECTION_VERSION && MODEL_OPTIONS.some((model) => model.id === savedModel)) {
        setModelId(savedModel);
      } else {
        setModelId(DEFAULT_MODEL_ID);
        localStorage.setItem("mocksy-model", DEFAULT_MODEL_ID);
        localStorage.setItem("mocksy-model-selection-version", MODEL_SELECTION_VERSION);
      }
      const savedGoogleMode = localStorage.getItem("mocksy-google-mode");
      if (["direct", "batch"].includes(savedGoogleMode)) setGoogleMode(savedGoogleMode);
    } catch {
      // The default model remains available if browser storage is unavailable.
    }

    try {
      const savedBatch = JSON.parse(localStorage.getItem(ACTIVE_BATCH_STORAGE_KEY) || "null");
      const createdAt = savedBatch?.createdAt ? new Date(savedBatch.createdAt).getTime() : 0;
      if (savedBatch?.displayName && createdAt && Date.now() - createdAt < MAX_BATCH_AGE) {
        const interruptedBeforeSubmit = !savedBatch.name && !["creating_batch", "recovering", "tracking"].includes(savedBatch.phase);
        const restoredBatch = interruptedBeforeSubmit
          ? {
              ...savedBatch,
              phase: "interrupted",
              status: {
                state: "SUBMISSION_INTERRUPTED",
                stateLabel: "Not submitted",
                terminal: true,
                successful: false,
                progress: { total: savedBatch.count || 1, successful: 0, failed: 0, pending: 0 },
                error: "Mocksy was interrupted before the Google batch was created. Start a new batch when you are ready.",
              },
            }
          : {
              ...savedBatch,
              phase: savedBatch.phase === "creating_batch" ? "recovering" : savedBatch.phase,
            };
        setBatchJob(restoredBatch);
        setBatchStatus(restoredBatch.status || {
          state: savedBatch.name ? "JOB_STATE_PENDING" : "SUBMITTING",
          stateLabel: savedBatch.name ? "Checking Google" : "Recovering submission",
          terminal: false,
          successful: false,
          progress: { total: savedBatch.count || 1, successful: 0, failed: 0, pending: savedBatch.count || 1 },
        });
        if (interruptedBeforeSubmit) localStorage.setItem(ACTIVE_BATCH_STORAGE_KEY, JSON.stringify(restoredBatch));
        if (savedBatch.frameProfile) setFrameProfile(savedBatch.frameProfile);
      } else if (savedBatch) {
        localStorage.removeItem(ACTIVE_BATCH_STORAGE_KEY);
      }
    } catch {
      try {
        localStorage.removeItem(ACTIVE_BATCH_STORAGE_KEY);
      } catch {
        // The page can still run without batch restoration.
      }
    }

    const search = new URLSearchParams(window.location.search);
    const flowId = search.get("flow");
    const assetId = search.get("asset");
    if (flowId && assetId) {
      setFlowContext({ flowId, assetId });
      getWorkflowAsset(assetId)
        .then((asset) => {
          if (workflowLoadCancelled) return;
          if (!asset?.blob) throw new Error("The prepared workflow artwork is no longer available in this browser.");
          const file = new File([asset.blob], asset.name, { type: asset.type, lastModified: asset.lastModified || Date.now() });
          return readArtwork(file);
        })
        .catch((workflowError) => {
          if (!workflowLoadCancelled) setError(workflowError.message || "The workflow artwork could not be loaded.");
        });
    }

    return () => {
      workflowLoadCancelled = true;
      if (artworkUrlRef.current) URL.revokeObjectURL(artworkUrlRef.current);
      resultUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mocksy-prompts", JSON.stringify(prompts));
    } catch {
      // Prompt saving is a convenience, never a requirement.
    }
  }, [prompts]);

  const selectedModel = useMemo(() => getModel(modelId), [modelId]);

  useEffect(() => {
    try {
      localStorage.setItem("mocksy-model", modelId);
      localStorage.setItem("mocksy-model-selection-version", MODEL_SELECTION_VERSION);
      localStorage.setItem("mocksy-google-mode", googleMode);
    } catch {
      // The default model remains available if local storage is unavailable.
    }
    if (!selectedModel.sizes.includes(imageSize)) setImageSize(selectedModel.sizes[0]);
    if (!selectedModel.batch && googleMode === "batch") setGoogleMode("direct");
    setApiConfigured(null);
    setFrameConfigured(null);
    fetch(`/api/status?model=${encodeURIComponent(modelId)}`)
      .then((response) => response.json())
      .then((data) => {
        setApiConfigured(Boolean(data.configured));
        setFrameConfigured(Boolean(data.frameConfigured));
      })
      .catch(() => {
        setApiConfigured(false);
        setFrameConfigured(false);
      });
  }, [modelId, selectedModel, imageSize, googleMode]);

  useEffect(() => {
    const requestId = detailPreparationRef.current + 1;
    detailPreparationRef.current = requestId;
    if (!artwork?.file) {
      setArtworkDetail(null);
      setDetailPreparing(false);
      setDetailError("");
      return undefined;
    }

    let cancelled = false;
    setDetailPreparing(true);
    setDetailError("");
    createArtworkDetail(artwork.file, { aspectRatio, imageSize })
      .then((detail) => {
        if (!cancelled && detailPreparationRef.current === requestId) setArtworkDetail(detail);
      })
      .catch((detailFailure) => {
        if (!cancelled && detailPreparationRef.current === requestId) {
          setArtworkDetail(null);
          setDetailError(detailFailure.message || "The free artwork detail could not be prepared.");
        }
      })
      .finally(() => {
        if (!cancelled && detailPreparationRef.current === requestId) setDetailPreparing(false);
      });
    return () => { cancelled = true; };
  }, [artwork?.file, aspectRatio, imageSize]);

  useEffect(() => {
    const requestId = includedPreparationRef.current + 1;
    includedPreparationRef.current = requestId;
    if (!artwork?.file) {
      setWhatsIncludedPage(null);
      setWhatsIncludedPreparing(false);
      setWhatsIncludedError("");
      return undefined;
    }

    let cancelled = false;
    setWhatsIncludedPreparing(true);
    setWhatsIncludedError("");
    createWhatsIncludedPage(artwork.file, { templateFile: whatsIncludedTemplate, imageSize })
      .then((page) => {
        if (!cancelled && includedPreparationRef.current === requestId) setWhatsIncludedPage(page);
      })
      .catch((includedFailure) => {
        if (!cancelled && includedPreparationRef.current === requestId) {
          setWhatsIncludedPage(null);
          setWhatsIncludedError(includedFailure.message || "The what's included page could not be prepared.");
        }
      })
      .finally(() => {
        if (!cancelled && includedPreparationRef.current === requestId) setWhatsIncludedPreparing(false);
      });
    return () => { cancelled = true; };
  }, [artwork?.file, whatsIncludedTemplate, imageSize]);

  useEffect(() => {
    if (!generating) return undefined;
    let index = 0;
    const timer = setInterval(() => {
      index = Math.min(index + 1, GENERATION_MESSAGES.length - 1);
      setGenerationMessage(GENERATION_MESSAGES[index]);
    }, 5500);
    return () => clearInterval(timer);
  }, [generating]);

  const selectedPrompts = useMemo(
    () => prompts.filter((prompt) => selectedPromptIds.includes(prompt.id) && prompt.text.trim()),
    [prompts, selectedPromptIds],
  );
  const count = noPrompt ? 1 : selectedPrompts.length;
  const selectedFreeCount = Number(includeArtworkDetail) + Number(includeWhatsIncluded);

  const loadBatchImages = useCallback(async (status, job) => {
    if (!job?.name || !status?.successful || hydratedBatchRef.current === job.name) return;
    setBatchLoadingResults(true);
    const descriptors = Array.isArray(status.results) ? status.results : [];
    const freeResults = (await Promise.all([
      loadSavedArtworkDetail(job).catch(() => null),
      loadSavedWhatsIncluded(job).catch(() => null),
    ])).filter(Boolean);
    if (!descriptors.length) {
      if (freeResults.length) replaceResults(freeResults);
      setBatchConnectionError("Google completed the batch, but no mockup images were returned.");
      setBatchLoadingResults(false);
      return;
    }

    const settled = await Promise.allSettled(descriptors.map(async (descriptor) => {
      const params = new URLSearchParams({ name: job.name, index: String(descriptor.index) });
      const response = await fetch(`/api/generate/batch/image?${params.toString()}`, { cache: "no-store" });
      if (response.status === 401) throw new Error("Your session expired. Sign in again to retrieve the mockups.");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Mockup ${descriptor.index + 1} could not be retrieved.`);
      }
      const blob = await response.blob();
      return { ...descriptor, blob, dataUrl: URL.createObjectURL(blob) };
    }));

    const loaded = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .sort((a, b) => a.index - b.index);
    const failures = settled.filter((result) => result.status === "rejected");
    const freeNotice = freeResults.length
      ? ` and ${freeResults.length} free listing image${freeResults.length === 1 ? "" : "s"}`
      : "";

    if (loaded.length || freeResults.length) {
      replaceResults([...loaded, ...freeResults]);
      setFrameProfile(job.frameProfile || null);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
    if (!failures.length) {
      hydratedBatchRef.current = job.name;
      setBatchConnectionError("");
      const requestFailures = status.requestErrors?.length || 0;
      setNotice(
        requestFailures
          ? `${loaded.length} mockups${freeNotice} are ready. Google could not create ${requestFailures} of the requested scenes.`
          : `${loaded.length} discounted batch mockup${loaded.length === 1 ? "" : "s"}${freeNotice} ${loaded.length === 1 && !freeResults.length ? "is" : "are"} ready to download.`,
      );
    } else {
      setBatchConnectionError(
        loaded.length
          ? `${failures.length} finished mockup${failures.length === 1 ? "" : "s"} could not be downloaded. Use Retry images below.`
          : failures[0].reason?.message || "The finished mockups could not be downloaded.",
      );
    }
    setBatchLoadingResults(false);
  }, [replaceResults]);

  useEffect(() => {
    if (
      !shouldPollBatch(batchJob)
      || batchJob?.status?.state === "RECOVERY_FAILED"
    ) return undefined;
    let stopped = false;
    let timer;
    let failedAttempts = 0;

    const schedule = (delay) => {
      if (!stopped) timer = window.setTimeout(checkBatch, delay);
    };

    const checkBatch = async () => {
      if (stopped || batchPollInFlightRef.current) return;
      if (document.visibilityState === "hidden") {
        schedule(60_000);
        return;
      }
      batchPollInFlightRef.current = true;
      try {
        const params = batchJob.name
          ? new URLSearchParams({ name: batchJob.name })
          : new URLSearchParams({ displayName: batchJob.displayName });
        const response = await fetch(`/api/generate/batch?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!batchJob.name && response.status === 404) {
            const failedStatus = {
              state: "RECOVERY_FAILED",
              stateLabel: "Submission not found",
              terminal: true,
              successful: false,
              progress: { total: batchJob.count || 1, successful: 0, failed: 0, pending: 0 },
              error: "Google does not show this batch. Check Google AI Studio before submitting again, since batch creation cannot be safely retried automatically.",
            };
            setBatchStatus(failedStatus);
            storeBatchJob({ ...batchJob, status: failedStatus });
            return;
          }
          throw new Error(payload.error || "The batch status could not be checked.");
        }

        if (stopped) return;
        failedAttempts = 0;
        const nextStatus = payload.batch;
        const nextJob = {
          ...batchJob,
          name: payload.batch.name || batchJob.name,
          displayName: payload.batch.displayName || batchJob.displayName,
          createdAt: payload.batch.createTime || batchJob.createdAt,
          status: nextStatus,
        };
        setBatchStatus(nextStatus);
        storeBatchJob(nextJob);
        setBatchConnectionError("");

        if (nextStatus.terminal) {
          if (nextStatus.successful) await loadBatchImages(nextStatus, nextJob);
          return;
        }
        schedule(batchPollDelay(nextJob.createdAt));
      } catch (pollError) {
        if (stopped) return;
        failedAttempts += 1;
        setBatchConnectionError(
          `${pollError.message || "The status check failed."} Your Google batch is still safe; Mocksy will keep retrying.`,
        );
        schedule(batchPollDelay(batchJob.createdAt, failedAttempts));
      } finally {
        batchPollInFlightRef.current = false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        checkBatch();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    checkBatch();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [batchJob?.name, batchJob?.displayName, batchJob?.phase, batchJob?.status?.state, batchRefreshKey, loadBatchImages, storeBatchJob]);

  const batchActive = Boolean(batchJob) && !batchStatus?.terminal;
  const canGenerate = Boolean(artwork)
    && (count > 0 || selectedFreeCount > 0)
    && !generating
    && (count === 0 || !frameAnalyzing)
    && !batchActive
    && !batchLoadingResults
    && (count === 0 || !selectedModel.batch || apiConfigured !== null);

  async function analyzeArtworkFrame(file, analysisId = makeSubmissionId()) {
    frameAnalysisRef.current = analysisId;
    setFrameAnalyzing(true);
    setFrameError("");
    try {
      const thumbnail = await makeAnalysisThumbnail(file);
      const formData = new FormData();
      formData.append("artwork", thumbnail);
      const response = await fetch("/api/frame", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (frameAnalysisRef.current !== analysisId) return null;
      if (!response.ok) throw new Error(data.error || "The frame could not be selected.");
      setFrameProfile(data.frameProfile || null);
      return data.frameProfile || null;
    } catch (analysisError) {
      if (frameAnalysisRef.current === analysisId) {
        setFrameError(analysisError.message || "The frame could not be selected.");
        setFrameProfile(null);
      }
      return null;
    } finally {
      if (frameAnalysisRef.current === analysisId) setFrameAnalyzing(false);
    }
  }

  function keepFailedBatchAttempt(provisionalJob, message, label = "Not queued") {
    if (!provisionalJob) return;
    const failedStatus = {
      ...provisionalJob.status,
      state: "SUBMISSION_FAILED",
      stateLabel: label,
      terminal: true,
      successful: false,
      progress: { total: provisionalJob.count || 1, successful: 0, failed: provisionalJob.count || 1, pending: 0 },
      error: message || "Google did not accept the batch submission.",
    };
    const failedJob = {
      ...provisionalJob,
      phase: "failed",
      status: failedStatus,
    };
    setBatchStatus(failedStatus);
    storeBatchJob(failedJob);
  }

  async function readArtwork(file) {
    setError("");
    setNotice("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please choose a PNG, JPG, or WebP image.");
      return;
    }
    if (artworkUrlRef.current) URL.revokeObjectURL(artworkUrlRef.current);
    const url = URL.createObjectURL(file);
    artworkUrlRef.current = url;
    const dimensions = await new Promise((resolve) => {
      const image = new window.Image();
      image.onload = () => resolve(`${image.naturalWidth} × ${image.naturalHeight}px`);
      image.onerror = () => resolve("Image file");
      image.src = url;
    });
    setArtwork({ file, url, dimensions });
    replaceResults([]);
    setFrameProfile(null);
    setFrameError("");
    analyzeArtworkFrame(file);
  }

  async function loadSampleArtwork() {
    try {
      const response = await fetch("/sample-artwork.svg");
      const svg = await response.blob();
      const svgUrl = URL.createObjectURL(svg);
      const image = new window.Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 2000;
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);
      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      await readArtwork(new File([pngBlob], "wander-often-artwork.png", { type: "image/png" }));
    } catch {
      setError("The sample artwork could not be loaded.");
    }
  }

  function removeArtwork() {
    if (artworkUrlRef.current) URL.revokeObjectURL(artworkUrlRef.current);
    artworkUrlRef.current = null;
    setArtwork(null);
    replaceResults([]);
    setFrameProfile(null);
    setFrameError("");
    setFrameAnalyzing(false);
    frameAnalysisRef.current = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    readArtwork(event.dataTransfer.files?.[0]);
  }

  function togglePrompt(id) {
    setNoPrompt(false);
    setSelectedPromptIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_MOCKUPS) {
        setNotice(`You can select up to ${MAX_MOCKUPS} mockups at a time.`);
        return current;
      }
      setNotice("");
      return [...current, id];
    });
  }

  function chooseNoPrompt() {
    setNoPrompt(true);
    setSelectedPromptIds([]);
    setEditingId(null);
  }

  function changeWhatsIncludedTemplate(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("The what's included template must be a PNG, JPG, or WebP image.");
      return;
    }
    setError("");
    setWhatsIncludedTemplate(file);
    setIncludeWhatsIncluded(true);
  }

  function updatePrompt(id, field, value) {
    setPrompts((current) => current.map((prompt) => (prompt.id === id ? { ...prompt, [field]: value } : prompt)));
  }

  function addPrompt() {
    const id = `custom-${Date.now()}`;
    setPrompts((current) => [
      ...current,
      { id, title: "New scene", text: "Describe the room, styling, lighting, and camera angle…" },
    ]);
    setSelectedPromptIds((current) => {
      if (current.length >= MAX_MOCKUPS) {
        setNotice(`Your new prompt was added, but only ${MAX_MOCKUPS} mockups can be selected.`);
        return current;
      }
      return [...current, id];
    });
    setNoPrompt(false);
    setEditingId(id);
  }

  function deletePrompt(id) {
    setPrompts((current) => current.filter((prompt) => prompt.id !== id));
    setSelectedPromptIds((current) => current.filter((item) => item !== id));
    if (editingId === id) setEditingId(null);
  }

  function resetPrompts() {
    const restored = DEFAULT_PROMPTS.map((prompt) => ({ ...prompt }));
    setPrompts(restored);
    try {
      localStorage.setItem("mocksy-prompts", JSON.stringify(restored));
      localStorage.setItem("mocksy-prompts-version", PROMPT_LIBRARY_VERSION);
    } catch {
      // Resetting still works for this session if local storage is unavailable.
    }
    setSelectedPromptIds([DEFAULT_PROMPTS[0].id]);
    setIncludeArtworkDetail(true);
    setIncludeWhatsIncluded(true);
    setNoPrompt(false);
    setEditingId(null);
  }

  async function generateMockups() {
    if (!artwork) {
      setError("Upload your artwork before generating mockups.");
      return;
    }

    setGenerating(true);
    setGenerationMessage(GENERATION_MESSAGES[0]);
    setError("");
    setNotice("");
    replaceResults([]);
    if (batchStatus?.terminal) forgetBatchJob();

    if (count === 0 && selectedFreeCount > 0) {
      setGenerationMessage("Preparing your free listing images…");
      try {
        const localResults = [];
        if (includeArtworkDetail) {
          const freeDetail = artworkDetail || await createArtworkDetail(artwork.file, { aspectRatio, imageSize });
          setArtworkDetail(freeDetail);
          localResults.push(artworkDetailResult(freeDetail));
        }
        if (includeWhatsIncluded) {
          const includedPage = whatsIncludedPage || await createWhatsIncludedPage(artwork.file, {
            templateFile: whatsIncludedTemplate,
            imageSize,
          });
          setWhatsIncludedPage(includedPage);
          localResults.push(whatsIncludedResult(includedPage));
        }
        replaceResults(localResults);
        setNotice(`${localResults.length} free listing image${localResults.length === 1 ? " is" : "s are"} ready. No image-model credits were used.`);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      } catch (freeImageFailure) {
        setError(freeImageFailure.message || "The free listing images could not be prepared.");
      } finally {
        setGenerating(false);
      }
      return;
    }

    const submissionId = makeSubmissionId();
    const displayName = `mocksy-${submissionId}`;
    const usesGoogle = selectedModel.provider === "gemini" && apiConfigured === true;
    const usesGoogleBatch = usesGoogle && selectedModel.batch && googleMode === "batch";
    let provisionalJob = null;
    let batchCreationStarted = false;

    if (usesGoogleBatch) {
      const submittingStatus = {
        state: "UPLOAD_PENDING",
        stateLabel: "Preparing upload",
        terminal: false,
        successful: false,
        progress: { total: count, successful: 0, failed: 0, pending: count },
      };
      provisionalJob = {
        phase: "uploading_artwork",
        displayName,
        submissionId,
        model: modelId,
        modelName: selectedModel.name,
        providerName: selectedModel.providerName,
        count,
        createdAt: new Date().toISOString(),
        aspectRatio,
        imageSize,
        status: submittingStatus,
      };
      setBatchStatus(submittingStatus);
      storeBatchJob(provisionalJob);
    }

    try {
      let freeDetail = includeArtworkDetail ? artworkDetail : null;
      let freeIncludedPage = includeWhatsIncluded ? whatsIncludedPage : null;
      let detailWarning = "";
      if (includeArtworkDetail) {
        try {
          if (!freeDetail) {
            freeDetail = await createArtworkDetail(artwork.file, { aspectRatio, imageSize });
            setArtworkDetail(freeDetail);
          }
          if (usesGoogleBatch && freeDetail) {
            const detailFile = new File([freeDetail.blob], freeDetail.filename, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            const storedDetail = await saveWorkflowAsset({
              workflowId: displayName,
              file: detailFile,
              blob: freeDetail.blob,
              dimensions: `${freeDetail.width} × ${freeDetail.height}px`,
              optimized: false,
            });
            provisionalJob = {
              ...provisionalJob,
              detailAssetId: storedDetail.id,
              detailWidth: freeDetail.width,
              detailHeight: freeDetail.height,
              detailFilename: freeDetail.filename,
            };
            setBatchStatus(provisionalJob.status);
            storeBatchJob(provisionalJob);
          }
        } catch (detailFailure) {
          detailWarning = ` ${detailFailure.message || "The free artwork detail could not be prepared."}`;
        }
      }
      if (includeWhatsIncluded) {
        try {
          if (!freeIncludedPage) {
            freeIncludedPage = await createWhatsIncludedPage(artwork.file, {
              templateFile: whatsIncludedTemplate,
              imageSize,
            });
            setWhatsIncludedPage(freeIncludedPage);
          }
          if (usesGoogleBatch && freeIncludedPage) {
            const includedFile = new File([freeIncludedPage.blob], freeIncludedPage.filename, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            const storedIncluded = await saveWorkflowAsset({
              workflowId: displayName,
              file: includedFile,
              blob: freeIncludedPage.blob,
              dimensions: `${freeIncludedPage.width} × ${freeIncludedPage.height}px`,
              optimized: false,
            });
            provisionalJob = {
              ...provisionalJob,
              whatsIncludedAssetId: storedIncluded.id,
              whatsIncludedWidth: freeIncludedPage.width,
              whatsIncludedHeight: freeIncludedPage.height,
              whatsIncludedFilename: freeIncludedPage.filename,
            };
            setBatchStatus(provisionalJob.status);
            storeBatchJob(provisionalJob);
          }
        } catch (includedFailure) {
          detailWarning += ` ${includedFailure.message || "The what's included page could not be prepared."}`;
        }
      }

      let requestArtwork = artwork.file;
      let uploadedFileName = "";
      let activeFrameProfile = frameProfile;
      if (!activeFrameProfile && !frameError) {
        setGenerationMessage("Choosing one perfect frame…");
        activeFrameProfile = await analyzeArtworkFrame(artwork.file);
      }
      if (usesGoogle) {
        setGenerationMessage("Securing a Google upload…");
        const prepareResponse = await fetch("/api/generate/batch/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId,
            mimeType: artwork.file.type,
            byteLength: artwork.file.size,
          }),
        });
        const prepared = await prepareResponse.json().catch(() => ({}));
        if (!prepareResponse.ok) throw new Error(prepared.error || "The direct artwork upload could not be prepared.");
        setGenerationMessage("Uploading artwork to Google · 0%…");
        const uploadedFile = await uploadFileToGoogle(
          prepared.uploadUrl,
          artwork.file,
          (progress) => {
            setGenerationMessage(`Uploading artwork to Google · ${progress}%…`);
          },
          prepared.chunkGranularity,
        );
        uploadedFileName = uploadedFile.name;
        if (provisionalJob) {
          provisionalJob = {
            ...provisionalJob,
            phase: "artwork_uploaded",
            uploadedFileName,
            frameProfile: activeFrameProfile,
            status: {
              ...provisionalJob.status,
              state: "ARTWORK_UPLOADED",
              stateLabel: "Artwork uploaded",
            },
          };
          setBatchStatus(provisionalJob.status);
          storeBatchJob(provisionalJob);
        }
        setGenerationMessage("Preparing the frame analysis…");
        requestArtwork = await makeAnalysisThumbnail(artwork.file);
      } else if (selectedModel.batch) {
        requestArtwork = await makeAnalysisThumbnail(artwork.file);
      } else if (artwork.file.size > 3 * 1024 * 1024) {
        setGenerationMessage("Optimizing artwork for FLUX…");
        requestArtwork = await makeAnalysisThumbnail(artwork.file, {
          maxSide: 2048,
          quality: 0.88,
          filename: "flux-artwork.jpg",
        });
      }

      const formData = new FormData();
      formData.append("artwork", requestArtwork);
      formData.append("count", String(count));
      formData.append("aspectRatio", aspectRatio);
      formData.append("imageSize", imageSize);
      formData.append("model", modelId);
      formData.append("submissionId", submissionId);
      formData.append("googleMode", googleMode);
      if (uploadedFileName) formData.append("uploadedFileName", uploadedFileName);
      if (activeFrameProfile) formData.append("frameProfile", JSON.stringify(activeFrameProfile));
      formData.append("prompts", JSON.stringify(noPrompt ? [] : selectedPrompts.map((prompt) => prompt.text)));

      batchCreationStarted = usesGoogleBatch;
      setGenerationMessage(usesGoogleBatch ? "Creating the discounted Google batch…" : usesGoogle ? "Generating directly with Google…" : "Starting your mockups…");
      if (provisionalJob) {
        provisionalJob = {
          ...provisionalJob,
          phase: "creating_batch",
          frameProfile: activeFrameProfile,
          status: {
            ...provisionalJob.status,
            state: "CREATING_BATCH",
            stateLabel: "Creating Google batch",
          },
        };
        setBatchStatus(provisionalJob.status);
        setBatchJob(provisionalJob);
      }
      const response = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requestError = new Error(data.error || "Mockups could not be generated.");
        requestError.mayHaveSubmitted = response.status >= 500;
        throw requestError;
      }

      if (data.batch && data.job) {
        const trackedJob = {
          ...data.job,
          detailAssetId: provisionalJob?.detailAssetId,
          detailWidth: provisionalJob?.detailWidth,
          detailHeight: provisionalJob?.detailHeight,
          detailFilename: provisionalJob?.detailFilename,
          whatsIncludedAssetId: provisionalJob?.whatsIncludedAssetId,
          whatsIncludedWidth: provisionalJob?.whatsIncludedWidth,
          whatsIncludedHeight: provisionalJob?.whatsIncludedHeight,
          whatsIncludedFilename: provisionalJob?.whatsIncludedFilename,
          phase: "tracking",
          status: data.status,
        };
        setBatchStatus(data.status);
        storeBatchJob(trackedJob);
        setFrameProfile(data.job.frameProfile || null);
        setNotice("Your discounted Google batch is queued. You can close this page and come back later.");
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        return;
      }

      if (provisionalJob) forgetBatchJob();
      const generatedResults = data.results || [];
      const freeResults = [
        freeDetail ? artworkDetailResult(freeDetail) : null,
        freeIncludedPage ? whatsIncludedResult(freeIncludedPage) : null,
      ].filter(Boolean);
      replaceResults([...generatedResults, ...freeResults]);
      setFrameProfile(data.frameProfile || null);
      const frameNote = data.frameProfile?.label ? ` Frame: ${data.frameProfile.label}.` : "";
      const detailNote = freeResults.length
        ? ` ${freeResults.length} free listing image${freeResults.length === 1 ? " was" : "s were"} added locally with no credits.`
        : detailWarning;
      setNotice(
        data.demo
          ? `Demo previews created. Add a ${selectedModel.providerName} API key to generate with ${selectedModel.name}.${detailNote}${frameNote}`
          : `${data.warning || `${generatedResults.length} mockup${generatedResults.length === 1 ? "" : "s"} created with ${data.modelName || selectedModel.name}.`}${detailNote}${frameNote}`,
      );
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (requestError) {
      if (provisionalJob && batchCreationStarted && (requestError.mayHaveSubmitted || requestError instanceof TypeError)) {
        const recoveringStatus = {
          ...provisionalJob.status,
          state: "RECOVERING",
          stateLabel: "Confirming submission",
        };
        const recoveringJob = { ...provisionalJob, phase: "recovering", status: recoveringStatus };
        setBatchStatus(recoveringStatus);
        storeBatchJob(recoveringJob);
        setBatchConnectionError("The submission response was interrupted. Mocksy is checking Google before it allows another submission.");
        setBatchRefreshKey((value) => value + 1);
      } else {
        const message = requestError.message || "Something went wrong. Please try again.";
        if (provisionalJob) {
          keepFailedBatchAttempt(
            provisionalJob,
            message,
            batchCreationStarted ? "Batch not queued" : "Upload not accepted",
          );
          setBatchConnectionError("");
          setNotice("");
        } else {
          setError(message);
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  async function cancelActiveBatch() {
    if (!batchJob?.name || batchStatus?.terminal || cancellingBatch) return;
    setCancellingBatch(true);
    setBatchConnectionError("");
    try {
      const params = new URLSearchParams({ name: batchJob.name });
      const response = await fetch(`/api/generate/batch?${params.toString()}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The batch could not be cancelled.");
      const nextJob = { ...batchJob, status: payload.batch };
      setBatchStatus(payload.batch);
      storeBatchJob(nextJob);
      setNotice(payload.batch.terminal ? "The Google batch was cancelled." : "Cancellation requested. Google is updating the batch.");
      if (!payload.batch.terminal) setBatchRefreshKey((value) => value + 1);
    } catch (cancelError) {
      setBatchConnectionError(cancelError.message || "The cancellation request failed. The batch may still be running.");
    } finally {
      setCancellingBatch(false);
    }
  }

  function retryBatchImages() {
    hydratedBatchRef.current = "";
    setBatchConnectionError("");
    loadBatchImages(batchStatus, batchJob);
  }

  function toggleResult(id) {
    setSelectedResults((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllResults() {
    setSelectedResults((current) =>
      current.size === results.length ? new Set() : new Set(results.map((result) => result.id)),
    );
  }

  function downloadOne(result) {
    triggerDownload(resultBlob(result), result.filename);
  }

  async function downloadSelected() {
    const chosen = results.filter((result) => selectedResults.has(result.id));
    if (!chosen.length) return;
    if (chosen.length === 1) {
      downloadOne(chosen[0]);
      return;
    }

    setDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      chosen.forEach((result) => zip.file(result.filename, resultBlob(result)));
      const archive = await zip.generateAsync({ type: "blob" });
      triggerDownload(archive, "etsy-mockups.zip");
    } catch {
      setError("The download could not be prepared. Please download the images one at a time.");
    } finally {
      setDownloading(false);
    }
  }

  async function continueFullFlowToSeo() {
    if (!flowContext?.flowId || !flowContext?.assetId || flowContinuing) return;
    const chosen = selectedResults.size
      ? results.filter((result) => selectedResults.has(result.id))
      : results;
    if (!chosen.length) {
      setError("Choose at least one listing image before continuing to SEO.");
      return;
    }

    setFlowContinuing(true);
    setError("");
    try {
      const storedImages = [];
      for (const result of chosen) {
        const stored = await saveWorkflowListingImage({
          workflowId: flowContext.flowId,
          blob: resultBlob(result),
          name: result.filename,
          prompt: result.prompt || "",
          aspectRatio: result.aspectRatio || aspectRatio,
          width: result.width || 0,
          height: result.height || 0,
        });
        storedImages.push(stored);
      }
      setListingWorkflowStep(flowContext.flowId, "seo", {
        mockupCount: storedImages.length,
        mockupAssetIds: storedImages.map((image) => image.id),
      });
      window.location.href = `/seo?flow=${encodeURIComponent(flowContext.flowId)}&asset=${encodeURIComponent(flowContext.assetId)}`;
    } catch (workflowError) {
      setError(workflowError.message || "The selected mockups could not be saved for the listing review.");
      setFlowContinuing(false);
    }
  }

  const batchPercent = batchProgress(batchStatus, batchJob?.count);
  const workModelName = batchJob?.modelName || selectedModel.name;
  const loadingCount = batchJob?.count || count;
  const frameSuggestionTitle = frameAnalyzing
    ? "Choosing frame"
    : frameProfile?.source === "gpt-4o-mini"
      ? "AI suggested frame"
      : "Default frame";
  const frameSuggestionLabel = frameProfile?.label || "Slim medium walnut";
  const frameSuggestionCopy = frameProfile?.rationale
    || frameError
    || "This frame direction will be added to every selected prompt.";
  const batchHasImageFailures = Boolean(
    batchStatus?.successful
    && ((batchStatus.results?.length || 0) > results.filter((result) => !result.localDetail).length || batchConnectionError),
  );
  const generatedResultCount = results.filter((result) => !result.localDetail).length;
  const setupHidden = generating || batchActive || batchLoadingResults;
  const selectedSceneCount = noPrompt ? 0 : selectedPrompts.length;
  const workingSummary = batchJob || {
    count,
    modelName: selectedModel.name,
    providerName: selectedModel.providerName,
    aspectRatio,
    imageSize,
    frameProfile,
  };

  return (
    <div className="app-shell app-with-sidebar">
      <AppSidebar />
      <div className="app-workspace">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Mocksy home">
          <span className="brand-mark"><Layers3 size={17} strokeWidth={2.4} /></span>
          <span>mocksy</span>
        </a>
        <div className="topbar-right">
          <span className={`api-status ${apiConfigured || batchActive ? "is-live" : ""}`}>
            <span className="status-dot" />
            {batchActive ? "Batch running" : apiConfigured === null ? "Checking model" : apiConfigured ? "API connected" : "Demo mode"}
          </span>
          <ThemeToggle />
          <a className="settings-link" href="/settings" aria-label="Model and access settings"><Settings size={16} /><span>Settings</span></a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="eyebrow"><span /> ETSY MOCKUP STUDIO</div>
          <h1>Your art, in its<br /><em>best light.</em></h1>
          <p>Upload once. Direct the scene. Pick the mockups that feel right.</p>
        </section>

        {flowContext && (
          <div className="flow-context-bar">
            <div><span>03</span><strong>Full listing flow</strong><small>Your 300 DPI artwork was carried in automatically.</small></div>
            <a href="/workflow">View workflow</a>
          </div>
        )}

        <div className="workflow-rail" aria-label="Workflow steps">
          <div className="workflow-step is-active"><span>01</span><strong>Artwork</strong></div>
          <div className="rail-line" />
          <div className="workflow-step"><span>02</span><strong>Direct</strong></div>
          <div className="rail-line" />
          <div className="workflow-step"><span>03</span><strong>Select & download</strong></div>
        </div>

        {(error || notice) && (
          <div className={`message-bar ${error ? "is-error" : "is-notice"}`} role="status">
            <span>{error || notice}</span>
            <button type="button" onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss message"><X size={16} /></button>
          </div>
        )}

        {!setupHidden && (
          <section className="studio-grid">
            <div className="panel artwork-panel">
            <div className="panel-heading">
              <div>
                <span className="section-number">01</span>
                <h2>Add your artwork</h2>
              </div>
              {artwork && <button className="text-button danger" type="button" onClick={removeArtwork}>Remove</button>}
            </div>

            {error && artwork ? (
              <p className="generate-hint is-error" role="alert">{error}</p>
            ) : !artwork ? (
              <div
                className={`dropzone ${dragActive ? "is-dragging" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => readArtwork(event.target.files?.[0])}
                  hidden
                />
                <div className="upload-icon"><UploadCloud size={25} /></div>
                <h3>Drop your high-resolution art here</h3>
                <p>PNG, JPG or WebP · large artwork supported</p>
                <button className="outline-button" type="button" onClick={() => fileInputRef.current?.click()}>Choose artwork</button>
                <button
                  className="sample-link"
                  type="button"
                  onClick={loadSampleArtwork}
                >
                  or try the sample artwork
                </button>
              </div>
            ) : (
              <>
                <div className="artwork-preview">
                  <div className="preview-stage">
                    <div className="preview-mat">
                      <img src={artwork.url} alt="Uploaded artwork preview" />
                    </div>
                  </div>
                  <div className="file-details">
                    <div className="file-icon"><ImageIcon size={19} /></div>
                    <div className="file-copy">
                      <strong>{artwork.file.name}</strong>
                      <span>{artwork.dimensions} · {formatBytes(artwork.file.size)}</span>
                    </div>
                    <button className="icon-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Replace artwork"><RotateCcw size={16} /></button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => readArtwork(event.target.files?.[0])}
                      hidden
                    />
                  </div>
                </div>
                <div className={`frame-suggestion-card ${frameAnalyzing ? "is-loading" : ""} ${frameError ? "is-warning" : ""}`}>
                  <span className="frame-suggestion-icon">
                    {frameAnalyzing ? <LoaderCircle className="spin" size={15} /> : <WandSparkles size={15} />}
                  </span>
                  <div>
                    <span>{frameSuggestionTitle}</span>
                    <strong>{frameSuggestionLabel}</strong>
                    <p>{frameSuggestionCopy}</p>
                  </div>
                </div>
              </>
            )}

            <div className="privacy-note">
              <Check size={14} />
              {selectedModel.batch
                ? "Google keeps batch artwork temporarily for processing; Mocksy does not save it."
                : "Artwork is used only for this generation and is not stored here."}
            </div>
            </div>

            <div className="panel direction-panel">
            <div className="panel-heading direction-heading">
              <div>
                <span className="section-number">02</span>
                <h2>Direct your scenes</h2>
              </div>
              <button className="text-button" type="button" onClick={resetPrompts}><RotateCcw size={13} /> Reset</button>
            </div>

            <div className="subheading-row">
              <div>
                <h3>Prompt library</h3>
                <p>{frameProfile?.label ? `${frameProfile.label} is added to every selected prompt.` : `Select up to ${MAX_MOCKUPS} AI mockups. The free listing images are extra.`}</p>
              </div>
              <div className="prompt-library-actions">
                <span className={`selection-count ${count >= MAX_MOCKUPS ? "is-full" : ""}`}>
                  <strong>{count}</strong> / {MAX_MOCKUPS} mockups
                  {selectedFreeCount > 0 && <em>+ {selectedFreeCount} free image{selectedFreeCount === 1 ? "" : "s"}</em>}
                </span>
                <button className="add-prompt" type="button" onClick={addPrompt}><Plus size={15} /> Add prompt</button>
              </div>
            </div>

            <div className="prompt-list">
              <button
                type="button"
                className={`prompt-card no-prompt-card free-detail-menu-card ${includeArtworkDetail ? "is-selected" : ""}`}
                onClick={() => setIncludeArtworkDetail((current) => !current)}
                aria-pressed={includeArtworkDetail}
              >
                <span className="prompt-check">{includeArtworkDetail && <Check size={13} strokeWidth={3} />}</span>
                <ZoomIn size={19} />
                <strong>Artwork detail</strong>
                <span>Centered zoom at the selected ratio and resolution · created locally · 0 credits.</span>
                <em>FREE</em>
              </button>

              <div className={`prompt-card free-template-card ${includeWhatsIncluded ? "is-selected" : ""}`}>
                <button
                  className="prompt-main free-template-main"
                  type="button"
                  onClick={() => setIncludeWhatsIncluded((current) => !current)}
                  aria-pressed={includeWhatsIncluded}
                >
                  <span className="prompt-check">{includeWhatsIncluded && <Check size={13} strokeWidth={3} />}</span>
                  <ImageIcon size={19} />
                  <strong>What’s included page</strong>
                  <span>
                    {whatsIncludedTemplate
                      ? `${whatsIncludedTemplate.name} · artwork placed locally in the frame.`
                      : "Wall Art Roses template · artwork placed locally in the frame · 0 credits."}
                  </span>
                </button>
                <div className="free-template-actions">
                  <em>FREE</em>
                  <button type="button" onClick={() => whatsIncludedTemplateInputRef.current?.click()}>
                    Change template
                  </button>
                  {whatsIncludedTemplate && (
                    <button className="use-default-template" type="button" onClick={() => setWhatsIncludedTemplate(null)}>
                      Use default
                    </button>
                  )}
                </div>
                <input
                  ref={whatsIncludedTemplateInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    changeWhatsIncludedTemplate(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  hidden
                />
              </div>

              <button
                type="button"
                className={`prompt-card no-prompt-card ${noPrompt ? "is-selected" : ""}`}
                onClick={chooseNoPrompt}
              >
                <span className="prompt-check">{noPrompt && <Check size={13} strokeWidth={3} />}</span>
                <WandSparkles size={19} />
                <strong>Surprise me</strong>
                <span>No scene prompt. Let the model decide.</span>
              </button>

              {prompts.map((prompt, index) => {
                const isSelected = selectedPromptIds.includes(prompt.id) && !noPrompt;
                const isEditing = editingId === prompt.id;
                return (
                  <div key={prompt.id} className={`prompt-card ${isSelected ? "is-selected" : ""} ${isEditing ? "is-editing" : ""}`}>
                    {!isEditing ? (
                      <>
                        <button className="prompt-main" type="button" onClick={() => togglePrompt(prompt.id)}>
                          <span className="prompt-check">{isSelected && <Check size={13} strokeWidth={3} />}</span>
                          <span className="prompt-index">{String(index + 1).padStart(2, "0")}</span>
                          <strong>{prompt.title}</strong>
                          <span>{prompt.text}</span>
                        </button>
                        <button className="prompt-menu" type="button" onClick={() => setEditingId(prompt.id)} aria-label={`Edit ${prompt.title}`}><Pencil size={14} /></button>
                      </>
                    ) : (
                      <div className="prompt-editor">
                        <div className="editor-topline">
                          <span>Edit prompt</span>
                          <button type="button" onClick={() => setEditingId(null)} aria-label="Finish editing"><Check size={16} /></button>
                        </div>
                        <input value={prompt.title} onChange={(event) => updatePrompt(prompt.id, "title", event.target.value)} aria-label="Prompt name" />
                        <textarea value={prompt.text} onChange={(event) => updatePrompt(prompt.id, "text", event.target.value)} rows={5} aria-label="Prompt text" />
                        <button className="delete-prompt" type="button" onClick={() => deletePrompt(prompt.id)}><Trash2 size={13} /> Delete prompt</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="settings-divider" />

            <div className="generation-settings">
              <div className="setting-block">
                <div className="setting-label"><h3>Output shape</h3><span>4:5 works best for Etsy listings</span></div>
                <div className="ratio-options">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.value}
                      type="button"
                      className={aspectRatio === ratio.value ? "is-active" : ""}
                      onClick={() => setAspectRatio(ratio.value)}
                    >
                      <span className={`ratio-icon ratio-${ratio.value.replace(":", "-")}`} />
                      <strong>{ratio.label}</strong>
                      <small>{ratio.hint}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-row compact-row">
                <div>
                  <h3>Resolution</h3>
                  <p>Higher resolution uses more credits.</p>
                </div>
                <div className="select-wrap">
                  <select value={imageSize} onChange={(event) => setImageSize(event.target.value)} aria-label="Output resolution">
                    <option value="1K">1K · Draft</option>
                    <option value="2K" disabled={!selectedModel.sizes.includes("2K")}>2K · Recommended</option>
                    <option value="4K" disabled={!selectedModel.sizes.includes("4K")}>4K · Maximum</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>

              <div className="setting-block model-setting-block">
                <div className="setting-label">
                  <h3>Generation model</h3>
                  <span>Choose a model for this generation</span>
                </div>
                <div className="inline-model-picker" role="radiogroup" aria-label="Generation model">
                  {MODEL_OPTIONS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      role="radio"
                      aria-checked={model.id === modelId}
                      className={model.id === modelId ? "is-active" : ""}
                      onClick={() => setModelId(model.id)}
                    >
                      <span className="inline-model-topline">
                        <span className="inline-model-radio">{model.id === modelId && <Check size={11} strokeWidth={3} />}</span>
                        <strong>{model.name}</strong>
                        <em>{model.speed}</em>
                      </span>
                      <span>{model.description}</span>
                      <small>{model.providerName} · {model.sizes.join(" / ")}</small>
                    </button>
                  ))}
                </div>
                {selectedModel.provider === "gemini" && selectedModel.batch && (
                  <div className="google-mode-picker" role="radiogroup" aria-label="Google generation mode">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={googleMode === "direct"}
                      className={googleMode === "direct" ? "is-active" : ""}
                      onClick={() => setGoogleMode("direct")}
                    >
                      <strong>Direct</strong>
                      <span>Generate now</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={googleMode === "batch"}
                      className={googleMode === "batch" ? "is-active" : ""}
                      onClick={() => setGoogleMode("batch")}
                    >
                      <strong>Batch</strong>
                      <span>Slower · discounted</span>
                    </button>
                  </div>
                )}
                <div className="frame-intelligence-row">
                  <span className="frame-intelligence-icon"><WandSparkles size={15} /></span>
                  <div>
                    <strong>Smart frame matching</strong>
                    <span>GPT‑4o mini chooses one frame and keeps it consistent across the batch.</span>
                  </div>
                  <em className={frameConfigured ? "is-connected" : ""}>
                    {frameConfigured === null ? "Checking" : frameConfigured ? "Connected" : "Walnut fallback"}
                  </em>
                </div>
                <div className={`free-detail-row ${detailError ? "is-error" : ""}`}>
                  <span className="free-detail-icon"><ZoomIn size={15} /></span>
                  <div>
                    <strong>Free artwork detail</strong>
                    <span>
                      {detailPreparing
                        ? `Preparing a ${aspectRatio} close crop…`
                        : detailError
                          ? detailError
                          : artworkDetail
                            ? `${aspectRatio} close crop · ${artworkDetail.width} × ${artworkDetail.height}px`
                            : "Added locally after you upload artwork."}
                    </span>
                  </div>
                  <em>
                    {detailPreparing
                      ? "Preparing"
                      : detailError
                        ? "Unavailable"
                        : artworkDetail
                          ? "Ready · 0 credits"
                          : "No credits"}
                  </em>
                </div>
                <div className={`free-detail-row included-page-row ${whatsIncludedError ? "is-error" : ""}`}>
                  <span className="free-detail-icon"><ImageIcon size={15} /></span>
                  <div>
                    <strong>Free what’s included page</strong>
                    <span>
                      {whatsIncludedPreparing
                        ? "Placing the artwork into the template…"
                        : whatsIncludedError
                          ? whatsIncludedError
                          : whatsIncludedPage
                            ? `1:1 · ${whatsIncludedPage.width} × ${whatsIncludedPage.height}px · ${whatsIncludedPage.templateName}`
                            : "Added locally after you upload artwork."}
                    </span>
                  </div>
                  <em>
                    {whatsIncludedPreparing
                      ? "Preparing"
                      : whatsIncludedError
                        ? "Unavailable"
                        : whatsIncludedPage
                          ? "Ready · 0 credits"
                          : "No credits"}
                  </em>
                </div>
              </div>
            </div>

            <button className="generate-button" type="button" disabled={!canGenerate} onClick={generateMockups}>
              {generating ? <LoaderCircle className="spin" size={19} /> : <Sparkles size={19} />}
              <span>
                {generating
                  ? generationMessage
                  : batchActive
                    ? "A Google batch is already running"
                    : count === 0 && selectedFreeCount > 0
                      ? `Create ${selectedFreeCount} free listing image${selectedFreeCount === 1 ? "" : "s"}`
                    : selectedModel.provider === "gemini" && selectedModel.batch && apiConfigured && googleMode === "batch"
                      ? `Queue ${count} mockup${count === 1 ? "" : "s"}${selectedFreeCount ? ` + ${selectedFreeCount} free` : ""} · save 50%`
                      : `Generate ${count} mockup${count === 1 ? "" : "s"}${selectedFreeCount ? ` + ${selectedFreeCount} free` : ""}`}
              </span>
              {!generating && !batchActive && <span className="button-arrow">→</span>}
            </button>
            {!artwork ? (
              <p className="generate-hint">Add your artwork to start generating.</p>
            ) : count === 0 && selectedFreeCount === 0 ? (
              <p className="generate-hint is-error">Select at least one mockup or free listing image.</p>
            ) : count === 0 && selectedFreeCount > 0 ? (
              <p className="generate-hint free-detail-hint">Only the selected free local images will be created. No image-model credits will be used.</p>
            ) : batchActive ? (
              <p className="generate-hint">Finish or cancel the current batch before starting another.</p>
            ) : selectedModel.provider === "gemini" && selectedModel.batch && apiConfigured && googleMode === "batch" ? (
              <p className="generate-hint">Google Batch API · 50% lower model cost · asynchronous and may take up to 24 hours.</p>
            ) : selectedModel.provider === "gemini" && apiConfigured ? (
              <p className="generate-hint">Direct Google generation · faster results, standard pricing.</p>
            ) : null}
            {artwork && count > 0 && selectedFreeCount > 0 && (
              <p className="generate-hint free-detail-hint">
                Includes {selectedFreeCount} free local listing image{selectedFreeCount === 1 ? "" : "s"} · no image-model credits.
              </p>
            )}
            </div>
          </section>
        )}

        {setupHidden && (
          <section className="waiting-summary-card" aria-live="polite">
            <div>
              <span className="section-number">03</span>
              <div>
                <h2>{batchActive ? "Your batch is running" : "Preparing your mockups"}</h2>
                <p>
                  {workingSummary.count || count} mockup{(workingSummary.count || count) === 1 ? "" : "s"}
                  {" "}with {workingSummary.modelName || selectedModel.name}
                  {workingSummary.frameProfile?.label || frameProfile?.label ? ` · ${workingSummary.frameProfile?.label || frameProfile.label}` : ""}
                </p>
              </div>
            </div>
            <div className="waiting-summary-meta">
              <span>{workingSummary.aspectRatio || aspectRatio}</span>
              <span>{workingSummary.imageSize || imageSize}</span>
              <span>{noPrompt ? "Surprise scenes" : `${selectedSceneCount || count} prompt${(selectedSceneCount || count) === 1 ? "" : "s"}`}</span>
            </div>
          </section>
        )}

        {batchJob && (
          <section
            className={`batch-status-card ${batchStatus?.terminal ? "is-terminal" : "is-active"} ${batchStatus?.terminal && !batchStatus?.successful ? "is-failed" : ""}`}
            ref={resultsRef}
            aria-live="polite"
          >
            <div className="batch-status-icon">
              {batchLoadingResults ? (
                <LoaderCircle className="spin" size={21} />
              ) : batchStatus?.successful ? (
                <Check size={21} strokeWidth={2.7} />
              ) : batchStatus?.terminal ? (
                <CircleAlert size={21} />
              ) : (
                <Clock3 size={21} />
              )}
            </div>
            <div className="batch-status-main">
              <div className="batch-status-topline">
                <span>GOOGLE BATCH · 50% LOWER MODEL COST</span>
                <em>{batchStatus?.stateLabel || "Preparing your batch"}</em>
              </div>
              <h2>
                {batchLoadingResults
                  ? "Batch complete — loading your mockups"
                  : batchStatus?.stateLabel || "Preparing your batch"}
              </h2>
              <p>
                {batchConnectionError
                  || batchStatus?.error
                  || (batchStatus?.successful
                    ? "Your mockups are ready. Finished images are retrieved separately so one download error cannot block the others."
                    : batchJob.phase === "submitting"
                      ? "Uploading the artwork once, choosing the frame, and creating the discounted batch."
                      : "Google is processing this asynchronously. You can close Mocksy and return later; this job is saved in this browser.")}
              </p>
              <div className="batch-progress" aria-label={`${batchPercent}% complete`}>
                <span style={{ width: `${batchPercent}%` }} />
              </div>
              <div className="batch-stats">
                <span><strong>{batchStatus?.progress?.total || batchJob.count}</strong> total</span>
                <span><strong>{batchStatus?.progress?.successful || 0}</strong> ready</span>
                <span><strong>{batchStatus?.progress?.failed || 0}</strong> failed</span>
                <span className="batch-reference">{batchJob.name || batchJob.displayName}</span>
              </div>
            </div>
            <div className="batch-actions">
              {!batchStatus?.terminal && batchJob.name && (
                <button type="button" onClick={() => setBatchRefreshKey((value) => value + 1)}>
                  <RefreshCw size={14} /> Check now
                </button>
              )}
              {!batchStatus?.terminal && !batchJob.name && batchJob.displayName && batchJob.phase !== "submitting" && (
                <button type="button" onClick={() => setBatchRefreshKey((value) => value + 1)}>
                  <RefreshCw size={14} /> Check Google
                </button>
              )}
              {!batchStatus?.terminal && batchJob.name && (
                <button className="is-danger" type="button" disabled={cancellingBatch} onClick={cancelActiveBatch}>
                  {cancellingBatch ? <LoaderCircle className="spin" size={14} /> : <Ban size={14} />}
                  {cancellingBatch ? "Cancelling" : "Cancel batch"}
                </button>
              )}
              {batchStatus?.successful && (batchStatus.results?.length || 0) > generatedResultCount && !batchLoadingResults && (
                <button type="button" onClick={retryBatchImages}><RefreshCw size={14} /> Retry images</button>
              )}
              {batchStatus?.successful && batchHasImageFailures && batchJob.name && !batchLoadingResults && (
                <button type="button" onClick={() => setBatchRefreshKey((value) => value + 1)}>
                  <RefreshCw size={14} /> Recheck batch
                </button>
              )}
              {batchStatus?.terminal && (
                <button type="button" onClick={forgetBatchJob}>
                  {batchStatus.successful ? <Sparkles size={14} /> : <X size={14} />}
                  {batchStatus.successful ? "Start another batch" : "Dismiss"}
                </button>
              )}
            </div>
          </section>
        )}

        {(generating || batchLoadingResults || results.length > 0) && (
          <section className="results-section" ref={resultsRef}>
            <div className="results-heading">
              <div>
                <span className="section-number">03</span>
                <h2>{generating ? "Preparing your generation" : batchLoadingResults ? "Loading your finished mockups" : "Choose your favorites"}</h2>
                <p>{generating ? `${workModelName} is receiving your artwork and directions.` : batchLoadingResults ? "The batch is complete. Mocksy is retrieving each high-resolution image." : `Select the images you want to keep, then download them together.${frameProfile?.label ? ` Consistent frame: ${frameProfile.label}.` : ""}`}</p>
              </div>
              {!generating && !batchLoadingResults && results.length > 0 && (
                <div className="result-actions">
                  <button className="text-button" type="button" onClick={selectAllResults}>
                    {selectedResults.size === results.length ? "Clear selection" : "Select all"}
                  </button>
                  <button className="download-button" type="button" disabled={!selectedResults.size || downloading} onClick={downloadSelected}>
                    {downloading ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={16} />}
                    Download {selectedResults.size ? `(${selectedResults.size})` : "selected"}
                  </button>
                  {flowContext && (
                    <button className="flow-continue-button" type="button" onClick={continueFullFlowToSeo} disabled={flowContinuing}>
                      {flowContinuing ? <LoaderCircle className="spin" size={15} /> : null}
                      {flowContinuing ? "Saving chosen images…" : "Continue to SEO"} {!flowContinuing && <ArrowRight size={15} />}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="results-grid">
              {generating || batchLoadingResults
                ? Array.from({ length: loadingCount }, (_, index) => (
                    <div className="result-skeleton" key={index}>
                      <div className="shimmer" />
                      <span>{generationMessage}</span>
                    </div>
                  ))
                : results.map((result, index) => {
                    const isSelected = selectedResults.has(result.id);
                    return (
                      <article className={`result-card ${isSelected ? "is-selected" : ""} ${result.localDetail || result.localWhatsIncluded ? "is-local-detail" : ""}`} key={result.id}>
                        <button
                          className="result-image"
                          type="button"
                          style={{ aspectRatio: String(result.aspectRatio || workingSummary.aspectRatio || aspectRatio).replace(":", " / ") }}
                          onClick={() => toggleResult(result.id)}
                          aria-label={`${isSelected ? "Deselect" : "Select"} ${result.localDetail ? "artwork detail" : result.localWhatsIncluded ? "what's included page" : `mockup ${index + 1}`}`}
                        >
                          <img src={result.dataUrl} alt={result.localDetail ? "Zoomed artwork detail" : result.localWhatsIncluded ? "What's included listing page" : `Generated Etsy mockup ${index + 1}`} />
                          <span className="result-check">{isSelected && <Check size={15} strokeWidth={3} />}</span>
                          <span className="selected-label">{isSelected ? "Selected" : "Select"}</span>
                        </button>
                        <div className="result-meta">
                          <div>
                            <strong>{result.localDetail ? "Artwork detail" : result.localWhatsIncluded ? "What’s included" : `Mockup ${String(index + 1).padStart(2, "0")}`}</strong>
                            <span>{result.localDetail ? `${result.aspectRatio || workingSummary.aspectRatio || aspectRatio} zoom · created locally · no credits` : result.localWhatsIncluded ? "Square template page · created locally · no credits" : result.prompt || "Surprise scene"}</span>
                          </div>
                          <div className="result-card-actions">
                            <button type="button" onClick={() => setLightboxResult(result)} aria-label="View larger"><ZoomIn size={15} /></button>
                            <button type="button" onClick={() => downloadOne(result)} aria-label="Download mockup"><Download size={15} /></button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
            </div>
          </section>
        )}
      </main>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark"><Layers3 size={15} /></span><span>mocksy</span></div>
        <p>Made for calm, focused Etsy workflows.</p>
        <span>Powered by {selectedModel.name}</span>
      </footer>

      {lightboxResult && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Mockup preview" onClick={() => setLightboxResult(null)}>
          <button className="lightbox-close" type="button" onClick={() => setLightboxResult(null)} aria-label="Close preview"><X size={20} /></button>
          <img src={lightboxResult.dataUrl} alt="Large mockup preview" onClick={(event) => event.stopPropagation()} />
          <button className="lightbox-download" type="button" onClick={(event) => { event.stopPropagation(); downloadOne(lightboxResult); }}><Download size={16} /> Download</button>
        </div>
      )}
      </div>
    </div>
  );
}
