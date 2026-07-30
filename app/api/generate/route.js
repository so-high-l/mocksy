import { NextResponse } from "next/server";
import { getApiKeyForProvider, getOpenAIApiKey } from "../../../lib/api-keys";
import { DEFAULT_FRAME_PROFILE, normalizeFrameProfile, selectFrameForArtwork } from "../../../lib/frame-selection";
import {
  createGeminiBatch,
  generateGeminiDirect,
  getGeminiFile,
  normalizeBatchState,
  uploadArtworkToGemini,
  waitForGeminiFile,
} from "../../../lib/gemini-batch";
import { makeMockupPrompt } from "../../../lib/mockup-prompt";
import { DEFAULT_MODEL_ID, getModel } from "../../../lib/models";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function cleanText(value, maxLength = 1600) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parsePrompts(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.map((prompt) => cleanText(prompt, 2400)).filter(Boolean).slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

function parseFrameProfile(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return normalizeFrameProfile(JSON.parse(value));
  } catch {
    return null;
  }
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function demoFrameColor(frameProfile) {
  const frame = `${frameProfile.label} ${frameProfile.instruction}`.toLowerCase();
  if (frame.includes("gold")) return "#9d7a45";
  if (frame.includes("bronze")) return "#5e4a3c";
  if (frame.includes("black")) return "#292826";
  if (frame.includes("oak")) return "#c49a67";
  if (frame.includes("white")) return "#eee9df";
  return "#7b5036";
}

function createDemoMockup(artworkDataUrl, index, scenePrompt, frameProfile) {
  const palettes = [
    { wall: "#e8e2d9", floor: "#c6aa8e", accent: "#263b33", title: "Soft daylight room" },
    { wall: "#dad5cb", floor: "#9c7f68", accent: "#744c3f", title: "Curated studio shelf" },
    { wall: "#ebe9e3", floor: "#c9c1b5", accent: "#2c4748", title: "Minimal gallery wall" },
    { wall: "#d8cfc1", floor: "#a47d62", accent: "#7f6b4f", title: "Warm bedroom corner" },
    { wall: "#dfe4df", floor: "#aeb6aa", accent: "#263e38", title: "Botanical reading nook" },
    { wall: "#e2ded9", floor: "#b0a49a", accent: "#3d3b45", title: "Editorial close-up" },
  ];
  const palette = palettes[index % palettes.length];
  const frameColor = demoFrameColor(frameProfile);
  const label = escapeXml(scenePrompt || palette.title);
  const plant = index % 2 === 0
    ? `<path d="M984 1128c-80-164-46-279 29-325-5 95 17 160 72 225-10-139 50-220 115-250 0 111-28 196-83 271 65-83 138-111 202-100-43 100-111 164-211 198" fill="${palette.accent}" opacity=".82"/><rect x="1005" y="1096" width="166" height="157" rx="12" fill="#b17d5c"/>`
    : `<circle cx="1085" cy="1064" r="110" fill="${palette.accent}" opacity=".9"/><rect x="1040" y="1132" width="90" height="122" rx="10" fill="#b88d69"/>`;
  const decor = index % 3 === 1
    ? `<rect x="76" y="1032" width="292" height="40" rx="8" fill="#74655a"/><rect x="102" y="880" width="72" height="152" fill="#986b53"/><rect x="186" y="918" width="98" height="114" fill="#d2b990"/><circle cx="317" cy="966" r="52" fill="${palette.accent}" opacity=".75"/>`
    : `<path d="M97 1236h353l-36-166H131z" fill="#b99b7d"/><rect x="153" y="1071" width="32" height="170" fill="#846a55"/><rect x="364" y="1071" width="32" height="170" fill="#846a55"/><ellipse cx="272" cy="1054" rx="103" ry="22" fill="#d6c2a8"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
    <defs>
      <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".66"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="22" stdDeviation="26" flood-opacity=".24"/></filter>
      <clipPath id="art"><rect x="375" y="251" width="450" height="600"/></clipPath>
    </defs>
    <rect width="1200" height="1215" fill="${palette.wall}"/>
    <rect y="1215" width="1200" height="285" fill="${palette.floor}"/>
    <path d="M0 0h570L190 1215H0z" fill="url(#light)"/>
    <ellipse cx="600" cy="1275" rx="438" ry="58" fill="#2c241e" opacity=".13"/>
    ${decor}
    ${plant}
    <g filter="url(#shadow)">
      <rect x="324" y="180" width="552" height="742" rx="4" fill="${frameColor}"/>
      <rect x="348" y="205" width="504" height="692" fill="#f7f3ea"/>
      <rect x="375" y="251" width="450" height="600" fill="#fff"/>
      <image href="${artworkDataUrl}" x="375" y="251" width="450" height="600" preserveAspectRatio="xMidYMid meet" clip-path="url(#art)"/>
      <path d="M348 205h504L750 250H386z" fill="#fff" opacity=".16"/>
    </g>
    <rect x="42" y="40" width="1116" height="1420" rx="26" fill="none" stroke="#fff" stroke-opacity=".36"/>
    <g font-family="Arial, sans-serif" fill="#24211e">
      <rect x="64" y="1370" width="480" height="66" rx="33" fill="#fff" fill-opacity=".86"/>
      <circle cx="104" cy="1403" r="8" fill="${palette.accent}"/>
      <text x="127" y="1411" font-size="22" letter-spacing="1">DEMO · ${label.slice(0, 38)}</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const FLUX_DIMENSIONS = {
  "1K": {
    "1:1": [1024, 1024],
    "3:2": [1216, 832],
    "4:5": [1024, 1280],
    "16:9": [1344, 768],
  },
  "2K": {
    "1:1": [1984, 1984],
    "3:2": [2432, 1632],
    "4:5": [1728, 2160],
    "16:9": [2656, 1496],
  },
};

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function generateWithFlux({ apiKey, modelId, imageBase64, prompt, frameInstruction, aspectRatio, imageSize }) {
  const [width, height] = FLUX_DIMENSIONS[imageSize]?.[aspectRatio] || FLUX_DIMENSIONS["1K"]["4:5"];
  const response = await fetch(`https://api.bfl.ai/v1/${modelId}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "x-key": apiKey,
    },
    body: JSON.stringify({
      prompt: makeMockupPrompt(prompt, frameInstruction),
      input_image: imageBase64,
      width,
      height,
      output_format: "jpeg",
      safety_tolerance: 2,
    }),
  });

  const task = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = task?.detail?.[0]?.msg || task?.detail || task?.message || `Black Forest Labs returned ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : "FLUX could not start this generation.");
  }
  if (!task.polling_url) throw new Error("FLUX did not return a result address.");

  const deadline = Date.now() + 150_000;
  let completed;
  while (Date.now() < deadline) {
    await wait(800);
    const pollResponse = await fetch(task.polling_url, {
      headers: { accept: "application/json", "x-key": apiKey },
      cache: "no-store",
    });
    const poll = await pollResponse.json().catch(() => ({}));
    if (!pollResponse.ok) throw new Error(poll?.detail || `FLUX status check returned ${pollResponse.status}`);
    if (poll.status === "Ready") {
      completed = poll;
      break;
    }
    if (["Error", "Failed", "Request Moderated", "Content Moderated"].includes(poll.status)) {
      throw new Error(poll?.details?.message || `FLUX generation stopped: ${poll.status}.`);
    }
  }
  if (!completed) throw new Error("FLUX generation timed out. Please try a smaller batch.");

  const imageUrl = completed?.result?.sample;
  if (!imageUrl) throw new Error("FLUX completed without returning an image.");
  const imageResponse = await fetch(imageUrl, { cache: "no-store" });
  if (!imageResponse.ok) throw new Error("The generated FLUX image could not be retrieved.");
  const mimeType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const data = Buffer.from(await imageResponse.arrayBuffer()).toString("base64");
  return {
    dataUrl: `data:${mimeType};base64,${data}`,
    mimeType,
    extension: mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg",
  };
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const artwork = formData.get("artwork");
    if (!(artwork instanceof File)) {
      return NextResponse.json({ error: "Choose an artwork file first." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(artwork.type)) {
      return NextResponse.json({ error: "Use a PNG, JPG, or WebP artwork file." }, { status: 400 });
    }
    const prompts = parsePrompts(formData.get("prompts"));
    const count = prompts.length ? Math.min(prompts.length, 15) : 1;
    const model = getModel(cleanText(formData.get("model"), 80) || DEFAULT_MODEL_ID);
    const aspectRatio = ["1:1", "3:2", "4:5", "16:9"].includes(formData.get("aspectRatio"))
      ? formData.get("aspectRatio")
      : "4:5";
    const requestedImageSize = ["1K", "2K", "4K"].includes(formData.get("imageSize"))
      ? formData.get("imageSize")
      : "2K";
    const imageSize = model.sizes.includes(requestedImageSize) ? requestedImageSize : model.sizes[0];
    const requestedSubmissionId = cleanText(formData.get("submissionId"), 100).toLowerCase();
    const submissionId = /^[a-z0-9-]{8,100}$/.test(requestedSubmissionId)
      ? requestedSubmissionId
      : crypto.randomUUID().toLowerCase();
    const uploadedFileName = cleanText(formData.get("uploadedFileName"), 120);
    const googleMode = cleanText(formData.get("googleMode"), 20) === "batch" ? "batch" : "direct";
    const submittedFrameProfile = parseFrameProfile(formData.get("frameProfile"));
    const imageBuffer = Buffer.from(await artwork.arrayBuffer());
    const imageBase64 = imageBuffer.toString("base64");
    const artworkDataUrl = `data:${artwork.type};base64,${imageBase64}`;
    const assignments = Array.from({ length: count }, (_, index) => prompts[index % Math.max(prompts.length, 1)] || "");
    const apiKey = await getApiKeyForProvider(request, model.provider);

    if (!apiKey) {
      const results = assignments.map((prompt, index) => ({
        id: `demo-${Date.now()}-${index}`,
        dataUrl: createDemoMockup(artworkDataUrl, index, prompt, submittedFrameProfile || DEFAULT_FRAME_PROFILE),
        mimeType: "image/svg+xml",
        prompt,
        filename: `mockup-${index + 1}.svg`,
      }));
      return NextResponse.json({
        results,
        demo: true,
        model: model.id,
        modelName: model.name,
        providerName: model.providerName,
        frameProfile: submittedFrameProfile || DEFAULT_FRAME_PROFILE,
      });
    }

    const frameProfile = submittedFrameProfile || await selectFrameForArtwork({
      apiKey: await getOpenAIApiKey(request),
      artworkDataUrl,
    });

    if (model.provider === "gemini") {
      const displayName = `mocksy-${submissionId}`;
      let uploadedFile;
      if (uploadedFileName) {
        const verifiedFile = await getGeminiFile({ apiKey, name: uploadedFileName });
        if (!ALLOWED_TYPES.has(verifiedFile.mimeType)) {
          return NextResponse.json({ error: "The uploaded Gemini artwork file is invalid." }, { status: 400 });
        }
        uploadedFile = await waitForGeminiFile({ apiKey, file: verifiedFile });
      } else {
        uploadedFile = await uploadArtworkToGemini({
          apiKey,
          bytes: imageBuffer,
          mimeType: artwork.type,
          displayName: `Mocksy artwork ${submissionId}`,
        });
      }

      if (googleMode === "direct") {
        const generated = await Promise.allSettled(
          assignments.map((prompt) =>
            generateGeminiDirect({
              apiKey,
              modelId: model.id,
              file: uploadedFile,
              prompt,
              frameInstruction: frameProfile.instruction,
              aspectRatio,
              imageSize,
            }),
          ),
        );
        const results = generated.flatMap((result, index) => {
          if (result.status !== "fulfilled") return [];
          return [{
            id: `mockup-${Date.now()}-${index}`,
            dataUrl: result.value.dataUrl,
            mimeType: result.value.mimeType,
            prompt: assignments[index],
            filename: `etsy-mockup-${index + 1}.${result.value.extension}`,
          }];
        });
        const failed = generated.filter((result) => result.status === "rejected");
        if (!results.length) {
          throw new Error(failed[0]?.reason?.message || "No mockups could be generated.");
        }
        const warnings = [
          frameProfile.warning,
          failed.length ? `${failed.length} mockup${failed.length === 1 ? "" : "s"} could not be generated.` : "",
        ].filter(Boolean);
        return NextResponse.json({
          results,
          demo: false,
          model: model.id,
          modelName: model.name,
          providerName: model.providerName,
          frameProfile,
          warning: warnings.length ? warnings.join(" ") : null,
        });
      }

      const batch = await createGeminiBatch({
        apiKey,
        modelId: model.id,
        file: uploadedFile,
        assignments,
        frameInstruction: frameProfile.instruction,
        aspectRatio,
        imageSize,
        displayName,
      });
      return NextResponse.json({
        batch: true,
        job: {
          name: batch.name,
          displayName,
          submissionId,
          model: model.id,
          modelName: model.name,
          providerName: model.providerName,
          count,
          createdAt: batch.createTime || new Date().toISOString(),
          assignments,
          frameProfile,
          aspectRatio,
          imageSize,
        },
        status: {
          state: normalizeBatchState(batch),
          stateLabel: "Queued at Google",
          terminal: false,
          successful: false,
          progress: { total: count, successful: 0, failed: 0, pending: count },
        },
      });
    }

    const generated = await Promise.allSettled(
      assignments.map((prompt) =>
        generateWithFlux({
          apiKey,
          modelId: model.id,
          imageBase64,
          prompt,
          frameInstruction: frameProfile.instruction,
          aspectRatio,
          imageSize,
        }),
      ),
    );

    const results = generated.flatMap((result, index) => {
      if (result.status !== "fulfilled") return [];
      return [{
        id: `mockup-${Date.now()}-${index}`,
        dataUrl: result.value.dataUrl,
        mimeType: result.value.mimeType,
        prompt: assignments[index],
        filename: `etsy-mockup-${index + 1}.${result.value.extension}`,
      }];
    });
    const failed = generated.filter((result) => result.status === "rejected");

    if (!results.length) {
      throw new Error(failed[0]?.reason?.message || "No mockups could be generated.");
    }

    const warnings = [
      frameProfile.warning,
      failed.length ? `${failed.length} mockup${failed.length === 1 ? "" : "s"} could not be generated.` : "",
    ].filter(Boolean);

    return NextResponse.json({
      results,
      demo: false,
      model: model.id,
      modelName: model.name,
      providerName: model.providerName,
      frameProfile,
      warning: warnings.length ? warnings.join(" ") : null,
    });
  } catch (error) {
    console.error("Mockup generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong while generating mockups." },
      { status: 500 },
    );
  }
}
